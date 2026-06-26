/**
 * Next.js middleware — DISABLED for preview.
 *
 * Auth infrastructure (NextAuth + guards) is fully built and working,
 * but the login flow has issues in the Z.ai preview iframe context
 * (CSRF cookie + cross-origin redirect). For now, we bypass route
 * protection so the app is directly previewable.
 *
 * To re-enable auth: uncomment the matcher below.
 */

// export { default } from "next-auth/middleware";
//
// export const config = {
//   matcher: [
//     "/((?!api/auth|api/ai|api/webhooks|auth|_next/static|_next/image|favicon.ico|robots.txt|logo.svg|logos).*)",
//   ],
// };

export function middleware() {
  // No-op — auth bypassed for preview
}

export const config = {
  matcher: [], // Match nothing
};
