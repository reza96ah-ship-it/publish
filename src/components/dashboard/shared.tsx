'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { type LucideIcon, AlertCircle, RefreshCw } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useShouldAnimate } from '@/lib/motion'
import { toPersianDigits, formatCompact } from '@/lib/jalali'
import { cn } from '@/lib/utils'
import { PlatformLogo } from '@/components/ui/platform-logo'
import { ILLUSTRATIONS, type IllustrationKey } from '@/components/dashboard/illustrations'
import { type ProviderSupportLevel } from '@/lib/provider-capabilities'

/* ============================================================================
   SHARED DASHBOARD COMPONENTS v4
   Solid surfaces for content. Refined typography. Tabular numbers.
   + Skeleton system (NN/G-compliant)
   + Enhanced EmptyState with custom SVG illustrations
   + AnimatedTabs with layoutId
   ============================================================================ */

/** StatusBadge — refined semantic pill with consistent sizing */
export function StatusBadge({ label, variant }: { label: string; variant: string }) {
  const map: Record<string, string> = {
    published: 'text-success bg-success-soft border-success/20',
    draft: 'text-ink-secondary bg-surface-hover border-border',
    scheduled: 'text-info bg-info-soft border-info/20',
    review: 'text-warning bg-warning-soft border-warning/20',
    approved: 'text-success bg-success-soft border-success/20',
    confirmed: 'text-success bg-success-soft border-success/20',
    pending: 'text-warning bg-warning-soft border-warning/20',
    ready: 'text-success bg-success-soft border-success/20',
    high: 'text-danger bg-danger-soft border-danger/20',
    medium: 'text-warning bg-warning-soft border-warning/20',
    low: 'text-ink-tertiary bg-surface-hover border-border',
  }
  return (
    <span
      className={`inline-flex items-center text-2xs font-semibold px-1.5 py-0.5 rounded-md border ${map[variant] ?? map.draft}`}
    >
      {label}
    </span>
  )
}

/**
 * Issue #150: ProviderSupportBadge — show certified / beta / experimental
 * next to any provider or channel selection surface.
 */
export function ProviderSupportBadge({ level }: { level: ProviderSupportLevel }) {
  const label =
    level === 'certified' ? 'تأییدشده' : level === 'beta' ? 'بتا' : 'آزمایشی'
  const cls =
    level === 'certified'
      ? 'border-success/30 bg-success/10 text-success'
      : level === 'beta'
        ? 'border-warning/30 bg-warning/10 text-warning'
        : 'border-border bg-surface-subtle text-ink-tertiary'
  return (
    <span
      className={cn(
        'text-2xs font-bold px-1.5 py-0.5 rounded-full border inline-flex items-center',
        cls
      )}
      title={`سطح پشتیبانی: ${label}`}
    >
      {label}
    </span>
  )
}

/** PlatformBadge — real brand logo + Persian label, refined pill */
export function PlatformBadge({ platform }: { platform: string }) {
  const labels: Record<string, string> = {
    instagram: 'اینستاگرام',
    telegram: 'تلگرام',
    linkedin: 'لینکدین',
    rubika: 'روبیکا',
    eitaa: 'ایتا',
  }
  const label = labels[platform] ?? platform
  return (
    <span className="inline-flex items-center gap-1.5 text-2xs font-semibold px-1.5 py-0.5 rounded-md border border-border bg-surface-hover text-ink-secondary">
      <PlatformLogo platform={platform} className="size-3" />
      {label}
    </span>
  )
}

/** PlatformDot — real mini-logo */
export function PlatformDot({ platform }: { platform: string }) {
  return (
    <span className="inline-flex items-center justify-center">
      <PlatformLogo platform={platform} className="size-4" />
    </span>
  )
}

export function PlatformIcon({
  platform,
  className = 'size-4',
}: {
  platform: string
  className?: string
}) {
  return <PlatformLogo platform={platform} className={className} />
}

/** SectionTitle — page-level heading with icon chip */
export function SectionTitle({
  icon: Icon,
  children,
  badge,
}: {
  icon: LucideIcon
  children: React.ReactNode
  badge?: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-2.5 mb-5">
      <div className="flex size-8 items-center justify-center rounded-md bg-accent-soft">
        <Icon className="size-[16px] text-accent" strokeWidth={2} />
      </div>
      <h1 className="text-xl font-bold text-ink-primary tracking-tight leading-tight">
        {children}
      </h1>
      {badge}
    </div>
  )
}

