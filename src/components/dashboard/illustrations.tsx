'use client'

import { type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { useShouldAnimate } from '@/lib/motion'

/* ============================================================================
   CUSTOM SVG ILLUSTRATIONS — for view-level empty states
   Single accent color, thin strokes, subtle motion on mount.
   Replaces icon-in-circle with proper illustrated art.
   Each illustration is 120×120, uses currentColor for accent.
   ============================================================================ */

interface IllustrationProps {
  className?: string
}

const containerMotion = {
  initial: { opacity: 0, scale: 0.9 },
  animate: { opacity: 1, scale: 1, transition: { duration: 0.4, ease: [0, 0, 0.2, 1] } },
}

function FloatGroup({ children }: { children: ReactNode }) {
  const shouldAnimate = useShouldAnimate()
  return (
    <motion.g
      animate={{ y: [0, -4, 0] }}
      transition={{ duration: 3, repeat: shouldAnimate ? Infinity : 0, ease: 'easeInOut' }}
    >
      {children}
    </motion.g>
  )
}

/** Inbox illustration — envelope with floating notification dots */
export function InboxIllustration({ className = '' }: IllustrationProps) {
  return (
    <motion.svg
      {...(containerMotion as any)}
      viewBox="0 0 120 120"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-hidden
    >
      {/* Halo */}
      <circle cx="60" cy="60" r="48" fill="var(--n-accent-soft)" opacity="0.5" />
      {/* Envelope body */}
      <FloatGroup>
        <rect
          x="32"
          y="44"
          width="56"
          height="38"
          rx="6"
          fill="var(--n-surface)"
          stroke="var(--n-accent)"
          strokeWidth="1.5"
        />
        <path
          d="M32 50 L60 68 L88 50"
          stroke="var(--n-accent)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <path
          d="M32 82 L52 64 M88 82 L68 64"
          stroke="var(--n-accent)"
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.4"
        />
      </FloatGroup>
      {/* Floating notification dots */}
      <motion.circle
        cx="84"
        cy="36"
        r="5"
        fill="var(--n-accent)"
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.3, duration: 0.3, ease: [0.34, 1.56, 0.64, 1] }}
      />
      <motion.circle
        cx="92"
        cy="40"
        r="2.5"
        fill="var(--n-accent)"
        opacity="0.5"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.5 }}
        transition={{ delay: 0.5 }}
      />
      {/* Decorative dots */}
      <circle cx="28" cy="30" r="1.5" fill="var(--n-accent)" opacity="0.3" />
      <circle cx="96" cy="76" r="1.5" fill="var(--n-accent)" opacity="0.25" />
    </motion.svg>
  )
}

/** Content library illustration — stacked documents */
export function ContentIllustration({ className = '' }: IllustrationProps) {
  return (
    <motion.svg
      {...(containerMotion as any)}
      viewBox="0 0 120 120"
      className={className}
      fill="none"
      role="img"
      aria-hidden
    >
      <circle cx="60" cy="60" r="48" fill="var(--n-accent-soft)" opacity="0.5" />
      {/* Back document */}
      <FloatGroup>
        <rect
          x="38"
          y="34"
          width="40"
          height="50"
          rx="4"
          fill="var(--n-surface)"
          stroke="var(--n-accent)"
          strokeWidth="1.5"
          opacity="0.4"
          transform="rotate(-6 58 59)"
        />
        {/* Front document */}
        <rect
          x="44"
          y="38"
          width="40"
          height="50"
          rx="4"
          fill="var(--n-surface)"
          stroke="var(--n-accent)"
          strokeWidth="1.5"
          transform="rotate(4 64 63)"
        />
        {/* Lines on front doc */}
        <line
          x1="52"
          y1="48"
          x2="76"
          y2="48"
          stroke="var(--n-accent)"
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.5"
          transform="rotate(4 64 63)"
        />
        <line
          x1="52"
          y1="56"
          x2="72"
          y2="56"
          stroke="var(--n-accent)"
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.4"
          transform="rotate(4 64 63)"
        />
        <line
          x1="52"
          y1="64"
          x2="76"
          y2="64"
          stroke="var(--n-accent)"
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.5"
          transform="rotate(4 64 63)"
        />
        <line
          x1="52"
          y1="72"
          x2="68"
          y2="72"
          stroke="var(--n-accent)"
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.3"
          transform="rotate(4 64 63)"
        />
      </FloatGroup>
      <circle cx="30" cy="34" r="1.5" fill="var(--n-accent)" opacity="0.3" />
      <circle cx="92" cy="80" r="1.5" fill="var(--n-accent)" opacity="0.25" />
    </motion.svg>
  )
}

