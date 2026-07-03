'use client'

import { type Variants, type Transition, type TargetAndTransition } from 'framer-motion'
import { useReducedMotion, MotionConfig } from 'framer-motion'
import { type ReactNode } from 'react'

/* ============================================================================
   MOTION SYSTEM — Linear/Vercel-grade animation primitives
   Based on RESEARCH-3: asymmetric timing, composite properties only,
   sub-100ms for micro, 200ms standard, spring for interactive.
   Aligned with CSS tokens in globals.css (--motion-* / --ease-*) so JS
   animations and CSS transitions share the same timing vocabulary.
   ============================================================================ */

// Easing curves — asymmetric: ease-out for enter, ease-in for exit
// These mirror the CSS custom properties: --ease-enter, --ease-exit, etc.
export const ease = {
  enter: [0, 0, 0.2, 1] as const, // ease-out — elements appearing (CSS: --ease-enter)
  exit: [0.4, 0, 1, 1] as const, // ease-in — elements leaving (CSS: --ease-exit)
  standard: [0.4, 0, 0.2, 1] as const, // ease-in-out — moving (CSS: --ease-standard)
  snap: [0.12, 0, 0.08, 1] as const, // snappy — toggles, instant (CSS: --ease-snap)
  announce: [0.34, 1.56, 0.64, 1] as const, // spring — entrances, popovers (CSS: --ease-spring)
  emphasized: [0.2, 0, 0, 1] as const, // emphasized — page transitions (CSS: --ease-emphasized)
} as const

// Duration tokens (Linear-style: quick → regular → slow)
// These mirror the CSS custom properties: --motion-quick, --motion-fast, etc.
export const duration = {
  instant: 0, // reduced-motion fallback (CSS: --motion-instant)
  micro: 0.1, // hover, focus (CSS: --motion-quick)
  quick: 0.15, // popover open, toggle (CSS: --motion-fast)
  standard: 0.2, // page transition, list item (CSS: --motion-normal)
  slow: 0.3, // modal, sheet (CSS: --motion-slow)
  deliberate: 0.4, // dramatic (CSS: --motion-deliberate)
} as const

// Spring presets
export const spring = {
  popover: { type: 'spring' as const, stiffness: 400, damping: 30, mass: 0.8 },
  modal: { type: 'spring' as const, stiffness: 300, damping: 26, mass: 1 },
  sheet: { type: 'spring' as const, stiffness: 350, damping: 32, mass: 1 },
  badge: { type: 'spring' as const, stiffness: 400, damping: 25, mass: 0.8 },
  gentle: { type: 'spring' as const, stiffness: 200, damping: 28, mass: 1 },
} as const

/* ---- Page transition (view switch) ---- */
export const pageTransition: Record<'initial' | 'animate' | 'exit', TargetAndTransition> = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
}

export const pageTransitionProps: Transition = {
  duration: duration.standard,
  ease: ease.enter,
}

/* ---- List stagger (items appearing in sequence) ---- */
export const listContainer: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.04, delayChildren: 0.05 },
  },
}

export const listItem: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: duration.standard, ease: ease.enter },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: { duration: duration.quick, ease: ease.exit },
  },
}

/* ---- Popover spring (dropdowns, bell popover) ---- */
export const popoverVariants: Variants = {
  initial: { opacity: 0, scale: 0.96, y: -4 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.98, y: -2 },
}

export const popoverTransition: Transition = {
  duration: duration.quick,
  ease: ease.announce,
}

/* ---- Modal/sheet ---- */
export const modalBackdrop: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
}

export const modalContent: Variants = {
  initial: { opacity: 0, scale: 0.96, y: 12 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.96, y: 8 },
}

/* ---- Skeleton → content fade ---- */
export const skeletonFade: Variants = {
  initial: { opacity: 1 },
  exit: { opacity: 0, transition: { duration: duration.micro, ease: 'linear' } },
}

export const contentFadeIn: Variants = {
  initial: { opacity: 0, y: 4 },
  animate: { opacity: 1, y: 0, transition: { duration: duration.standard, ease: ease.announce } },
}

/**
 * useReducedMotionTransition — returns a Transition that respects
 * prefers-reduced-motion. When reduced motion is preferred, returns
 * an instant (0-duration) transition so animations are effectively disabled.
 *
 * Usage:
 *   const t = useReducedMotionTransition();
 *   <motion.div transition={t("standard")} />
 *
 * Or for the global MotionConfig:
 *   import { MotionConfig } from "framer-motion";
 *   <MotionConfig reducedMotion="user">...</MotionConfig>
 */
export function useReducedMotionTransition() {
  const prefersReduced = useReducedMotion()
  return (key: keyof typeof duration = 'standard'): Transition => {
    if (prefersReduced) {
      return { duration: 0, ease: 'linear' }
    }
    return { duration: duration[key], ease: ease.enter }
  }
}

/**
 * useShouldAnimate — boolean flag for conditional animation.
 * Returns false when prefers-reduced-motion is active.
 * Use to skip mounting heavy animation trees (e.g. ambient mesh, count-up).
 */
export function useShouldAnimate() {
  return !useReducedMotion()
}

/**
 * MotionProvider — wraps the app in a MotionConfig that automatically
 * respects the user's OS-level `prefers-reduced-motion` setting.
 * When reduced motion is preferred, framer-motion transforms (x/y/scale)
 * are instantly applied without animation.
 *
 * This is the global gate recommended by WCAG 2.3.3 (Animation from Interactions).
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <MotionConfig
      reducedMotion="user"
      transition={{ ease: ease.enter, duration: duration.standard }}
    >
      {children}
    </MotionConfig>
  )
}

/* ---- KPI count-up animation hook ---- */
import { useState, useEffect } from 'react'
import { toPersianDigits } from '@/lib/jalali'

export function useCountUp(target: number, durationMs = 800, enabled = true) {
  const [value, setValue] = useState(0)
  const shouldReduceMotion = useReducedMotion()
  const active = enabled && !shouldReduceMotion

  useEffect(() => {
    if (!active) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setValue(target)
      return
    }
    let raf: number
    const start = performance.now()
    const from = 0
    const animate = (now: number) => {
      const t = Math.min((now - start) / durationMs, 1)
      const eased = 1 - Math.pow(1 - t, 3) // ease-out cubic
      setValue(from + (target - from) * eased)
      if (t < 1) raf = requestAnimationFrame(animate)
    }
    raf = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(raf)
  }, [target, durationMs, active])

  return value
}

/** CountUp component — renders Persian digits with count-up animation on mount */
export function CountUp({
  value,
  duration = 800,
  compact = false,
  className = '',
}: {
  value: number
  duration?: number
  compact?: boolean
  className?: string
}) {
  const v = useCountUp(value, duration)
  const rounded = Math.round(v)

  if (compact) {
    if (rounded >= 1_000_000) {
      return (
        <span className={`num-tabular ${className}`}>
          {toPersianDigits((rounded / 1_000_000).toFixed(1))}M
        </span>
      )
    }
    if (rounded >= 1_000) {
      return (
        <span className={`num-tabular ${className}`}>
          {toPersianDigits((rounded / 1_000).toFixed(1))}K
        </span>
      )
    }
  }

  return (
    <span className={`num-tabular ${className}`}>
      {toPersianDigits(rounded.toLocaleString('en-US'))}
    </span>
  )
}

/* ---- Tab underline (layoutId shared element) ---- */
export const tabUnderlineTransition: Transition = {
  type: 'spring',
  stiffness: 400,
  damping: 30,
}
