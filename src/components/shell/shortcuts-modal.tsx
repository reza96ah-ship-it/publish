"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Keyboard, X } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { modalBackdrop, modalContent } from "@/lib/motion";

interface ShortcutGroup {
  title: string;
  items: { keys: string[]; label: string }[];
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: "عمومی",
    items: [
      { keys: ["⌘", "K"], label: "باز کردن پنل فرمان" },
      { keys: ["?"], label: "نمایش راهنمای میانبرها" },
      { keys: ["Esc"], label: "بستن پنجره باز" },
      { keys: ["⌘", "/"], label: "جستجوی سریع" },
    ],
  },
  {
    title: "مسیرها",
    items: [
      { keys: ["G", "D"], label: "داشبورد" },
      { keys: ["G", "C"], label: "تقویم محتوا" },
      { keys: ["G", "I"], label: "صندوق ورودی" },
      { keys: ["G", "A"], label: "تحلیل و گزارش‌ها" },
      { keys: ["G", "S"], label: "تنظیمات" },
    ],
  },
  {
    title: "عملیات",
    items: [
      { keys: ["C"], label: "انتشار محتوای جدید" },
      { keys: ["N"], label: "ساخت کمپین جدید" },
      { keys: ["R"], label: "بررسی صندوق ورودی" },
      { keys: ["⌘", "↵"], label: "تأیید و ارسال" },
    ],
  },
  {
    title: "مسیریابی",
    items: [
      { keys: ["↑", "↓"], label: "انتخاب آیتم" },
      { keys: ["↵"], label: "اجرا کردن آیتم" },
      { keys: ["Tab"], label: "جابه‌جایی بین فیلدها" },
      { keys: ["⌘", "B"], label: "بستن/باز کردن منو" },
    ],
  },
];

export function ShortcutsModal() {
  const { isShortcutsOpen, setShortcutsOpen } = useAppStore();

  // ? key to open, Esc to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Only trigger on `?` (Shift + /) when not typing in an input
      if (e.key === "?" && !isTypingTarget(e.target)) {
        e.preventDefault();
        setShortcutsOpen(!isShortcutsOpen);
        return;
      }
      if (e.key === "Escape" && isShortcutsOpen) {
        setShortcutsOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isShortcutsOpen, setShortcutsOpen]);

  return (
    <AnimatePresence>
      {isShortcutsOpen && (
        <div className="fixed inset-0 z-[85] flex items-start justify-center pt-[10vh]">
          {/* Backdrop */}
          <motion.div
            variants={modalBackdrop}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.15, ease: "linear" }}
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setShortcutsOpen(false)}
          />

          {/* Modal */}
          <motion.div
            variants={modalContent}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ type: "spring", stiffness: 300, damping: 26, mass: 1 }}
            className="relative w-full max-w-[640px] mx-4 n-glass-popover overflow-hidden"
            style={{ transformOrigin: "top center" }}
            role="dialog"
            aria-label="میانبرهای صفحه‌کلید"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 h-14 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="flex size-7 items-center justify-center rounded-md bg-accent-soft">
                  <Keyboard className="size-4 text-accent" strokeWidth={2} />
                </div>
                <h2 className="text-[14px] font-[700] text-ink-primary tracking-tight">میانبرهای صفحه‌کلید</h2>
              </div>
              <button
                onClick={() => setShortcutsOpen(false)}
                className="rounded-md p-1.5 text-ink-tertiary hover:bg-surface-hover hover:text-ink-secondary transition-colors n-focus-ring"
                aria-label="بستن"
              >
                <X className="size-4" strokeWidth={2} />
              </button>
            </div>

            {/* Shortcut groups */}
            <div className="p-5 max-h-[60vh] overflow-y-auto thin-scrollbar">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
                {SHORTCUT_GROUPS.map((group) => (
                  <div key={group.title}>
                    <h3 className="text-[10px] font-[700] uppercase tracking-[0.1em] text-ink-tertiary mb-3">
                      {group.title}
                    </h3>
                    <ul className="space-y-2.5">
                      {group.items.map((item, i) => (
                        <li key={i} className="flex items-center justify-between gap-3">
                          <span className="text-[12.5px] text-ink-secondary">{item.label}</span>
                          <span className="flex items-center gap-1 shrink-0">
                            {item.keys.map((key, ki) => (
                              <kbd
                                key={ki}
                                className="min-w-[20px] h-[20px] inline-flex items-center justify-center px-1.5 rounded border border-border bg-surface-hover text-[10px] font-[600] text-ink-secondary num-tabular"
                              >
                                {key}
                              </kbd>
                            ))}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-5 h-10 border-t border-border text-[10.5px] text-ink-tertiary">
              <span>برای بستن، Esc را بزنید</span>
              <span className="flex items-center gap-1">
                <kbd className="px-1 rounded border border-border bg-surface-hover">?</kbd>
                برای باز کردن
              </span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || target.isContentEditable;
}