/** Media gallery illustration — image with sparkles */
export function MediaIllustration({ className = '' }: IllustrationProps) {
  return (
    <motion.svg
      {...(containerMotion as any)}
      viewBox="0 0 120 120"
      className={className}
      fill="none"
      role="img"
      aria-hidden
    >
      <circle cx="60" cy="60" r="48" fill="var(--n-accent-soft)" opacity="0.5" />
      <FloatGroup>
        {/* Image frame */}
        <rect
          x="32"
          y="40"
          width="56"
          height="44"
          rx="6"
          fill="var(--n-surface)"
          stroke="var(--n-accent)"
          strokeWidth="1.5"
        />
        {/* Mountain + sun */}
        <circle cx="48" cy="56" r="4" fill="var(--n-accent)" opacity="0.6" />
        <path
          d="M36 78 L52 62 L62 72 L74 56 L84 78 Z"
          fill="var(--n-accent)"
          opacity="0.25"
          stroke="var(--n-accent)"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </FloatGroup>
      {/* Sparkle */}
      <motion.path
        d="M88 38 L90 42 L94 44 L90 46 L88 50 L86 46 L82 44 L86 42 Z"
        fill="var(--n-accent)"
        initial={{ opacity: 0, scale: 0, rotate: -90 }}
        animate={{ opacity: 1, scale: 1, rotate: 0 }}
        transition={{ delay: 0.3, duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
        style={{ transformOrigin: '88px 44px' }}
      />
      <circle cx="28" cy="32" r="1.5" fill="var(--n-accent)" opacity="0.3" />
      <circle cx="94" cy="72" r="1.5" fill="var(--n-accent)" opacity="0.25" />
    </motion.svg>
  )
}

/** Campaigns illustration — flag on a pole */
export function CampaignsIllustration({ className = '' }: IllustrationProps) {
  return (
    <motion.svg
      {...(containerMotion as any)}
      viewBox="0 0 120 120"
      className={className}
      fill="none"
      role="img"
      aria-hidden
    >
      <circle cx="60" cy="60" r="48" fill="var(--n-accent-soft)" opacity="0.5" />
      {/* Pole */}
      <line
        x1="44"
        y1="34"
        x2="44"
        y2="86"
        stroke="var(--n-accent)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="44" cy="34" r="2.5" fill="var(--n-accent)" />
      {/* Flag */}
      <motion.path
        d="M44 40 L80 40 L72 50 L80 60 L44 60 Z"
        fill="var(--n-accent)"
        opacity="0.2"
        stroke="var(--n-accent)"
        strokeWidth="1.5"
        strokeLinejoin="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.6, ease: [0, 0, 0.2, 1] }}
      />
      {/* Base */}
      <line
        x1="38"
        y1="86"
        x2="50"
        y2="86"
        stroke="var(--n-accent)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Stars */}
      <motion.path
        d="M78 72 L79.5 75.5 L83 77 L79.5 78.5 L78 82 L76.5 78.5 L73 77 L76.5 75.5 Z"
        fill="var(--n-accent)"
        opacity="0.5"
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 0.5, scale: 1 }}
        transition={{ delay: 0.5, duration: 0.3 }}
      />
      <circle cx="30" cy="40" r="1.5" fill="var(--n-accent)" opacity="0.3" />
      <circle cx="90" cy="86" r="1.5" fill="var(--n-accent)" opacity="0.25" />
    </motion.svg>
  )
}

