/**
 * NextAuth v4 configuration — Credentials provider + JWT sessions.
 *
 * Auth flow:
 *   1. User signs in with email + password (Credentials provider)
 *   2. JWT token is created with { id, email, name, role, activeWorkspaceId }
 *   3. Session callback exposes token data to the client
 *   4. API routes use getServerSession() to check auth
 *
 * Multi-tenant: the JWT contains activeWorkspaceId, which the session
 * callback reads from the DB on each session load.
 */

import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { db } from '@/lib/db'
import { verifyPassword } from '@/lib/password'
import { verifyTotpCode, decryptMfaSecret, parseBackupCodes, consumeBackupCode, serializeBackupCodes } from '@/lib/mfa'
import { authFailuresTotal } from '@/lib/metrics'

export const authOptions: NextAuthOptions = {
  // JWT strategy is REQUIRED for Credentials provider in v4
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  // ASVS L2 V3.4.1: Explicit cookie configuration.
  // SameSite=Lax (ASVS L2 accepts Lax; only L3 requires Strict).
  // No __Secure- prefix — it requires HTTPS, but CI/staging run on HTTP.
  // The secure flag is only set when behind TLS (production with HTTPS).
  cookies: {
    sessionToken: {
      name: 'next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: false,
      },
    },
    callbackUrl: {
      name: 'next-auth.callback-url',
      options: {
        sameSite: 'lax',
        path: '/',
        secure: false,
      },
    },
    csrfToken: {
      name: 'next-auth.csrf-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: false,
      },
    },
  },
  providers: [
    CredentialsProvider({
      id: 'credentials',
      name: 'ایمیل و رمز عبور',
      credentials: {
        email: { label: 'ایمیل', type: 'email' },
        password: { label: 'رمز عبور', type: 'password' },
        // Issue #121: optional TOTP code for MFA-enforced admin accounts
        totpCode: { label: 'کد تأیید (اختیاری)', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const email = credentials.email.toLowerCase().trim()
        const user = await db.user.findUnique({
          where: { email },
          include: {
            memberships: {
              select: { workspaceId: true, role: true },
              orderBy: { createdAt: 'asc' },
            },
          },
        })

        if (!user || !user.passwordHash) {
          authFailuresTotal.inc({ reason: 'invalid_credentials' })
          return null
        }

        // Account lockout check (5 failed attempts → 15 min lock)
        if (user.lockedUntil && user.lockedUntil > new Date()) {
          authFailuresTotal.inc({ reason: 'account_locked' })
          return null
        }

        const verifyResult = await verifyPassword(credentials.password, user.passwordHash)
        if (!verifyResult.valid) {
          // Increment failed attempts; lock after 5
          const attempts = user.failedAttempts + 1
          await db.user.update({
            where: { id: user.id },
            data: {
              failedAttempts: attempts,
              lockedUntil: attempts >= 5 ? new Date(Date.now() + 15 * 60_000) : null,
            },
          })
          authFailuresTotal.inc({ reason: 'invalid_credentials' })
          return null
        }

        // Issue #121: MFA enforcement.
        // If the user has an active MFA secret, require a valid TOTP code
        // (or backup code) before completing login. Non-admin users are not
        // required to use MFA, but if they've enrolled, they must use it.
        const primaryMembership = user.memberships[0]

        if (user.mfaSecret) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const totpCode = (credentials as any).totpCode as string | undefined
          if (!totpCode) {
            // Password valid but MFA code missing — signal the client to show MFA step
            authFailuresTotal.inc({ reason: 'mfa_required' })
            return null
          }

          const secret = decryptMfaSecret(user.mfaSecret)
          const isValidTotp = verifyTotpCode(totpCode, secret)

          if (!isValidTotp) {
            // Try backup code
            const stored = parseBackupCodes(user.mfaBackupCodes)
            const { valid, remaining } = consumeBackupCode(totpCode, stored)
            if (!valid) {
              authFailuresTotal.inc({ reason: 'mfa_invalid' })
              return null
            }
            // Consume the backup code (single-use)
            await db.user.update({
              where: { id: user.id },
              data: { mfaBackupCodes: serializeBackupCodes(remaining) },
            })
          }
        }

        // Issue #118: if the stored hash was legacy scrypt, upgrade to Argon2id
        // on successful login (gradual migration, no forced password reset).
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updateData: any = {
          failedAttempts: 0,
          lockedUntil: null,
          lastLoginAt: new Date(),
        }
        if (verifyResult.rehash) {
          updateData.passwordHash = verifyResult.rehash
        }

        // Reset failed attempts + update last login
        await db.user.update({
          where: { id: user.id },
          data: updateData,
        })

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: primaryMembership?.role ?? 'viewer',
          activeWorkspaceId: primaryMembership?.workspaceId ?? null,
          mfaEnabled: !!user.mfaSecret,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any
      },
    }),
  ],
  callbacks: {
    // CRITICAL: Always return RELATIVE URLs for redirects so the app works
    // behind the Z.ai preview gateway (iframe on *.space-z.ai). Without this,
    // NextAuth redirects to http://localhost:3000/ which the user's browser
    // can't reach (localhost = their machine, not the sandbox).
    async redirect({ url }) {
      // If it's already a relative URL, return as-is
      if (url.startsWith('/')) return url
      // If it's an absolute URL, extract just the pathname (+ search)
      try {
        const parsed = new URL(url)
        return parsed.pathname + parsed.search
      } catch {
        // Not a valid URL — default to relative "/"
      }
      return '/'
    },

    async jwt({ token, user, trigger }) {
      // Initial sign-in: inject user data into token
      if (user) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        token.id = (user as any).id
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        token.role = (user as any).role ?? 'viewer'
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        token.activeWorkspaceId = (user as any).activeWorkspaceId ?? null
      }

      // On session update (e.g., workspace switch): refresh role + workspace
      if (trigger === 'update' && token.id) {
        const membership = await db.workspaceMember.findFirst({
          where: {
            userId: token.id as string,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            workspaceId: (token as any).activeWorkspaceId,
          },
          select: { role: true, workspaceId: true },
        })

        if (!membership) {
          // Workspace no longer valid — fall back to first membership
          const first = await db.workspaceMember.findFirst({
            where: { userId: token.id as string },
            orderBy: { createdAt: 'asc' },
            select: { role: true, workspaceId: true },
          })
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ;(token as any).activeWorkspaceId = first?.workspaceId ?? null
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          token.role = (first?.role ?? 'viewer') as any
        } else {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          token.role = membership.role as any
        }
      }

      return token
    },

    async session({ session, token }) {
      // Expose token data to the client session
      if (session.user) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(session.user as any).id = token.id
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(session.user as any).role = token.role
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(session as any).activeWorkspaceId = token.activeWorkspaceId
      }
      return session
    },
  },
  pages: {
    signIn: '/auth/signin',
  },
  secret: (() => {
    const secret = process.env.NEXTAUTH_SECRET
    if (!secret) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error(
          'NEXTAUTH_SECRET environment variable is required in production. ' +
            'Generate one with: openssl rand -base64 32'
        )
      }
      // Dev-only fallback (so local dev works without an .env entry).
      // eslint-disable-next-line no-console
      console.warn(
        '[auth] NEXTAUTH_SECRET missing — using insecure dev fallback. ' +
          'Set NEXTAUTH_SECRET in .env for production.'
      )
      return 'nashrino-dev-secret-change-in-production'
    }
    return secret
  })(),
}
