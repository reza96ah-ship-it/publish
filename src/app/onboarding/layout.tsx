import type { ReactNode } from 'react'

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="h-dvh overflow-y-auto thin-scrollbar bg-canvas">
      {children}
    </div>
  )
}
