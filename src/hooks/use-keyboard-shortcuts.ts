"use client";

import { useEffect } from "react";
import { useAppStore } from "@/lib/store";
import { useViewRoute, type AppView } from "@/lib/view-route";

/**
 * useKeyboardShortcuts — global keyboard navigation.
 *
 * Wires the shortcuts advertised in the ShortcutsModal:
 *   G then D  → Dashboard
 *   G then C  → Calendar
 *   G then I  → Inbox
 *   G then A  → Analytics
 *   G then S  → Settings
 *   C         → Compose
 *   N         → New Campaign (navigates to campaigns view)
 *   ⌘K / Ctrl+K → Command palette
 *   ?          → Shortcuts modal
 *   Esc        → Close any open modal
 *
 * Two-step "G then X" sequences use a 600ms timeout window (Linear/Raycast style).
 * All shortcuts are ignored when typing in inputs/textareas/contentEditable.
 */
const G_PREFIX_MAP: Record<string, AppView> = {
  d: "dashboard",
  c: "calendar",
  i: "inbox",
  a: "analytics",
  s: "settings",
};

const VIEW_DIRECT_MAP: Record<string, AppView> = {
  // Single-key shortcuts (no prefix) — only when not typing
};

export function useKeyboardShortcuts() {
  const { setView } = useViewRoute();
  const setCommandPaletteOpen = useAppStore((s) => s.setCommandPaletteOpen);
  const setShortcutsOpen = useAppStore((s) => s.setShortcutsOpen);
  const setMobileMenuOpen = useAppStore((s) => s.setMobileMenuOpen);
  const isCommandPaletteOpen = useAppStore((s) => s.isCommandPaletteOpen);
  const isShortcutsOpen = useAppStore((s) => s.isShortcutsOpen);

  useEffect(() => {
    let gPressed = false;
    let gTimer: ReturnType<typeof setTimeout> | null = null;

    const isTyping = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName.toLowerCase();
      return tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable;
    };

    const clearG = () => {
      gPressed = false;
      if (gTimer) {
        clearTimeout(gTimer);
        gTimer = null;
      }
    };

    const handler = (e: KeyboardEvent) => {
      // ⌘K / Ctrl+K — always works (even in some inputs, but not in contentEditable)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandPaletteOpen(!isCommandPaletteOpen);
        return;
      }

      // Escape — close any open modal
      if (e.key === "Escape") {
        if (isCommandPaletteOpen) setCommandPaletteOpen(false);
        if (isShortcutsOpen) setShortcutsOpen(false);
        return;
      }

      // Don't interfere with modifier combos (except ⌘K handled above)
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      // Skip when typing
      if (isTyping(e.target)) return;

      const key = e.key.toLowerCase();

      // ? — open shortcuts modal
      if (e.key === "?") {
        e.preventDefault();
        setShortcutsOpen(!isShortcutsOpen);
        return;
      }

      // Two-step G+X navigation
      if (key === "g") {
        if (!gPressed) {
          gPressed = true;
          // Reset after 600ms if no second key
          gTimer = setTimeout(clearG, 600);
          e.preventDefault();
        }
        return;
      }

      // If G was pressed, handle the second key
      if (gPressed) {
        const target = G_PREFIX_MAP[key];
        if (target) {
          e.preventDefault();
          setView(target);
        }
        clearG();
        return;
      }

      // Single-key shortcuts
      if (key === "c") {
        e.preventDefault();
        setView("compose");
        return;
      }
      if (key === "n") {
        e.preventDefault();
        setView("campaigns");
        return;
      }
      if (key === "r") {
        e.preventDefault();
        setView("inbox");
        return;
      }
    };

    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
      if (gTimer) clearTimeout(gTimer);
    };
  }, [
    setCommandPaletteOpen,
    setShortcutsOpen,
    setMobileMenuOpen,
    isCommandPaletteOpen,
    isShortcutsOpen,
  ]);
}
