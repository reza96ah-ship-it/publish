"use client";

import { useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Coffee, Mail, Lock, Loader2, ArrowLeft } from "lucide-react";

export default function SignInPage() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Native form POST to NextAuth's credentials callback.
    // We bypass next-auth/react's signIn() function because it reads the
    // next-auth.callback-url cookie (set to http://localhost:3000 by the
    // CSRF endpoint) and redirects to that absolute URL — which the user's
    // browser can't reach when the app is behind the Z.ai preview gateway.
    // With a native form POST, the browser follows the server's Location
    // header (which our redirect callback returns as relative "/").
    try {
      const res = await fetch("/api/auth/callback/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          email,
          password,
          csrfToken: await getCsrfToken(),
          callbackUrl: "/",
          json: "true",
        }),
        redirect: "manual", // Don't follow redirects — we handle manually
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.url) {
        // data.url is "/" (relative) from our redirect callback.
        // Use window.location.assign for a full page navigation (not
        // router.push) to ensure the session cookie is picked up.
        const target = data.url.startsWith("http")
          ? new URL(data.url).pathname // strip host, keep path only
          : data.url;
        window.location.assign(target);
      } else {
        // Login failed — NextAuth returns redirect to signin with error
        setError("ایمیل یا رمز عبور نادرست است");
        setLoading(false);
      }
    } catch (err) {
      setError("خطا در ارتباط با سرور");
      setLoading(false);
    }
  };

  async function getCsrfToken() {
    const res = await fetch("/api/auth/csrf");
    const data = await res.json();
    return data.csrfToken;
  }

  return (
    <div className="min-h-dvh flex items-center justify-center p-6 bg-canvas">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0, 0, 0.2, 1] }}
        className="w-full max-w-[400px]"
      >
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex size-14 items-center justify-center rounded-xl bg-accent shadow-lg shadow-accent/20 mb-4">
            <Coffee className="size-7 text-white" strokeWidth={2} />
          </div>
          <h1 className="text-[22px] font-[700] text-ink-primary tracking-tight">نشرینو</h1>
          <p className="text-[12px] text-ink-tertiary mt-1">استودیوی عملیات شبکه‌های اجتماعی</p>
        </div>

        {/* Form card */}
        <div className="n-card p-6">
          <h2 className="text-[15px] font-[600] text-ink-primary mb-1">ورود به حساب</h2>
          <p className="text-[11.5px] text-ink-tertiary mb-5">برای ادامه وارد حساب کاربری خود شوید</p>

          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="mb-4 rounded-lg border border-danger/20 bg-danger-soft px-3 py-2.5"
            >
              <p className="text-[12px] text-danger font-[500]">{error}</p>
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="text-[12px] font-[600] text-ink-secondary mb-1.5 block">ایمیل</label>
              <div className="relative">
                <Mail className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-ink-tertiary pointer-events-none" />
                <input
                  type="email"
                  dir="ltr"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="n-control w-full h-10 pr-10 pl-3 text-[13px] text-ink-primary placeholder:text-ink-tertiary"
                  autoComplete="email"
                  autoFocus
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="text-[12px] font-[600] text-ink-secondary mb-1.5 block">رمز عبور</label>
              <div className="relative">
                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-ink-tertiary pointer-events-none" />
                <input
                  type="password"
                  dir="ltr"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="n-control w-full h-10 pr-10 pl-3 text-[13px] text-ink-primary placeholder:text-ink-tertiary"
                  autoComplete="current-password"
                />
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="n-focus-ring w-full h-10 rounded-lg bg-accent text-[13px] font-[600] text-white transition-colors hover:bg-accent-hover disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin" strokeWidth={2.5} />
              ) : (
                <>
                  ورود
                  <ArrowLeft className="size-4" strokeWidth={2.5} />
                </>
              )}
            </button>
          </form>

          {/* Demo credentials hint */}
          <div className="mt-5 pt-4 border-t border-border">
            <p className="text-[10.5px] text-ink-tertiary text-center">
              دمو: <span className="num-tabular font-[600]" dir="ltr">demo@nashrino.ir</span> / <span className="num-tabular font-[600]" dir="ltr">demo1234</span>
            </p>
          </div>
        </div>

        <p className="text-center text-[10.5px] text-ink-tertiary mt-6">
          نشرینو © ۱۴۰۴ — سامانه مدیریت انتشار شبکه‌های اجتماعی
        </p>
      </motion.div>
    </div>
  );
}