/** PanelHeader — section header inside a card. Refined hierarchy. */
export function PanelHeader({
  icon: Icon,
  title,
  subtitle,
  action,
}: {
  icon: LucideIcon
  title: string
  subtitle?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2.5">
        <div className="flex size-7 items-center justify-center rounded-md bg-accent-soft">
          <Icon className="size-[14px] text-accent" strokeWidth={2} />
        </div>
        <div className="leading-tight">
          <h2 className="text-sm font-bold text-ink-primary tracking-tight">{title}</h2>
          {subtitle && (
            <p className="text-xs text-ink-tertiary mt-0.5 leading-tight">{subtitle}</p>
          )}
        </div>
      </div>
      {action}
    </div>
  )
}

/** LinkAction — inline text action link */
export function LinkAction({
  onClick,
  children,
}: {
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className="n-focus-ring inline-flex min-h-[44px] items-center rounded text-xs font-semibold text-accent hover:text-accent-hover transition-colors"
    >
      {children}
    </button>
  )
}

/** Card — primary solid content surface */
export function Card({
  children,
  className = '',
  title,
  action,
}: {
  children: React.ReactNode
  className?: string
  title?: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className={`n-card p-5 ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between mb-4">
          {title && (
            <h2 className="text-sm font-bold text-ink-primary tracking-tight">{title}</h2>
          )}
          {action}
        </div>
      )}
      {children}
    </div>
  )
}

/** Trend — up/down indicator with semantic color and arrow */
export function Trend({ value, showArrow = true }: { value: number; showArrow?: boolean }) {
  const up = value >= 0
  const arrow = up ? '▲' : '▼'
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-2xs font-bold num-tabular ${up ? 'trend-up' : 'trend-down'}`}
    >
      {showArrow && <span className="text-2xs">{arrow}</span>}
      {toPersianDigits(Math.abs(value).toFixed(1))}٪
    </span>
  )
}

/** Sparkline — refined area chart with gradient fill + entrance animation */
export function Sparkline({
  data,
  color = 'var(--color-accent)',
  height = 32,
  animate = true,
}: {
  data: number[]
  color?: string
  height?: number
  animate?: boolean
}) {
  if (!data || data.length === 0) return null
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const w = 100,
    h = height
  const pts = data
    .map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * (h - 4) - 2}`)
    .join(' ')
  const areaPts = `0,${h} ${pts} ${w},${h}`
  const gradId = `spark-${color.replace(/[^a-z0-9]/gi, '')}`
  const lastX = w
  const lastY = h - ((data[data.length - 1] - min) / range) * (h - 4) - 2
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className="overflow-visible"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.16" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.polygon
        points={areaPts}
        fill={`url(#${gradId})`}
        initial={animate ? { opacity: 0 } : false}
        animate={animate ? { opacity: 1 } : undefined}
        transition={{ duration: 0.5, ease: [0, 0, 0.2, 1], delay: 0.1 }}
      />
      <motion.polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={animate ? { pathLength: 0, opacity: 0 } : false}
        animate={animate ? { pathLength: 1, opacity: 1 } : undefined}
        transition={{ duration: 0.8, ease: [0, 0, 0.2, 1] }}
      />
      <motion.circle
        cx={lastX}
        cy={lastY}
        r={2}
        fill={color}
        initial={animate ? { scale: 0, opacity: 0 } : false}
        animate={animate ? { scale: 1, opacity: 1 } : undefined}
        transition={{ duration: 0.3, ease: [0.34, 1.56, 0.64, 1], delay: 0.7 }}
      />
    </svg>
  )
}

/* ============================================================================
   MINI CHART — full-width interactive area chart for KPI cards.
   Modern standard (Vercel / Linear / Stripe / Apple Health):
   1. SMOOTH curves via Catmull-Rom → cubic Bézier (never straight segments)
   2. HORIZONTAL PADDING so the curve breathes and first/last dots are visible
      (the old edge-to-edge line made the middle "float" without bounds)
   3. SUBTLE GRIDLINES — quartile bands give bounded context across the full
      width, not just at the left/right edges
   4. Gradient area fill (line color → transparent)
   5. Pulsing current-value dot + hover guide line + glass tooltip
   ============================================================================ */

