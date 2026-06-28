import Link from 'next/link'
import { Compass } from 'lucide-react'

/**
 * not-found.tsx — 404 page for the App Router.
 * Catches unmatched routes and renders a Persian RTL not-found state.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="n-card max-w-md w-full p-8 text-center">
        <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-full bg-accent-soft">
          <Compass className="size-7 text-accent" strokeWidth={2} />
        </div>
        <h2 className="text-[17px] font-[700] text-ink-primary mb-2 tracking-tight">
          صفحه پیدا نشد
        </h2>
        <p className="text-[13px] text-ink-secondary leading-relaxed mb-6">
          آدرسی که دنبال آن هستید وجود ندارد یا منتقل شده است.
        </p>
        <Link
          href="/"
          className="n-focus-ring inline-flex h-10 items-center gap-2 rounded-lg bg-accent px-4 text-[13px] font-[600] text-white transition-colors hover:bg-accent-hover"
        >
          بازگشت به داشبورد
        </Link>
      </div>
    </div>
  )
}
