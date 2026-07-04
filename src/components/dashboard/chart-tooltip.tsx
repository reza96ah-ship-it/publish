'use client'

import { toPersianDigits, formatCompact } from '@/lib/jalali'

/* ============================================================================
   CHART TOOLTIP — glass material, Persian digits, RTL-aware
   For use with recharts: <Tooltip content={<ChartTooltip />} />
   ============================================================================ */

interface ChartTooltipProps {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string; dataKey?: string }>
  label?: string
  /** Map dataKey → Persian label */
  labelMap?: Record<string, string>
  /** Format function for values. Default: formatCompact + Persian digits */
  formatValue?: (v: number) => string
}

const PERIOD_LABELS: Record<string, string> = {
  reach: 'دسترسی',
  engagement: 'تعامل',
  followers: 'مخاطبان',
  clicks: 'کلیک',
  value: 'مقدار',
}

export function ChartTooltip({ active, payload, label, labelMap, formatValue }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null

  const fmt = formatValue ?? ((v: number) => toPersianDigits(formatCompact(Number(v))))

  return (
    <div className="n-glass-popover px-3 py-2.5 min-w-[140px]" dir="rtl" role="tooltip">
      {label && (
        <p className="text-xs font-semibold text-ink-secondary mb-1.5 pb-1.5 border-b border-border">
          {toPersianDigits(String(label))}
        </p>
      )}
      <div className="space-y-1">
        {payload.map((entry, i) => {
          const persianLabel =
            labelMap?.[entry.dataKey ?? entry.name] ?? PERIOD_LABELS[entry.name] ?? entry.name
          return (
            <div key={i} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5">
                <span
                  className="size-2 rounded-full shrink-0"
                  style={{ background: entry.color }}
                  aria-hidden
                />
                <span className="text-xs text-ink-secondary">{persianLabel}</span>
              </div>
              <span className="text-xs font-bold text-ink-primary num-tabular">
                {fmt(Number(entry.value))}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** Bar chart tooltip — simpler, single value */
export function BarChartTooltip({
  active,
  payload,
  label,
  formatValue,
}: {
  active?: boolean
  payload?: Array<{ value: number; payload?: { name?: string } }>
  label?: string
  formatValue?: (v: number) => string
}) {
  if (!active || !payload || payload.length === 0) return null
  const fmt = formatValue ?? ((v: number) => toPersianDigits(formatCompact(Number(v))))
  const displayLabel = payload[0]?.payload?.name ?? label

  return (
    <div className="n-glass-popover px-3 py-2" dir="rtl" role="tooltip">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-ink-secondary">{displayLabel}</span>
        <span className="text-sm font-bold text-ink-primary num-tabular">
          {fmt(Number(payload[0].value))}
        </span>
      </div>
    </div>
  )
}