/** Analytics illustration — bar chart with trend arrow */
export function AnalyticsIllustration({ className = '' }: IllustrationProps) {
  return (
    <motion.svg
      {...(containerMotion as any)}
      viewBox="0 0 120 120"
      className={className}
      fill="none"
      role="img"
      aria-hidden
    >
      <circle cx="60" cy="60" r="48" fill="var(--n-accent-soft)" opacity="0.5" />
      {/* Bars */}
      <motion.g
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ staggerChildren: 0.1, delayChildren: 0.2 }}
      >
        <motion.rect
          x="38"
          y="62"
          width="10"
          height="24"
          rx="2"
          fill="var(--n-accent)"
          opacity="0.3"
          initial={{ height: 0, y: 86 }}
          animate={{ height: 24, y: 62 }}
          transition={{ duration: 0.4, ease: [0, 0, 0.2, 1] }}
        />
        <motion.rect
          x="54"
          y="52"
          width="10"
          height="34"
          rx="2"
          fill="var(--n-accent)"
          opacity="0.5"
          initial={{ height: 0, y: 86 }}
          animate={{ height: 34, y: 52 }}
          transition={{ duration: 0.4, ease: [0, 0, 0.2, 1], delay: 0.1 }}
        />
        <motion.rect
          x="70"
          y="44"
          width="10"
          height="42"
          rx="2"
          fill="var(--n-accent)"
          initial={{ height: 0, y: 86 }}
          animate={{ height: 42, y: 44 }}
          transition={{ duration: 0.4, ease: [0, 0, 0.2, 1], delay: 0.2 }}
        />
      </motion.g>
      {/* Trend arrow */}
      <motion.path
        d="M38 54 L56 46 L72 50 L86 36"
        stroke="var(--n-accent)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ delay: 0.6, duration: 0.5 }}
      />
      <motion.path
        d="M80 36 L86 36 L86 42"
        stroke="var(--n-accent)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.1 }}
      />
      {/* Base line */}
      <line
        x1="32"
        y1="86"
        x2="88"
        y2="86"
        stroke="var(--n-accent)"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.4"
      />
      <circle cx="30" cy="34" r="1.5" fill="var(--n-accent)" opacity="0.3" />
    </motion.svg>
  )
}

/** Calendar illustration — calendar with event markers */
export function CalendarIllustration({ className = '' }: IllustrationProps) {
  return (
    <motion.svg
      {...(containerMotion as any)}
      viewBox="0 0 120 120"
      className={className}
      fill="none"
      role="img"
      aria-hidden
    >
      <circle cx="60" cy="60" r="48" fill="var(--n-accent-soft)" opacity="0.5" />
      <FloatGroup>
        {/* Calendar body */}
        <rect
          x="34"
          y="40"
          width="52"
          height="44"
          rx="6"
          fill="var(--n-surface)"
          stroke="var(--n-accent)"
          strokeWidth="1.5"
        />
        {/* Top bar */}
        <rect x="34" y="40" width="52" height="12" rx="6" fill="var(--n-accent)" opacity="0.15" />
        {/* Rings */}
        <line
          x1="46"
          y1="34"
          x2="46"
          y2="44"
          stroke="var(--n-accent)"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <line
          x1="74"
          y1="34"
          x2="74"
          y2="44"
          stroke="var(--n-accent)"
          strokeWidth="2"
          strokeLinecap="round"
        />
        {/* Grid dots */}
        <circle cx="44" cy="62" r="2" fill="var(--n-accent)" opacity="0.3" />
        <circle cx="60" cy="62" r="2" fill="var(--n-accent)" opacity="0.3" />
        <circle cx="76" cy="62" r="2" fill="var(--n-accent)" opacity="0.3" />
        <circle cx="44" cy="74" r="2" fill="var(--n-accent)" opacity="0.5" />
        <motion.circle
          cx="60"
          cy="74"
          r="3"
          fill="var(--n-accent)"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
        />
        <circle cx="76" cy="74" r="2" fill="var(--n-accent)" opacity="0.3" />
      </FloatGroup>
      <circle cx="28" cy="38" r="1.5" fill="var(--n-accent)" opacity="0.3" />
      <circle cx="94" cy="82" r="1.5" fill="var(--n-accent)" opacity="0.25" />
    </motion.svg>
  )
}

