/**
 * Next.js middleware -- NextAuth route protection + nonce-based CSP (Issue #119).
 *
 * Auth:
 *   Production: redirects unauthenticated users to /auth/signin.
 *   Development: bypasses auth (DISABLE_AUTH=1) for the Z.ai preview iframe.
 *
 * CSP (Issue #119 + Issue #151):
 *   Generates a fresh nonce per request (Web Crypto API -- Edge Runtime compatible)
 *   and sets a strict Content-Security-Policy header. Replaces 'unsafe-inline'
 *   in script-src with 'nonce-{nonce}' + 'strict-dynamic'.
 *
 *   Issue #151: The CSP header is set on BOTH request AND response headers.
 *   Next.js needs the CSP in the request headers so it can extract the nonce
 *   during server-side rendering and apply it to framework-emitted scripts.
 *   Previously we only set `x-nonce` on the request -- now we set the full
 *   CSP header too, so Server Components reading `headers().get('Content-Security-Policy')`
 *   see the same policy that will be enforced on the response.
 *
 *   https://nextjs.org/docs/app/guides/content-security-policy
 *
 * We can't use withAuth()'s default export because it wraps the request in a way
 * that prevents us from setting response headers. Instead we import getToken
 * and do the auth check manually, then set both the nonce and CSP on the response.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

/**
 * Generate a cryptographically random nonce (base64, 18 bytes -> 24 chars).
 * Uses the Web Crypto API (Edge Runtime compatible -- Node.js 'crypto' is not).
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
    // 'unsafe-eval' is required by React dev mode (stack reconstruction via Turbopack).
    // Never included in production builds -- React never uses eval() there.
    `script-src 'nonce-${nonce}' 'strict-dynamic' 'sha256-7I2EBeMSjJEuUo9kEh7aZDCwm5KZUpXX/f5Z9gB8oPI='${isProd ? '' : " 'unsafe-eval'"}`,
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

export async function proxy(req: NextRequest) {
  const nonce = generateNonce()
  const isProd = process.env.NODE_ENV === 'production'
  const csp = buildCsp(nonce, isProd)

  // Auth check: skip for public paths (NextAuth callbacks, health, etc.)
  const { pathname } = req.nextUrl
  const isPublicPath =
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/health') ||
    pathname.startsWith('/api/readyz') ||
    // Issue #151: /api/metrics removed from public paths -- Prometheus endpoints
    // should be restricted by network policy or reverse-proxy, not exposed publicly.
    // If metrics must be scraped without auth, configure network-level protection.
    pathname.startsWith('/api/smart-pages/public/') ||
    pathname.startsWith('/api/smart-pages/track') ||
    // Issue #254: Client portal access via token — public, no session.
    pathname.startsWith('/api/agency/portal/') ||
    // Issue #255: Public API v1 uses Bearer-token auth, not session cookies.
    // Excluding it here keeps the middleware from 401-redirecting API clients
    // (and from injecting nonce/CSP that a non-browser caller doesn't need).
    pathname.startsWith('/api/v1') ||
    pathname.startsWith('/auth/') ||
    pathname.startsWith('/p/') ||
    pathname.startsWith('/_next/') ||
    pathname === '/favicon.ico' ||
    pathname === '/robots.txt' ||
    pathname === '/logo.svg'

  if (!isPublicPath) {
    // Explicit opt-in bypass via DISABLE_AUTH=1 (dev/preview only)
    if (process.env.DISABLE_AUTH !== '1') {
      const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
      if (!token) {
        // API routes get a 401, not a redirect: redirecting fetch/beacon
        // calls (e.g. /api/vitals) to the signin page is useless to the
        // caller and used to leak "callbackUrl=/api/..." into the login flow.
        if (pathname.startsWith('/api/')) {
          return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
        }
        const signInUrl = new URL('/auth/signin', req.url)
        signInUrl.searchParams.set('callbackUrl', pathname)
        const redirect = NextResponse.redirect(signInUrl)
        redirect.headers.set('Content-Security-Policy', csp)
        redirect.headers.set('x-nonce', nonce)
        return redirect
      }
    }
  }

  // Issue #151: Inject BOTH the nonce AND the CSP into request headers.
  // Next.js reads `x-nonce` from request headers and applies it to framework
  // scripts during SSR. Setting `Content-Security-Policy` on the request
  // headers as well lets Server Components and downstream middleware read
  // the exact policy that will be enforced on the response -- this matches
  // the official Next.js CSP nonce guide.
  const requestHeaders = new Headers(req.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', csp)

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  })

  // Set CSP + nonce on the response (enforced by the browser)
  response.headers.set('Content-Security-Policy', csp)
  response.headers.set('x-nonce', nonce)

  return response
}

export const config = {
  matcher: [
    // Protect everything EXCEPT:
    //   api/auth       -- NextAuth callback endpoints (must be public)
    //   api/webhooks   -- Platform webhook receivers (verified separately)
    //   api/health     -- Liveness probe (orchestrator access)
    //   api/readyz     -- Readiness probe (orchestrator access)
    //   api/metrics    -- Prometheus metrics (scraped by monitoring -- but
    //                     Issue #151 removed it from isPublicPath so it now
    //                     requires auth. The matcher still skips running
    //                     middleware on it for performance; network policy
    //                     or reverse-proxy must restrict access at the edge.)
    //   api/smart-pages/public -- Issue #250: public link-in-bio reads
    //   api/smart-pages/track  -- Issue #250: public click-tracking beacon
    //   api/agency/portal      -- Issue #254: public client-portal token read
    //   api/v1         -- Issue #255: Public API v1 (Bearer-token auth, not session)
    //   auth           -- The signin page itself
    //   p              -- Issue #250: public Smart Page route (/p/[slug])
    //   _next/static   -- Next.js static assets
    //   _next/image    -- Next.js image optimizer
    //   favicon.ico, robots.txt, logo.svg, logos/* -- public assets
    '/((?!api/auth|api/webhooks|api/health|api/readyz|api/metrics|api/smart-pages/public|api/smart-pages/track|api/agency/portal|api/v1|auth|p|_next/static|_next/image|favicon.ico|robots.txt|logo.svg|logos).*)',
  ],
}
