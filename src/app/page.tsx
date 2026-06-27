/**
 * Root page — Server Component.
 *
 * Renders the interactive `<AppRouter />` client island.
 * Wrapped in <Suspense> because AppRouter uses useSearchParams (requires Suspense).
 *
 * The user-visible route is / with ?view=<name> search params.
 */

import { Suspense } from "react";
import { AppRouter } from "@/components/shell/app-router";

export default function Home() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-dvh">
        <div className="animate-pulse text-[12px] text-ink-tertiary">در حال بارگذاری…</div>
      </div>
    }>
      <AppRouter />
    </Suspense>
  );
}
