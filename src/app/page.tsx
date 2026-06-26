/**
 * Root page — Server Component.
 *
 * This is a Server Component (no "use client" directive) that renders the
 * interactive `<AppRouter />` client island. The view-switching logic and
 * all dashboard sub-components remain client-side (they use Zustand state,
 * TanStack Query, and Framer Motion), but the page shell itself is now RSC,
 * which enables:
 *  - Future streaming with `<Suspense>` boundaries
 *  - Server-side metadata exports per route
 *  - A cleaner separation between server data-fetching and client interactivity
 *
 * The user-visible route is still only `/` (per project constraints).
 */

import { AppRouter } from "@/components/shell/app-router";

export default function Home() {
  return <AppRouter />;
}