/** Catmull-Rom spline → cubic Bézier path generator.
 *  Produces a smooth curve through all points without overshoots.
 *  This is the same technique D3's curveCatmullRom and recharts' type="monotone" use. */
function smoothPath(points: { x: number; y: number }[], tension = 1): string {
  if (points.length < 2) return ''
  if (points.length === 2) {
    return `M ${points[0].x},${points[0].y} L ${points[1].x},${points[1].y}`
  }
  let d = `M ${points[0].x},${points[0].y}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2] || points[i + 1]
    const cp1x = p1.x + ((p2.x - p0.x) / 6) * tension
    const cp1y = p1.y + ((p2.y - p0.y) / 6) * tension
    const cp2x = p2.x - ((p3.x - p1.x) / 6) * tension
    const cp2y = p2.y - ((p3.y - p1.y) / 6) * tension
    d += ` C ${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`
  }
  return d
}

export function MiniChart({
  data,
  color = 'var(--color-accent)',
  height = 64,
  formatValue,
  formatLabel,
  showBaseline = true,
}: {
  data: number[]
  color?: string
  height?: number
  formatValue?: (v: number) => string
  formatLabel?: (i: number) => string
  showBaseline?: boolean
}) {
  const shouldAnimate = useShouldAnimate()
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  // FIX 3: Measure actual pixel width via ResizeObserver → render SVG at 1:1 scale
  // (replaces viewBox=100 + preserveAspectRatio=none which caused non-uniform scaling)
  const [pixelW, setPixelW] = useState(280)

  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width
      if (w && w > 0) setPixelW(w)
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  const handleMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect()
      if (rect.width === 0) return
      const padXpx = 8 // 8px horizontal padding (matches padX below)
      const usableStart = padXpx
      const usableEnd = rect.width - padXpx
      const usable = usableEnd - usableStart
      const ratio = (e.clientX - rect.left - usableStart) / usable
      const last = (data?.length ?? 0) - 1
      const idx = Math.round(ratio * last)
      setHoverIdx(Math.max(0, Math.min(last, idx)))
    },
    [data]
  )

  const fmt = formatValue ?? ((v: number) => toPersianDigits(formatCompact(v)))

  // Single data point — honest flat line + dot
  if (!data || data.length < 2) {
    const single = data?.length === 1 ? data[0] : 0
    const midY = height / 2
    return (
      <div
        className="relative w-full"
        style={{ height }}
        role="img"
        aria-label={data?.length === 1 ? `مقدار فعلی ${fmt(single)}` : 'داده‌ای ثبت نشده'}
      >
        <div
          className="absolute inset-x-0 border-t border-dashed border-ink-tertiary/45"
          style={{ top: midY }}
          aria-hidden
        />
        {data?.length === 1 && (
          <>
            <div
              className="absolute h-px"
              style={{ left: '8px', right: '8px', top: midY, background: color, opacity: 0.5 }}
              aria-hidden
            />
            <div
              className="absolute size-1.5 rounded-full"
              style={{ right: '8px', top: midY, transform: 'translateY(-50%)', background: color }}
              aria-hidden
            />
          </>
        )}
      </div>
    )
  }

  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const avg = data.reduce((s, v) => s + v, 0) / data.length
  // FIX 3: Use actual measured pixel width (1:1 rendering, no distortion)
  const w = pixelW
  const h = height
  // Padding: vertical (keep peaks from clipping) + horizontal (curve breathes, dots visible)
  const padY = 10
  const padX = 8 // 8px horizontal inset (pixel-based, not percentage)
  const innerW = w - padX * 2
  const xFor = (i: number) => padX + (i / (data.length - 1)) * innerW
  const yFor = (v: number) => h - ((v - min) / range) * (h - padY * 2) - padY

  const pts = data.map((v, i) => ({ x: xFor(i), y: yFor(v) }))
  const linePath = smoothPath(pts, 1)
  const areaPath = `${linePath} L ${pts[pts.length - 1].x.toFixed(2)},${h} L ${pts[0].x.toFixed(2)},${h} Z`
  const gradId = `mc-${color.replace(/[^a-z0-9]/gi, '')}`
  const lastIdx = data.length - 1
  const avgY = yFor(avg)
  const lastY = yFor(data[lastIdx])

  const hovered = hoverIdx != null ? data[hoverIdx] : null
  const hoveredY = hoverIdx != null ? yFor(data[hoverIdx]) : 0
  const tooltipBelow = hoveredY < height * 0.4

  return (
    <div
      ref={containerRef}
      className="relative w-full touch-none"
      style={{ height }}
      onPointerMove={handleMove}
      onPointerLeave={() => setHoverIdx(null)}
      role="img"
      aria-label={`نمودار ${data.length} نقطه‌ای، آخرین مقدار ${fmt(data[lastIdx])}`}
    >
      <svg
        width={w}
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        className="absolute inset-0 overflow-visible"
        aria-hidden
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.24" />
            <stop offset="50%" stopColor={color} stopOpacity="0.06" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* FIX 2: Single consistent bottom axis line (replaces data-dependent quartile gridlines) */}
        <line
          x1={padX}
          y1={h - 0.5}
          x2={w - padX}
          y2={h - 0.5}
          stroke="currentColor"
          strokeWidth="0.5"
          className="text-ink-tertiary"
          opacity="0.15"
        />
        {/* Gradient area fill under the smooth curve */}
        <motion.path
          d={areaPath}
          fill={`url(#${gradId})`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.15 }}
        />
        {/* Average baseline — dashed reference in the chart's own color */}
        {showBaseline && (
          <line
            x1={padX}
            y1={avgY}
            x2={w - padX}
            y2={avgY}
            stroke={color}
            strokeWidth="1"
            strokeDasharray="4 3"
            opacity="0.4"
          />
        )}
        {/* FIX 3: Smooth curve at 1:1 pixel scale — no non-scaling-stroke needed */}
        <motion.path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1, ease: [0, 0, 0.2, 1] }}
        />
      </svg>

      {/* FIX 1: Endpoint dot — NO surface halo (halo was erasing the line near the dot) */}
      <div
        className="absolute size-2 rounded-full"
        style={{
          left: xFor(lastIdx),
          top: lastY,
          transform: 'translate(-50%, -50%)',
          background: color,
        }}
        aria-hidden
      />
      {/* FIX 4: Pulse ring — wrapped in a centering container div that holds translate(-50%, -50%),
          letting the inner motion.div freely animate scale from its own center */}
      <div
        className="absolute size-2"
        style={{ left: xFor(lastIdx), top: lastY, transform: 'translate(-50%, -50%)' }}
        aria-hidden
      >
        <motion.div
          className="size-2 rounded-full"
          style={{ borderColor: color, borderWidth: 1.5, borderStyle: 'solid' }}
          initial={{ scale: 1, opacity: 0.5 }}
          animate={{ scale: 3.5, opacity: 0 }}
          transition={{ duration: 1.8, repeat: shouldAnimate ? Infinity : 0, ease: 'easeOut' }}
        />
      </div>

      {/* Hover layer — guide line + dot + tooltip */}
      {hoverIdx != null && hovered != null && (
        <>
          <div
            className="absolute top-0 bottom-0 w-px"
            style={{ left: xFor(hoverIdx), background: color, opacity: 0.4 }}
            aria-hidden
          />
          <div
            className="absolute size-2.5 rounded-full"
            style={{
              left: xFor(hoverIdx),
              top: hoveredY,
              transform: 'translate(-50%, -50%)',
              background: 'var(--n-surface)',
              boxShadow: `0 0 0 2px ${color}`,
            }}
            aria-hidden
          />
          <div
            className="absolute pointer-events-none n-glass-popover px-2 py-1 text-2xs whitespace-nowrap z-20"
            style={{
              left: xFor(hoverIdx),
              top: tooltipBelow ? hoveredY + 12 : undefined,
              bottom: tooltipBelow ? undefined : h - hoveredY + 12,
              transform: 'translateX(-50%)',
            }}
            dir="rtl"
          >
            {formatLabel?.(hoverIdx) && (
              <span className="block text-2xs text-ink-tertiary leading-tight mb-0.5">
                {formatLabel(hoverIdx)}
              </span>
            )}
            <span className="font-bold text-ink-primary num-tabular leading-tight">
              {fmt(hovered)}
            </span>
          </div>
        </>
      )}
    </div>
  )
}

