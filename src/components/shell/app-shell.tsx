"use client";

import { type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { AmbientMesh } from "./ambient-mesh";
import { useAppStore } from "@/lib/store";
import { Sidebar } from "./sidebar";
import { CommandBar } from "./command-bar";
import { Menu, X } from "lucide-react";
import { api } from "@/lib/api";
import { usePublishStream } from "@/hooks/use-publish-stream";
import { CommandPalette } from "./command-palette";
import { ShortcutsModal } from "./shortcuts-modal";
import { LiveRegionProvider } from "@/lib/aria-live";

function RealtimeProvider() {
  const { data: workspaceId } = useQuery<string>({
    queryKey: ["workspace-id"],
    queryFn: async () => {
      const ws = await api.get<{ id: string }>("/api/workspace");
      return ws.id;
    },
    staleTime: Infinity,
  });
  usePublishStream(workspaceId);
  return null;
}

export function AppShell({ children }: { children: ReactNode }) {
  const isMobileMenuOpen = useAppStore((s) => s.isMobileMenuOpen);
  const setMobileMenuOpen = useAppStore((s) => s.setMobileMenuOpen);

  return (
    <div className="relative flex h-dvh w-full overflow-hidden">
      <AmbientMesh />
      <RealtimeProvider />
      <CommandPalette />
      <ShortcutsModal />
      <LiveRegionProvider />

      {/* Mobile overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden
        />
      )}

      {/* Sidebar — glass navigation (fixed drawer on mobile, static on desktop) */}
      <div
        className={`fixed inset-y-0 right-0 z-40 w-[260px] transform transition-transform duration-300 lg:static lg:z-auto lg:translate-x-0 ${
          isMobileMenuOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0"
        }`}
      >
        <Sidebar />
      </div>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="flex items-center justify-between px-4 py-3 lg:hidden">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="n-glass-control flex size-10 items-center justify-center text-ink-primary"
            aria-label="باز کردن منو"
          >
            <Menu className="size-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-md bg-accent">
              <span className="text-[13px] font-[700] text-white leading-none">N</span>
            </div>
            <span className="text-[13.5px] font-[700] text-ink-primary tracking-tight">نشرینو</span>
          </div>
          <div className="w-10" />
        </header>

        {/* Desktop command bar slot — glass toolbar */}
        <div className="hidden px-[var(--shell-gutter)] pt-[var(--shell-gap)] lg:block">
          <CommandBar />
        </div>

        {/* Scrollable content stage — solid surfaces */}
        <main className="flex-1 overflow-y-auto thin-scrollbar px-[var(--shell-gutter)] py-[var(--shell-gap)]">
          <div className="mx-auto w-full max-w-[1600px] pb-10">{children}</div>
        </main>
      </div>

      {/* Close button on mobile drawer */}
      {isMobileMenuOpen && (
        <button
          onClick={() => setMobileMenuOpen(false)}
          className="fixed top-4 left-4 z-50 n-glass-control flex size-10 items-center justify-center text-ink-primary lg:hidden"
          aria-label="بستن منو"
        >
          <X className="size-5" />
        </button>
      )}
    </div>
  );
}
