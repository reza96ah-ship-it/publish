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

import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/password";

export const authOptions: NextAuthOptions = {
  // JWT strategy is REQUIRED for Credentials provider in v4
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  providers: [
    CredentialsProvider({
      id: "credentials",
      name: "ایمیل و رمز عبور",
      credentials: {
        email: { label: "ایمیل", type: "email" },
        password: { label: "رمز عبور", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = credentials.email.toLowerCase().trim();
        const user = await db.user.findUnique({
          where: { email },
          include: {
            memberships: {
              select: { workspaceId: true, role: true },
              orderBy: { createdAt: "asc" },
            },
          },
        });

        if (!user || !user.passwordHash) return null;

        // Account lockout check (5 failed attempts → 15 min lock)
        if (user.lockedUntil && user.lockedUntil > new Date()) {
          return null;
        }

        const valid = verifyPassword(credentials.password, user.passwordHash);
        if (!valid) {
          // Increment failed attempts; lock after 5
          const attempts = user.failedAttempts + 1;
          await db.user.update({
            where: { id: user.id },
            data: {
              failedAttempts: attempts,
              lockedUntil: attempts >= 5 ? new Date(Date.now() + 15 * 60_000) : null,
            },
          });
          return null;
        }

        // Reset failed attempts + update last login
        await db.user.update({
          where: { id: user.id },
          data: {
            failedAttempts: 0,
            lockedUntil: null,
            lastLoginAt: new Date(),
          },
        });

        const primaryMembership = user.memberships[0];

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: primaryMembership?.role ?? "viewer",
          activeWorkspaceId: primaryMembership?.workspaceId ?? null,
        } as any;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      // Initial sign-in: inject user data into token
      if (user) {
        token.id = (user as any).id;
        token.role = (user as any).role ?? "viewer";
        token.activeWorkspaceId = (user as any).activeWorkspaceId ?? null;
      }

      // On session update (e.g., workspace switch): refresh role + workspace
      if (trigger === "update" && token.id) {
        const membership = await db.workspaceMember.findFirst({
          where: {
            userId: token.id as string,
            workspaceId: (token as any).activeWorkspaceId,
          },
          select: { role: true, workspaceId: true },
        });

        if (!membership) {
          // Workspace no longer valid — fall back to first membership
          const first = await db.workspaceMember.findFirst({
            where: { userId: token.id as string },
            orderBy: { createdAt: "asc" },
            select: { role: true, workspaceId: true },
          });
          (token as any).activeWorkspaceId = first?.workspaceId ?? null;
          token.role = (first?.role ?? "viewer") as any;
        } else {
          token.role = membership.role as any;
        }
      }

      return token;
    },

    async session({ session, token }) {
      // Expose token data to the client session
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
        (session as any).activeWorkspaceId = token.activeWorkspaceId;
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
  secret: process.env.NEXTAUTH_SECRET || "nashrino-dev-secret-change-in-production",
};