/* ============================================================================
   KPI CARD — world-class metric card with a real data visualization.
   The chart is the hero (full-width, ~60px), not a corner decoration.
   Layout: [icon + label + trend] → [big value] → [vs-previous context] → [chart] → [time anchors]
   ============================================================================ */

export function KpiCard({
  label,
  value,
  icon: Icon,
  iconColor = 'text-accent',
  trend,
  spark,
  sparkColor = 'var(--color-accent)',
  previousValue,
  formatValue,
  formatSparkValue,
  formatSparkLabel,
  loading = false,
  timeLabel = '۷ روز پیش',
  className = '',
}: {
  label: string
  value: number
  icon: LucideIcon
  iconColor?: string
  trend?: number
  spark: number[]
  sparkColor?: string
  previousValue?: number
  formatValue?: (v: number) => string
  formatSparkValue?: (v: number) => string
  formatSparkLabel?: (i: number) => string
  loading?: boolean
  timeLabel?: string
  className?: string
}) {
  const fmt = formatValue ?? ((v: number) => toPersianDigits(formatCompact(v)))
  const sparkFmt = formatSparkValue ?? fmt
  const delta =
    previousValue != null && previousValue > 0
      ? ((value - previousValue) / previousValue) * 100
      : null

  return (
    <div
      className={cn('n-card-interactive min-h-[210px] p-4 n-focus-ring', className)}
      data-visual-mask="metric-card"
      tabIndex={0}
      aria-label={`${label}: ${fmt(value)}${trend != null ? `، ${trend >= 0 ? 'افزایش' : 'کاهش'} ${toPersianDigits(Math.abs(trend).toFixed(1))} درصد` : ''}`}
    >
      {/* Header: icon + label (right in RTL) · trend chip (left) */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-1.5 min-w-0">
          {loading ? (
            <>
              <Skeleton className="size-3.5 rounded" />
              <Skeleton className="h-2.5 w-16 rounded" />
            </>
          ) : (
            <>
              <Icon className={cn('size-3.5 shrink-0', iconColor)} strokeWidth={2} />
              <span className="text-xs font-semibold text-ink-secondary truncate">{label}</span>
            </>
          )}
        </div>
        {!loading && trend != null && <Trend value={trend} />}
      </div>

      {/* Big value */}
      <div className="mb-1">
        {loading ? (
          <Skeleton className="h-7 w-24 rounded" />
        ) : (
          <p className="text-2xl font-bold text-ink-primary num-tabular leading-none tracking-tight">
            {fmt(value)}
          </p>
        )}
      </div>

      {/* Context line: delta vs previous period */}
      {!loading && delta != null && (
        <p className="text-2xs text-ink-tertiary mb-2.5 leading-tight">
          {delta >= 0 ? 'افزایش' : 'کاهش'}{' '}
          <span
            className={cn('font-bold num-tabular', delta >= 0 ? 'text-success' : 'text-danger')}
          >
            {toPersianDigits(Math.abs(delta).toFixed(1))}٪
          </span>{' '}
          نسبت به دوره قبل
        </p>
      )}
      {!loading && delta == null && <div className="mb-2.5" />}

      {/* Hero chart — full-width, interactive, smooth curves */}
      <div className="mt-0.5">
        {loading ? (
          <Skeleton className="h-16 w-full rounded-md" />
        ) : (
          <MiniChart
            data={spark}
            color={sparkColor}
            height={64}
            formatValue={sparkFmt}
            formatLabel={formatSparkLabel}
          />
        )}
      </div>

      {/* Time anchors (LTR: oldest left → today right) */}
      {!loading && spark.length >= 2 && (
        <div
          dir="ltr"
          className="flex items-center justify-between mt-1.5 text-2xs text-ink-tertiary/60 num-tabular"
        >
          <span>{timeLabel}</span>
          <span>امروز</span>
        </div>
      )}
    </div>
  )
}

/** Num — number display with Persian digits and compact formatting */
export function Num({ value, compact = false }: { value: number; compact?: boolean }) {
  if (compact) {
    if (value >= 1_000_000)
      return <span className="num-tabular">{toPersianDigits((value / 1_000_000).toFixed(1))}M</span>
    if (value >= 1_000)
      return <span className="num-tabular">{toPersianDigits((value / 1_000).toFixed(1))}K</span>
  }
  return <span className="num-tabular">{toPersianDigits(value.toLocaleString('en-US'))}</span>
}

/** MetricValue — large KPI number with consistent typography */
export function MetricValue({
  value,
  className = '',
}: {
  value: React.ReactNode
  className?: string
}) {
  return (
    <span
      className={`text-2xl font-bold text-ink-primary num-tabular leading-none tracking-tight ${className}`}
    >
      {value}
    </span>
  )
}

/** EmptyState — professional empty state with icon, message, optional CTA
 *  v4: Supports custom SVG illustrations via `illustration` prop (key into ILLUSTRATIONS map).
 *      Falls back to icon-in-circle with accent halo if no illustration key provided.
 *      `size="compact"` for inline empties (inside cards/sections). */
export function EmptyState({
  icon: Icon,
  title,
  message,
  action,
  illustration,
  size = 'default',
}: {
  icon: LucideIcon
  title: string
  message?: string
  action?: React.ReactNode
  illustration?: IllustrationKey
  size?: 'default' | 'compact'
}) {
  // Custom SVG illustration (view-level empty states)
  if (illustration) {
    const Illustration = ILLUSTRATIONS[illustration]
    const py = size === 'compact' ? 'py-10' : 'py-16'
    return (
      <div className={`flex flex-col items-center justify-center ${py} text-center`}>
        <Illustration className="size-[120px] mb-4" />
        <p className="text-base font-bold text-ink-primary">{title}</p>
        {message && (
          <p className="text-sm text-ink-tertiary mt-1.5 max-w-[320px] leading-relaxed">
            {message}
          </p>
        )}
        {action && <div className="mt-4">{action}</div>}
      </div>
    )
  }

  // Icon-in-circle with accent halo (fallback / compact)
  const py = size === 'compact' ? 'py-8' : 'py-12'
  return (
    <div className={`flex flex-col items-center justify-center ${py} text-center`}>
      <div className="flex size-12 items-center justify-center rounded-xl bg-surface-hover mb-3">
        <Icon className="size-6 text-ink-tertiary opacity-60" strokeWidth={1.5} />
      </div>
      <p className="text-sm font-semibold text-ink-secondary">{title}</p>
      {message && <p className="text-xs text-ink-tertiary mt-1 max-w-[280px]">{message}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}

/* ============================================================================
   SKELETON SYSTEM — NN/G-compliant loading state
   Size-matched to real content. Shimmer animation (composite-only).
   Never used as decoration — only where real content will appear.
   ============================================================================ */

/** Skeleton — base shimmer block */
export function Skeleton({
  className = '',
  style,
}: {
  className?: string
  style?: React.CSSProperties
}) {
  return <div className={`n-skeleton ${className}`} style={style} aria-hidden />
}

/** SkeletonText — multi-line text placeholder with realistic line widths */
export function SkeletonText({
  lines = 3,
  className = '',
}: {
  lines?: number
  className?: string
}) {
  return (
    <div className={`space-y-1.5 ${className}`} aria-hidden>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className="h-3" style={{ width: i === lines - 1 ? '60%' : '100%' }} />
      ))}
    </div>
  )
}

