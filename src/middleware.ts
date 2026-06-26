/**
 * Next.js middleware — protects all routes except auth + public assets.
 * Redirects unauthenticated users to /auth/signin.
 */

export { default } from "next-auth/middleware";

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - /api/auth/* (NextAuth routes)
     * - /auth/* (signin/signup pages)
     * - /_next/* (Next.js internals)
     * - /favicon.ico, /robots.txt, /logo.svg (static assets)
     * - /api/ai/* (AI endpoints — allow for now, will add auth later)
     * - /api/webhooks/* (webhook endpoints)
     */
    "/((?!api/auth|api/ai|api/webhooks|auth|_next/static|_next/image|favicon.ico|robots.txt|logo.svg|logos).*)",
  ],
};
