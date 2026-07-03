'use client'

/**
 * JalaliDatePicker — Persian-first date picker popover.
 *
 * Built on top of `src/lib/jalali.ts` (bespoke Solar Hijri algorithm).
 * NOT a wrapper around react-day-picker (which is Gregorian) — this is a
 * native Persian calendar grid with Saturday-first weeks, Iranian holiday
 * highlighting, weekend (Thu/Fri) tinting, and Persian digit rendering.
 *
 * Design principles (research-backed):
 *  - Saturday-first week (Persian week starts on شنبه)
 *  - Persian digits everywhere (۱۲۳۴۵۶۷۸۹۰)
 *  - Holidays tinted red, weekends soft-amber
 *  - Animated month transition (spring, 220ms)
 *  - Keyboard accessible: Tab to traverse, Enter to select, Esc to close
 *  - RTL native (no LTR transforms)
 *  - Sticky footer with "امروز" quick action
 *
 * Usage:
 *   <JalaliDatePicker value={date} onChange={setDate} />
 *   <JalaliDatePicker value={date} onChange={setDate} showTime />
 */

import * as React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import {
  JALALI_MONTHS,
  JALALI_WEEKDAYS_SHORT,
  toJalali,
  jalaliToDate,
  formatJalali,
  formatJalaliTime,
  isHoliday,
  toPersianDigits,
  getJalaliMonthGrid,
  type JalaliDate,
} from '@/lib/jalali'

interface JalaliDatePickerProps {
  value?: Date | null
  onChange?: (date: Date | null) => void
  /** Show time input alongside date */
  showTime?: boolean
  /** Placeholder text */
  placeholder?: string
  /** Disable past dates */
  disablePast?: boolean
  /** Min selectable date */
  minDate?: Date
  /** Max selectable date */
  maxDate?: Date
  /** Trigger button size */
  size?: 'sm' | 'md'
  /** Trigger button variant */
  variant?: 'outline' | 'ghost' | 'soft'
  className?: string
  /** Optional id for the underlying trigger */
  id?: string
  /** Disabled state */
  disabled?: boolean
  /** Render calendar inline (no popover) — use inside Sheets/Dialogs to avoid focus-trap conflicts */
  inline?: boolean
}