/** SkeletonCard — matches the Card component layout for seamless swap-in */
export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`n-card p-5 ${className}`} aria-busy="true">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <Skeleton className="size-7 rounded-md" />
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-2.5 w-16" />
          </div>
        </div>
        <Skeleton className="h-6 w-16 rounded-md" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-12 w-full rounded-lg" />
        <Skeleton className="h-12 w-full rounded-lg" />
      </div>
    </div>
  )
}

/** SkeletonList — matches a list of rows (inbox, content library, etc.) */
export function SkeletonList({
  rows = 5,
  avatar = true,
  className = '',
}: {
  rows?: number
  avatar?: boolean
  className?: string
}) {
  return (
    <div className={className} aria-busy="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-start gap-3 p-3 border-b border-border last:border-0">
          {avatar && <Skeleton className="size-10 rounded-full shrink-0" />}
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-2.5 w-12" />
            </div>
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  )
}

/** SkeletonKPI — matches KPI metric card layout */
export function SkeletonKPI() {
  return (
    <div className="n-card p-4" aria-busy="true">
      <div className="flex items-center justify-between mb-3">
        <Skeleton className="size-8 rounded-lg" />
        <Skeleton className="h-5 w-12 rounded-full" />
      </div>
      <Skeleton className="h-7 w-20 mb-2" />
      <Skeleton className="h-3 w-16" />
      <Skeleton className="h-8 w-full mt-3 rounded" />
    </div>
  )
}

