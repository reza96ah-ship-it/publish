/**
 * Next.js middleware — NextAuth route protection + nonce-based CSP (Issue #119).
 *
 * Auth:
 *   Production: redirects unauthenticated users to /auth/signin.
 *   Development: bypasses auth (DISABLE_AUTH=1) for the Z.ai preview iframe.
 *
 * CSP (Issue #119):
 *   Generates a fresh nonce per request (Web Crypto API — Edge Runtime compatible)
 *   and sets a strict Content-Security-Policy header. Replaces 'unsafe-inline'
 *   in script-src with 'nonce-{nonce}' + 'strict-dynamic'.
 *
 * We can't use withAuth()'s default export because it wraps the request in a way
 * that prevents us from setting response headers. Instead we import getToken
 * and do the auth check manually, then set both the nonce and CSP on the response.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

/**
 * Generate a cryptographically random nonce (base64, 18 bytes → 24 chars).
 * Uses the Web Crypto API (Edge Runtime compatible — Node.js 'crypto' is not).
 */
function generateNonce(): string {
  const bytes = new Uint8Array(18)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes))
}

/**
 * Issue #119: Build the strict CSP header with a per-request nonce.
 * - script-src uses 'nonce-{nonce}' + 'strict-dynamic' (no unsafe-inline)
 * - style-src keeps 'unsafe-inline' for Tailwind (per issue spec)
 * - frame-ancestors 'none' in production (clickjacking protection)
 */
function buildCsp(nonce: string, isProd: boolean): string {
  return [
    "default-src 'self'",
    // The sha256 hash covers a static Next.js bootstrap script that doesn't receive a nonce.
    `script-src 'nonce-${nonce}' 'strict-dynamic' 'sha256-7I2EBeMSjJEuUo9kEh7aZDCwm5KZUpXX/f5Z9gB8oPI='`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' https://api.gapgpt.app https://api.telegram.org https://tapi.bale.ai https://botapi.rubika.ir https://graph.facebook.com https://api.linkedin.com wss:",
    "media-src 'self' data:",
    isProd ? "frame-ancestors 'none'" : 'frame-ancestors *',
    "base-uri 'self'",
    "form-action 'self'",
    isProd ? "object-src 'none'" : "object-src 'self'",
  ].join('; ')
}

export async function middleware(req: NextRequest) {
  const nonce = generateNonce()
  const isProd = process.env.NODE_ENV === 'production'

  // Auth check: skip for public paths (NextAuth callbacks, health, etc.)
  const { pathname } = req.nextUrl
  const isPublicPath =
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/health') ||
    pathname.startsWith('/api/readyz') ||
    pathname.startsWith('/api/metrics') ||
    pathname.startsWith('/auth/') ||
    pathname.startsWith('/_next/') ||
    pathname === '/favicon.ico' ||
    pathname === '/robots.txt' ||
    pathname === '/logo.svg'

  if (!isPublicPath) {
    // Explicit opt-in bypass via DISABLE_AUTH=1 (dev/preview only)
    if (process.env.DISABLE_AUTH !== '1') {
      const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
      if (!token) {
        const signInUrl = new URL('/auth/signin', req.url)
        signInUrl.searchParams.set('callbackUrl', pathname)
        const redirect = NextResponse.redirect(signInUrl)
        redirect.headers.set('Content-Security-Policy', buildCsp(nonce, isProd))
        return redirect
      }
    }
  }

  // Inject nonce into request headers so Next.js can add it to script tags
  const requestHeaders = new Headers(req.headers)
  requestHeaders.set('x-nonce', nonce)

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  })

  // Set CSP + nonce on the response
  response.headers.set('Content-Security-Policy', buildCsp(nonce, isProd))
  response.headers.set('x-nonce', nonce)

  return response
}

export const config = {
  matcher: [
    // Protect everything EXCEPT:
    //   api/auth       — NextAuth callback endpoints (must be public)
    //   api/webhooks   — Platform webhook receivers (verified separately)
    //   api/health     — Liveness probe (orchestrator access)
    //   api/readyz     — Readiness probe (orchestrator access)
    //   api/metrics    — Prometheus metrics (scraped by monitoring)
    //   auth           — The signin page itself
    //   _next/static   — Next.js static assets
    //   _next/image    — Next.js image optimizer
    //   favicon.ico, robots.txt, logo.svg, logos/* — public assets
    '/((?!api/auth|api/webhooks|api/health|api/readyz|api/metrics|auth|_next/static|_next/image|favicon.ico|robots.txt|logo.svg|logos).*)',
  ],
}
