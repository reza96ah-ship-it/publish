"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { motion, AnimatePresence } from "framer-motion";
import { Sun, Moon } from "lucide-react";

/**
 * ThemeToggle — Linear/Vercel-style light/dark switcher.
 * Renders a glass control button with a smooth icon crossfade.
 * Respects `prefers-color-scheme` via next-themes `enableSystem`.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch — only render the icon after mount.
  // setState-in-effect is the standard next-themes mount-detection pattern.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const isDark = resolvedTheme === "dark";

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="n-glass-control n-focus-ring flex size-10 items-center justify-center text-ink-secondary transition-colors hover:text-ink-primary"
      aria-label={isDark ? "تغییر به حالت روشن" : "تغییر به حالت تاریک"}
      title={isDark ? "حالت روشن" : "حالت تاریک"}
    >
      <AnimatePresence mode="wait" initial={false}>
        {mounted && (
          <motion.span
            key={isDark ? "moon" : "sun"}
            initial={{ opacity: 0, rotate: -30, scale: 0.8 }}
            animate={{ opacity: 1, rotate: 0, scale: 1 }}
            exit={{ opacity: 0, rotate: 30, scale: 0.8 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="flex items-center justify-center"
          >
            {isDark ? (
              <Sun className="size-[15px]" strokeWidth={2} />
            ) : (
              <Moon className="size-[15px]" strokeWidth={2} />
            )}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}