export function JalaliDatePicker({
  value,
  onChange,
  showTime = false,
  placeholder = 'انتخاب تاریخ',
  disablePast = false,
  minDate,
  maxDate,
  size = 'md',
  variant = 'outline',
  className,
  id,
  disabled,
  inline = false,
}: JalaliDatePickerProps) {
  const [open, setOpen] = React.useState(false)
  const today = React.useMemo(() => new Date(), [])
  const todayJ = React.useMemo(() => toJalali(today), [today])

  // Cursor for the picker (defaults to value's month or today)
  const [cursor, setCursor] = React.useState<{ year: number; month: number }>(() => {
    if (value) {
      const j = toJalali(value)
      return { year: j.year, month: j.month }
    }
    return { year: todayJ.year, month: todayJ.month }
  })

  // Time state (only used when showTime is true)
  const [timeStr, setTimeStr] = React.useState<string>(() => {
    if (!value) return '12:00'
    const h = value.getHours()
    const m = value.getMinutes()
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  })

  // When opening, sync cursor to value
  React.useEffect(() => {
    if (open && value) {
      const j = toJalali(value)
      setCursor({ year: j.year, month: j.month })
    }
  }, [open, value])

  const cells = React.useMemo(() => getJalaliMonthGrid(cursor.year, cursor.month), [cursor])

  const selectedJ: JalaliDate | null = React.useMemo(
    () => (value ? toJalali(value) : null),
    [value]
  )

  const isDisabled = (cell: { jalali: JalaliDate; date: Date }): boolean => {
    if (disablePast) {
      const todayMidnight = new Date(today)
      todayMidnight.setHours(0, 0, 0, 0)
      if (cell.date < todayMidnight) return true
    }
    if (minDate && cell.date < minDate) return true
    if (maxDate && cell.date > maxDate) return true
    return false
  }

  const handleSelect = (jalali: JalaliDate) => {
    let newDate = jalaliToDate(jalali.year, jalali.month, jalali.day)
    // Preserve time if showTime
    if (showTime && value) {
      newDate = new Date(
        newDate.getFullYear(),
        newDate.getMonth(),
        newDate.getDate(),
        value.getHours(),
        value.getMinutes(),
        0,
        0
      )
    } else if (showTime) {
      const [h, m] = timeStr.split(':').map(Number)
      newDate = new Date(
        newDate.getFullYear(),
        newDate.getMonth(),
        newDate.getDate(),
        h || 12,
        m || 0,
        0,
        0
      )
    }
    onChange?.(newDate)
    if (!showTime) setOpen(false)
  }

  const handleTimeChange = (newTime: string) => {
    setTimeStr(newTime)
    if (value) {
      const [h, m] = newTime.split(':').map(Number)
      const newDate = new Date(value)
      newDate.setHours(h || 12, m || 0, 0, 0)
      onChange?.(newDate)
    }
  }

  const goPrev = () => {
    setCursor((c) =>
      c.month === 1 ? { year: c.year - 1, month: 12 } : { year: c.year, month: c.month - 1 }
    )
  }
  const goNext = () => {
    setCursor((c) =>
      c.month === 12 ? { year: c.year + 1, month: 1 } : { year: c.year, month: c.month + 1 }
    )
  }
  const goToday = () => {
    setCursor({ year: todayJ.year, month: todayJ.month })
    handleSelect(todayJ)
  }

  const clearValue = () => {
    onChange?.(null)
    if (!inline) setOpen(false)
  }

  // Display value
  const displayText = value
    ? showTime
      ? `${formatJalali(value)} • ${formatJalaliTime(value)}`
      : formatJalali(value, true)
    : placeholder

  const sizeClass = size === 'sm' ? 'h-8 text-[11px] px-2.5' : 'h-9 text-[12px] px-3'
  const variantClass =
    variant === 'ghost'
      ? 'border-transparent bg-transparent hover:bg-surface-hover'
      : variant === 'soft'
        ? 'border-border bg-surface-subtle hover:bg-surface-hover'
        : 'border-input bg-background hover:bg-surface-hover'

  const calendarContent = (
    <CalendarGrid
      cursor={cursor}
      cells={cells}
      selectedJ={selectedJ}
      isDisabled={isDisabled}
      showTime={showTime}
      timeStr={timeStr}
      onTimeChange={handleTimeChange}
      onPrev={goPrev}
      onNext={goNext}
      onToday={goToday}
      onSelect={handleSelect}
      onClear={clearValue}
      hasValue={!!value}
      inline={inline}
      onClose={inline ? undefined : () => setOpen(false)}
    />
  )

  // Inline mode: render the calendar grid directly (for use inside Sheets/Dialogs)
  if (inline) {
    return (
      <div
        className={cn('bg-popover border border-border rounded-2xl overflow-hidden', className)}
        dir="rtl"
      >
        {calendarContent}
      </div>
    )
  }

  // Popover mode (default)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          data-empty={!value}
          className={cn(
            'n-focus-ring justify-start text-right font-[500] gap-2 w-full',
            'data-[empty=true]:text-ink-tertiary',
            sizeClass,
            variantClass,
            className
          )}
        >
          <CalendarIcon className="size-3.5 text-accent shrink-0" />
          <span className="truncate flex-1 num-tabular">{displayText}</span>
          {value && (
            <X
              className="size-3 text-ink-tertiary hover:text-ink-primary shrink-0"
              onClick={(e) => {
                e.stopPropagation()
                clearValue()
              }}
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="start"
        sideOffset={6}
        className="w-auto p-0 bg-popover border-border shadow-xl rounded-2xl"
      >
        <div className="w-[min(300px,calc(100vw-2rem))]" dir="rtl">
          {calendarContent}
        </div>
      </PopoverContent>
    </Popover>
  )
}

// ── CalendarGrid (inner component, reused by popover + inline modes) ──

interface CalendarGridProps {
  cursor: { year: number; month: number }
  cells: ReturnType<typeof getJalaliMonthGrid>
  selectedJ: JalaliDate | null
  isDisabled: (cell: { jalali: JalaliDate; date: Date }) => boolean
  showTime: boolean
  timeStr: string
  onTimeChange: (t: string) => void
  onPrev: () => void
  onNext: () => void
  onToday: () => void
  onSelect: (j: JalaliDate) => void
  onClear: () => void
  hasValue: boolean
  inline: boolean
  onClose?: () => void
}

function CalendarGrid({
  cursor,
  cells,
  selectedJ,
  isDisabled,
  showTime,
  timeStr,
  onTimeChange,
  onPrev,
  onNext,
  onToday,
  onSelect,
  onClear,
  hasValue,
  onClose,
}: CalendarGridProps) {
  return (
    <>
      {/* Header: month nav */}
      <div className="flex items-center justify-between p-3 border-b border-border">
        <button
          onClick={onPrev}
          aria-label="ماه قبل"
          className="n-focus-ring rounded-lg p-1.5 hover:bg-surface-hover text-ink-secondary"
        >
          <ChevronRight className="size-4" />
        </button>
        <div className="text-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${cursor.year}-${cursor.month}`}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="text-[13px] font-[700] text-ink-primary"
            >
              {JALALI_MONTHS[cursor.month - 1]} {toPersianDigits(cursor.year)}
            </motion.div>
          </AnimatePresence>
        </div>
        <button
          onClick={onNext}
          aria-label="ماه بعد"
          className="n-focus-ring rounded-lg p-1.5 hover:bg-surface-hover text-ink-secondary"
        >
          <ChevronLeft className="size-4" />
        </button>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 gap-0.5 px-2 pt-2">
        {JALALI_WEEKDAYS_SHORT.map((d, i) => (
          <div
            key={d}
            className={cn(
              'text-center text-[10px] font-[600] py-1',
              i >= 5 ? 'text-amber-600 dark:text-amber-400' : 'text-ink-tertiary'
            )}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-0.5 p-2">
        {cells.map((cell, idx) => {
          const j = cell.jalali
          const isSelected =
            selectedJ &&
            j.year === selectedJ.year &&
            j.month === selectedJ.month &&
            j.day === selectedJ.day
          const isToday = cell.isToday
          const weekend = cell.isWeekend
          const holiday = cell.holiday
          const disabledDay = isDisabled(cell) || !cell.inMonth

          return (
            <button
              key={idx}
              type="button"
              disabled={disabledDay}
              onClick={() => onSelect(j)}
              aria-label={`${j.day} ${JALALI_MONTHS[j.month - 1]} ${toPersianDigits(j.year)}`}
              aria-pressed={!!isSelected}
              className={cn(
                'n-focus-ring relative aspect-square rounded-lg text-[12px] font-[600] transition-all',
                'flex items-center justify-center',
                !cell.inMonth && 'opacity-30',
                disabledDay && 'opacity-30 cursor-not-allowed',
                !disabledDay && !isSelected && 'hover:bg-surface-hover',
                weekend && !isSelected && !holiday && 'text-amber-700 dark:text-amber-300',
                holiday && !isSelected && 'text-rose-600 dark:text-rose-400',
                isToday && !isSelected && 'bg-accent-soft text-accent',
                isSelected &&
                  'bg-primary text-primary-foreground shadow-sm scale-105 hover:bg-primary'
              )}
            >
              {toPersianDigits(j.day)}
              {holiday && !isSelected && (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 size-1 rounded-full bg-rose-500" />
              )}
            </button>
          )
        })}
      </div>

      {/* Time input (optional) */}
      {showTime && (
        <div className="px-3 pb-2 border-t border-border pt-3">
          <label className="text-[10px] text-ink-tertiary mb-1.5 block font-[600]">
            ساعت انتشار
          </label>
          <Input
            type="time"
            value={timeStr}
            onChange={(e) => onTimeChange(e.target.value)}
            className="h-8 text-[12px]"
            dir="ltr"
          />
        </div>
      )}

      {/* Footer: today + clear + confirm */}
      <div className="flex items-center justify-between gap-2 p-2 border-t border-border">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onToday}
          className="h-7 text-[11px] text-accent hover:text-accent"
        >
          امروز
        </Button>
        {hasValue && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="h-7 text-[11px] text-ink-tertiary hover:text-rose-500"
          >
            پاک کردن
          </Button>
        )}
        {showTime && onClose && (
          <Button type="button" size="sm" onClick={onClose} className="h-7 text-[11px] ms-auto">
            تأیید
          </Button>
        )}
      </div>
    </>
  )
}
