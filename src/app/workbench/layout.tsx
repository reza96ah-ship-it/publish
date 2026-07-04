import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'

export default function WorkbenchLayout({ children }: { children: ReactNode }) {
  if (process.env.NODE_ENV === 'production') {
    notFound()
  }
  return (
    <div className="min-h-dvh bg-canvas text-ink-primary" dir="rtl">
      <div className="border-b border-border bg-surface px-6 py-3 flex items-center gap-3">
        <span className="text-lg font-bold text-accent">Nashrino</span>
        <span className="text-base text-ink-secondary">Component Workbench</span>
        <span className="ms-auto text-xs text-warning bg-warning-soft px-2 py-0.5 rounded-full">DEV ONLY</span>
      </div>
      <div className="max-w-5xl mx-auto px-6 py-8">
        {children}
      </div>
    </div>
  )
}
