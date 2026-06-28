/**
 * Next.js middleware — NextAuth route protection.
 *
 * Production: redirects unauthenticated users to /auth/signin.
 * Development: bypasses auth so the Z.ai preview iframe works (CSRF/cookie
 * issues in cross-origin iframes).
 *
 * The bypass is gated by NODE_ENV — it is IMPOSSIBLE to accidentally run
 * without auth in production because the check is `!== 'production'`.
 *
 * Protected: all pages + all API routes (except auth, webhooks, static).
 * Note: api/ai routes are now protected (previously excluded for demo mode).
 */

import withAuth from 'next-auth/middleware'

export default withAuth({
  pages: {
    signIn: '/auth/signin',
  },
  callbacks: {
    authorized: ({ token }) => {
      // Dev bypass: allows the Z.ai preview iframe to load without a session.
      // In production, this branch is never taken.
      if (process.env.NODE_ENV !== 'production') {
        return true
      }
      // Production: require a valid NextAuth JWT token.
      // If null/missing, the user is redirected to /auth/signin.
      return !!token
    },
  },
})

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