/** LoadingState — renders skeleton while loading, content otherwise.
 *  Uses AnimatePresence for skeleton → content cross-fade. */
export function LoadingState({
  isLoading,
  skeleton,
  children,
  isError,
  onRetry,
  errorLabel = 'خطا در بارگذاری اطلاعات',
}: {
  isLoading: boolean
  skeleton: React.ReactNode
  children: React.ReactNode
  isError?: boolean
  onRetry?: () => void
  errorLabel?: string
}) {
  return (
    <AnimatePresence mode="wait">
      {isError ? (
        <motion.div
          key="error"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0, transition: { duration: 0.2, ease: [0, 0, 0.2, 1] } }}
          exit={{ opacity: 0, transition: { duration: 0.15 } }}
        >
          <ErrorState label={errorLabel} onRetry={onRetry} />
        </motion.div>
      ) : isLoading ? (
        <motion.div
          key="skeleton"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.15 } }}
        >
          {skeleton}
        </motion.div>
      ) : (
        <motion.div
          key="content"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0, transition: { duration: 0.2, ease: [0, 0, 0.2, 1] } }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/**
 * ErrorState — recoverable error display with retry CTA.
 * Per AUDIT-1B recommendation: the app had NO error-state pattern.
 * Use inside any view when a query fails (isError from TanStack Query).
 */
