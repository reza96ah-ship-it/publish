"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { AlertOctagon, RefreshCw } from "lucide-react";

/**
 * global-error.tsx — the LAST line of defense.
 * Catches errors that error.tsx cannot (e.g. root layout errors).
 * MUST render its own <html> and <body> tags.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[نشرینو] Global error boundary:", error);
  }, [error]);

  return (
    <html lang="fa" dir="rtl">
      <body
        style={{
          margin: 0,
          fontFamily: "Vazirmatn, system-ui, sans-serif",
          background: "oklch(0.975 0.004 280)",
          color: "oklch(0.18 0.014 280)",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.3, ease: [0.2, 0, 0, 1] }}
          style={{
            maxWidth: "420px",
            width: "100%",
            background: "#fff",
            border: "1px solid oklch(0.915 0.004 280)",
            borderRadius: "12px",
            padding: "32px",
            textAlign: "center",
            boxShadow:
              "0 1px 2px oklch(0.20 0.02 280 / 0.04), 0 4px 8px oklch(0.20 0.02 280 / 0.04)",
          }}
        >
          <div
            style={{
              width: "56px",
              height: "56px",
              margin: "0 auto 20px",
              borderRadius: "50%",
              background: "oklch(0.97 0.028 25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <AlertOctagon size={28} color="oklch(0.56 0.19 25)" strokeWidth={2} />
          </div>
          <h2 style={{ fontSize: "17px", fontWeight: 700, margin: "0 0 8px" }}>
            خطای بحرانی
          </h2>
          <p style={{ fontSize: "13px", color: "oklch(0.44 0.011 280)", margin: "0 0 4px" }}>
            خطایی غیرقابل بازیابی در برنامه رخ داد.
          </p>
          <p
            style={{
              fontSize: "11px",
              color: "oklch(0.56 0.009 280)",
              margin: "0 0 24px",
              fontFamily: "monospace",
            }}
            dir="ltr"
          >
            {error.digest && `شناسه: ${error.digest}`}
          </p>
          <button
            onClick={reset}
            style={{
              display: "inline-flex",
              height: "40px",
              alignItems: "center",
              gap: "8px",
              borderRadius: "8px",
              background: "oklch(0.52 0.20 295)",
              color: "#fff",
              border: "none",
              padding: "0 16px",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <RefreshCw size={16} strokeWidth={2.5} />
            تلاش مجدد
          </button>
        </motion.div>
      </body>
    </html>
  );
}
