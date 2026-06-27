"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="bottom-center"
      expand={true}
      richColors
      closeButton
      // Swipe-to-dismiss with velocity threshold
      swipeDirections={["left", "right", "up"] as any}
      style={
        {
          "--normal-bg": "var(--n-glass-popover-bg)",
          "--normal-text": "var(--n-text-primary)",
          "--normal-border": "var(--n-glass-border)",
          "--border-radius": "var(--radius-lg)",
          "--font-family": "var(--font-sans)",
          "--toast-shadow": "var(--n-shadow-popover)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "n-glass-popover !border-0.5 !shadow-lg",
          title: "text-[13px] font-[600]",
          description: "text-[11.5px]",
          actionButton: "bg-accent text-white hover:bg-accent-hover",
          cancelButton: "bg-surface-hover text-ink-secondary hover:bg-surface-subtle",
          closeButton: "text-ink-tertiary hover:text-ink-primary",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