export function ErrorState({
  label = 'خطا در بارگذاری اطلاعات',
  description,
  onRetry,
}: {
  label?: string
  description?: string
  onRetry?: () => void
}) {
  return (
    <div className="n-card flex flex-col items-center justify-center gap-3 p-10 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-danger-soft">
        <AlertCircle className="size-6 text-danger" strokeWidth={2} />
      </div>
      <div>
        <p className="text-base font-semibold text-ink-primary">{label}</p>
        {description && <p className="text-sm text-ink-tertiary mt-1">{description}</p>}
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="n-focus-ring inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-border bg-surface px-3.5 text-sm font-semibold text-ink-secondary transition-colors hover:bg-surface-hover hover:text-ink-primary"
        >
          <RefreshCw className="size-3.5" strokeWidth={2.5} />
          تلاش مجدد
        </button>
      )}
    </div>
  )
}

/* ============================================================================
   ANIMATED TABS — Linear-style sliding underline with layoutId
   Use this instead of shadcn Tabs when you want the signature shared-element
   animation between tab triggers. Underline glides between tabs.
   ============================================================================ */

export function AnimatedTabs<T extends string>({
  value,
  onValueChange,
  tabs,
  className = '',
  size = 'md',
}: {
  value: T
  onValueChange: (v: T) => void
  tabs: { value: T; label: string; icon?: LucideIcon; count?: number }[]
  className?: string
  size?: 'sm' | 'md'
}) {
  const pad = size === 'sm' ? 'px-2.5 py-1.5' : 'px-3.5 py-2'
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm'
  const iconSize = size === 'sm' ? 'size-3.5' : 'size-4'

  return (
    <div
      role="tablist"
      className={`relative inline-flex items-center gap-0.5 border-b border-border ${className}`}
    >
      {tabs.map((tab) => {
        const Icon = tab.icon
        const active = tab.value === value
        return (
          <button
            key={tab.value}
            role="tab"
            aria-selected={active}
            onClick={() => onValueChange(tab.value)}
            className={`n-focus-ring relative ${pad} ${textSize} font-semibold transition-colors duration-150 flex items-center gap-1.5 -mb-px border-b-2 whitespace-nowrap ${
              active
                ? 'text-accent border-accent'
                : 'text-ink-tertiary border-transparent hover:text-ink-secondary'
            }`}
          >
            {Icon && <Icon className={iconSize} strokeWidth={2} />}
            <span>{tab.label}</span>
            {tab.count != null && tab.count > 0 && (
              <span
                className={`inline-flex min-w-[16px] items-center justify-center rounded-full px-1 text-2xs font-bold leading-none num-tabular ${
                  active ? 'bg-accent text-white' : 'bg-surface-hover text-ink-tertiary'
                }`}
              >
                {toPersianDigits(tab.count)}
              </span>
            )}
            {/* Sliding active underline — shared element via layoutId */}
            {active && (
              <motion.span
                layoutId="animated-tab-underline"
                className="absolute -bottom-px inset-x-0 h-[2px] bg-accent rounded-full"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                aria-hidden
              />
            )}
          </button>
        )
      })}
    </div>
  )
}