/** Channels illustration — linked nodes */
export function ChannelsIllustration({ className = '' }: IllustrationProps) {
  return (
    <motion.svg
      {...(containerMotion as any)}
      viewBox="0 0 120 120"
      className={className}
      fill="none"
      role="img"
      aria-hidden
    >
      <circle cx="60" cy="60" r="48" fill="var(--n-accent-soft)" opacity="0.5" />
      {/* Connection lines */}
      <motion.line
        x1="44"
        y1="46"
        x2="60"
        y2="60"
        stroke="var(--n-accent)"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.4"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ delay: 0.2, duration: 0.3 }}
      />
      <motion.line
        x1="60"
        y1="60"
        x2="80"
        y2="48"
        stroke="var(--n-accent)"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.4"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ delay: 0.4, duration: 0.3 }}
      />
      <motion.line
        x1="60"
        y1="60"
        x2="72"
        y2="80"
        stroke="var(--n-accent)"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.4"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ delay: 0.5, duration: 0.3 }}
      />
      {/* Nodes */}
      <motion.circle
        cx="44"
        cy="46"
        r="8"
        fill="var(--n-surface)"
        stroke="var(--n-accent)"
        strokeWidth="1.5"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.1, ease: [0.34, 1.56, 0.64, 1] }}
      />
      <motion.circle
        cx="60"
        cy="60"
        r="10"
        fill="var(--n-accent)"
        stroke="var(--n-accent)"
        strokeWidth="1.5"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.3, ease: [0.34, 1.56, 0.64, 1] }}
      />
      <motion.circle
        cx="80"
        cy="48"
        r="8"
        fill="var(--n-surface)"
        stroke="var(--n-accent)"
        strokeWidth="1.5"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
      />
      <motion.circle
        cx="72"
        cy="80"
        r="7"
        fill="var(--n-surface)"
        stroke="var(--n-accent)"
        strokeWidth="1.5"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.6, ease: [0.34, 1.56, 0.64, 1] }}
      />
      <circle cx="30" cy="36" r="1.5" fill="var(--n-accent)" opacity="0.3" />
      <circle cx="92" cy="84" r="1.5" fill="var(--n-accent)" opacity="0.25" />
    </motion.svg>
  )
}

/** Generic search/no-results illustration — magnifying glass */
export function SearchIllustration({ className = '' }: IllustrationProps) {
  return (
    <motion.svg
      {...(containerMotion as any)}
      viewBox="0 0 120 120"
      className={className}
      fill="none"
      role="img"
      aria-hidden
    >
      <circle cx="60" cy="60" r="48" fill="var(--n-accent-soft)" opacity="0.5" />
      <FloatGroup>
        <circle
          cx="54"
          cy="54"
          r="16"
          fill="var(--n-surface)"
          stroke="var(--n-accent)"
          strokeWidth="2"
        />
        <line
          x1="66"
          y1="66"
          x2="80"
          y2="80"
          stroke="var(--n-accent)"
          strokeWidth="3"
          strokeLinecap="round"
        />
        {/* Question mark inside */}
        <text
          x="54"
          y="60"
          textAnchor="middle"
          fontSize="16"
          fill="var(--n-accent)"
          fontWeight="700"
          fontFamily="inherit"
        >
          ؟
        </text>
      </FloatGroup>
      <circle cx="30" cy="38" r="1.5" fill="var(--n-accent)" opacity="0.3" />
      <circle cx="92" cy="78" r="1.5" fill="var(--n-accent)" opacity="0.25" />
    </motion.svg>
  )
}

/** Map illustration key → component */
export const ILLUSTRATIONS = {
  inbox: InboxIllustration,
  content: ContentIllustration,
  media: MediaIllustration,
  campaigns: CampaignsIllustration,
  analytics: AnalyticsIllustration,
  calendar: CalendarIllustration,
  channels: ChannelsIllustration,
  search: SearchIllustration,
} as const

export type IllustrationKey = keyof typeof ILLUSTRATIONS
