'use client'

import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { pageTransition, pageTransitionProps } from '@/lib/motion'
import { toast } from 'sonner'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  CalendarDays,
  ChevronRight,
  ChevronLeft,
  Radio,
  Clock3,
  ListChecks,
  Plus,
  CalendarClock,
} from 'lucide-react'

import { api } from '@/lib/api'
import {
  JALALI_MONTHS,
  JALALI_WEEKDAYS,
  JALALI_WEEKDAYS_SHORT,
  toPersianDigits,
  formatJalali,
  formatJalaliTime,
  relativeTime,
  getJalaliMonthGrid,
  toJalali,
  isHoliday,
  type CalendarCell,
} from '@/lib/jalali'
import { useAppStore } from '@/lib/store'
import { useRouter } from 'next/navigation'
import { announce } from '@/lib/aria-live'
import {
  SectionTitle,
  PlatformIcon,
  StatusBadge,
  EmptyState,
  AnimatedTabs,
} from '@/components/dashboard/shared'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { JalaliDatePicker } from '@/components/ui/jalali-picker'
import { cn } from '@/lib/utils'

interface CalendarJob {
  id: string
  title: string
  thumbnail: string
  platform: string
  status: string
  scheduledAt: string
  progress: number
}

interface PublishJob {
  id: string
  title: string
  thumbnail: string
  platform: string
  platformName: string
  status: string
  statusLabel: string
  progress: number
  processLabel: string
  scheduledAt: string | null
  completedAt: string | null
  error: string | null
  retryCount: number
  assignee: string
  assigneeAvatar: string
  campaign: string
}

const PLATFORM_CHIP: Record<string, string> = {
  instagram: 'chip-instagram',
  telegram: 'chip-telegram',
  linkedin: 'chip-linkedin',
  rubika: 'chip-rubika',
  eitaa: 'chip-eitaa',
  bale: 'chip-bale',
}

const STATUS_LABEL: Record<string, string> = {
  success: 'منتشر شد',
  failed: 'ناموفق',
  scheduled: 'برنامه‌ریزی‌شده',
  pending: 'در انتظار',
  processing: 'در حال پردازش',
  action: 'نیازمند اقدام',
  live: 'در حال انتشار',
}

export function CalendarView() {
  const { calendarCursor, setCalendarCursor } = useAppStore()
  const router = useRouter()
  const navigateTo = (path: string) => router.push(path)
  const [view, setView] = useState<'month' | 'week' | 'day' | 'agenda'>('month')
  const [selectedJob, setSelectedJob] = useState<CalendarJob | null>(null)
  const [editingSchedule, setEditingSchedule] = useState<Date | null>(null)
  const [activeDrag, setActiveDrag] = useState<{ id: string; title: string } | null>(null)
  const queryClient = useQueryClient()

  // Week/day cursors — Saturday-anchored (Jalali week start)
  const [weekCursor, setWeekCursor] = useState<Date>(() => {
    const d = new Date()
    const daysFromSat = (d.getDay() + 1) % 7 // Sat=0, Sun=1, ..., Fri=6
    d.setDate(d.getDate() - daysFromSat)
    d.setHours(0, 0, 0, 0)
    return d
  })
  const [dayCursor, setDayCursor] = useState<Date>(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  })

  // DnD sensors — pointer: distance:6 lets clicks through; touch: 250ms long-press
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  )

  // Reschedule mutation — PATCH /api/publish-jobs/[id] { action: 'reschedule', scheduledAt }
  const rescheduleMutation = useMutation({
    mutationFn: async ({ jobId, scheduledAt }: { jobId: string; scheduledAt: Date }) => {
      return api.patch(`/api/publish-jobs/${jobId}`, {
        action: 'reschedule',
        scheduledAt: scheduledAt.toISOString(),
      })
    },
    onSuccess: () => {
      toast.success('زمان‌بندی به‌روزرسانی شد')
      queryClient.invalidateQueries({ queryKey: ['calendar'] })
      queryClient.invalidateQueries({ queryKey: ['publish-jobs'] })
      setEditingSchedule(null)
      setSelectedJob(null)
      announce('زمان‌بندی به‌روزرسانی شد')
    },
    onError: (err: Error) => {
      toast.error(err.message || 'خطا در به‌روزرسانی زمان‌بندی')
    },
  })

  const { data: jobs } = useQuery<CalendarJob[]>({
    queryKey: ['calendar', calendarCursor.year, calendarCursor.month],
    queryFn: () =>
      api.get<CalendarJob[]>(
        `/api/calendar?year=${calendarCursor.year}&month=${calendarCursor.month}`
      ),
  })

  const { data: queue } = useQuery<PublishJob[]>({
    queryKey: ['publish-jobs'],
    queryFn: () => api.getPaginated<PublishJob>('/api/publish-jobs'),
  })

  const cells = useMemo(
    () => getJalaliMonthGrid(calendarCursor.year, calendarCursor.month),
    [calendarCursor]
  )

  // 7-cell week grid starting from weekCursor (Saturday)
  const weekCells = useMemo<CalendarCell[]>(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekCursor)
      d.setDate(d.getDate() + i)
      const j = toJalali(d)
      const today = new Date()
      return {
        date: d,
        jalali: j,
        isToday:
          d.getFullYear() === today.getFullYear() &&
          d.getMonth() === today.getMonth() &&
          d.getDate() === today.getDate(),
        isWeekend: i >= 5,
        holiday: isHoliday(j),
        inMonth: true,
      }
    })
  }, [weekCursor])

  // Group jobs by their jalali day
  const jobsByDay = useMemo(() => {
    const map = new Map<string, CalendarJob[]>()
    for (const job of jobs ?? []) {
      const d = new Date(job.scheduledAt)
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
      const arr = map.get(key) ?? []
      arr.push(job)
      map.set(key, arr)
    }
    return map
  }, [jobs])

  // Day jobs for day view
  const dayJobs = useMemo(() => {
    const key = `${dayCursor.getFullYear()}-${dayCursor.getMonth()}-${dayCursor.getDate()}`
    return (jobsByDay.get(key) ?? []).slice().sort(
      (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
    )
  }, [dayCursor, jobsByDay])

  const goPrev = () => {
    const newMonth = calendarCursor.month === 1 ? 12 : calendarCursor.month - 1
    const newYear = calendarCursor.month === 1 ? calendarCursor.year - 1 : calendarCursor.year
    setCalendarCursor(newYear, newMonth)
    announce(`${JALALI_MONTHS[newMonth - 1]} ${toPersianDigits(newYear)}`)
  }
  const goNext = () => {
    const newMonth = calendarCursor.month === 12 ? 1 : calendarCursor.month + 1
    const newYear = calendarCursor.month === 12 ? calendarCursor.year + 1 : calendarCursor.year
    setCalendarCursor(newYear, newMonth)
    announce(`${JALALI_MONTHS[newMonth - 1]} ${toPersianDigits(newYear)}`)
  }
  const goToday = () => {
    const now = new Date()
    const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]
    const gy2 = now.getMonth() > 1 ? now.getFullYear() + 1 : now.getFullYear()
    let days =
      355666 +
      365 * now.getFullYear() +
      Math.floor((gy2 + 3) / 4) -
      Math.floor((gy2 + 99) / 100) +
      Math.floor((gy2 + 399) / 400) +
      now.getDate() +
      g_d_m[now.getMonth()]
    let jy = -1595 + 33 * Math.floor(days / 12053)
    days = days - Math.floor(days / 12053) * 12053
    jy += 4 * Math.floor(days / 1461)
    days = days - Math.floor(days / 1461) * 1461
    if (days > 365) {
      jy += Math.floor((days - 1) / 365)
      days = (days - 1) % 365
    }
    const jm = days < 186 ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30)
    setCalendarCursor(jy, jm)
    announce(`امروز — ${JALALI_MONTHS[jm - 1]} ${toPersianDigits(jy)}`)
  }

  const goPrevWeek = () => {
    setWeekCursor((d) => {
      const next = new Date(d)
      next.setDate(next.getDate() - 7)
      const j = toJalali(next)
      setCalendarCursor(j.year, j.month)
      return next
    })
  }
  const goNextWeek = () => {
    setWeekCursor((d) => {
      const next = new Date(d)
      next.setDate(next.getDate() + 7)
      const j = toJalali(next)
      setCalendarCursor(j.year, j.month)
      return next
    })
  }
  const goWeekToday = () => {
    const d = new Date()
    const daysFromSat = (d.getDay() + 1) % 7
    d.setDate(d.getDate() - daysFromSat)
    d.setHours(0, 0, 0, 0)
    setWeekCursor(d)
    const j = toJalali(d)
    setCalendarCursor(j.year, j.month)
  }

  const goPrevDay = () => {
    setDayCursor((d) => {
      const next = new Date(d)
      next.setDate(next.getDate() - 1)
      const j = toJalali(next)
      setCalendarCursor(j.year, j.month)
      return next
    })
  }
  const goNextDay = () => {
    setDayCursor((d) => {
      const next = new Date(d)
      next.setDate(next.getDate() + 1)
      const j = toJalali(next)
      setCalendarCursor(j.year, j.month)
      return next
    })
  }
  const goDayToday = () => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    setDayCursor(d)
    const j = toJalali(d)
    setCalendarCursor(j.year, j.month)
  }

  const monthName = JALALI_MONTHS[calendarCursor.month - 1]

  const handleDragStart = (event: DragStartEvent) => {
    const jobId = event.active.id as string
    const job = (jobs ?? []).find((j) => j.id === jobId)
    if (job) {
      setActiveDrag({ id: jobId, title: job.title })
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveDrag(null)
    if (!over) return
    const jobId = active.id as string
    const dropId = String(over.id)
    if (!dropId.startsWith('day-')) return
    const dropDateIso = dropId.replace('day-', '')
    const dropDate = new Date(dropDateIso)
    if (Number.isNaN(dropDate.getTime())) return
    dropDate.setHours(12, 0, 0, 0) // noon local time
    rescheduleMutation.mutate({ jobId, scheduledAt: dropDate })
  }

  return (
    <motion.div
      initial={pageTransition.initial}
      animate={pageTransition.animate}
      transition={pageTransitionProps}
      className="space-y-5"
    >
      <SectionTitle
        icon={CalendarDays}
        badge={
          <AnimatedTabs
            value={view}
            onValueChange={(v) => setView(v as typeof view)}
            tabs={[
              { value: 'month', label: 'ماه' },
              { value: 'week', label: 'هفته' },
              { value: 'day', label: 'روز' },
              { value: 'agenda', label: 'برنامه' },
            ]}
          />
        }
      >
        تقویم محتوای شمسی
      </SectionTitle>

      <Tabs value={view} className="w-full">
        {/* ── Month view ── */}
        <TabsContent value="month" className="space-y-4">
          {/* Calendar header */}
          <div className="n-card n-gradient-border p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={goPrev} aria-label="ماه قبل">
                <ChevronRight className="size-4" />
              </Button>
              <div className="text-center min-w-[100px]">
                <p className="text-sm font-bold text-ink-primary num-tabular">
                  {monthName} {toPersianDigits(calendarCursor.year)}
                </p>
                <p className="text-2xs text-ink-tertiary num-tabular">
                  ماه {toPersianDigits(calendarCursor.month)}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={goNext} aria-label="ماه بعد">
                <ChevronLeft className="size-4" />
              </Button>
            </div>
            <Button variant="outline" size="sm" onClick={goToday}>
              امروز
            </Button>
          </div>

          {/* Month grid — horizontal scroll on mobile so 7-col grid never clips */}
          <div className="n-card p-3 sm:p-4 overflow-x-auto">
            <div className="min-w-[320px]">
            {/* Weekday header */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {JALALI_WEEKDAYS_SHORT.map((d, i) => (
                <div
                  key={d}
                  className={cn(
                    'text-center text-xs font-bold py-1.5',
                    i >= 5 ? 'text-danger' : 'text-ink-tertiary'
                  )}
                >
                  {d}
                </div>
              ))}
            </div>

            {/* Day cells */}
            <DndContext
              sensors={sensors}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragCancel={() => setActiveDrag(null)}
            >
              <div className="grid grid-cols-7 gap-1">
                {cells.map((cell, idx) => (
                  <DayCell
                    key={idx}
                    cell={cell}
                    jobs={
                      jobsByDay.get(
                        `${cell.date.getFullYear()}-${cell.date.getMonth()}-${cell.date.getDate()}`
                      ) ?? []
                    }
                    onSelectJob={setSelectedJob}
                    activeDragId={activeDrag?.id ?? null}
                  />
                ))}
              </div>
              <DragOverlay>
                {activeDrag ? (
                  <div className="rounded-lg bg-primary text-primary-foreground px-2 py-1 text-2xs font-bold shadow-xl max-w-56 truncate">
                    {activeDrag.title}
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
            </div>
          </div>
        </TabsContent>

        {/* ── Week view ── */}
        <TabsContent value="week" className="space-y-4">
          {/* Week nav */}
          <div className="n-card n-gradient-border p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={goPrevWeek} aria-label="هفته قبل">
                <ChevronRight className="size-4" />
              </Button>
              <div className="text-center min-w-[140px]">
                <p className="text-sm font-bold text-ink-primary">
                  {toPersianDigits(toJalali(weekCells[0].date).day)} –{' '}
                  {toPersianDigits(toJalali(weekCells[6].date).day)}{' '}
                  {JALALI_MONTHS[toJalali(weekCells[0].date).month - 1]}
                </p>
                <p className="text-2xs text-ink-tertiary">
                  {toPersianDigits(toJalali(weekCells[0].date).year)}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={goNextWeek} aria-label="هفته بعد">
                <ChevronLeft className="size-4" />
              </Button>
            </div>
            <Button variant="outline" size="sm" onClick={goWeekToday}>امروز</Button>
          </div>

          <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={() => setActiveDrag(null)}>
            {/* Desktop: 7-col grid */}
            <div className="n-card p-3 sm:p-4 hidden sm:block overflow-x-auto">
              <div className="min-w-[560px] grid grid-cols-7 gap-2">
                {weekCells.map((cell, i) => (
                  <div key={i} className="space-y-1">
                    <p className={cn(
                      'text-center text-xs font-bold py-1',
                      cell.isToday ? 'text-accent' : cell.isWeekend ? 'text-danger' : 'text-ink-tertiary'
                    )}>
                      {JALALI_WEEKDAYS_SHORT[i]} {toPersianDigits(cell.jalali.day)}
                    </p>
                    <DayCell
                      cell={cell}
                      jobs={jobsByDay.get(`${cell.date.getFullYear()}-${cell.date.getMonth()}-${cell.date.getDate()}`) ?? []}
                      onSelectJob={setSelectedJob}
                      activeDragId={activeDrag?.id ?? null}
                      tall
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Mobile: vertical list */}
            <div className="sm:hidden space-y-2">
              {weekCells.map((cell, i) => {
                const wJobs = jobsByDay.get(`${cell.date.getFullYear()}-${cell.date.getMonth()}-${cell.date.getDate()}`) ?? []
                return (
                  <div key={i} className={cn('rounded-xl border p-3', cell.isToday ? 'border-accent bg-accent-soft' : 'border-border')}>
                    <p className={cn('text-sm font-bold mb-2', cell.isToday ? 'text-accent' : cell.isWeekend ? 'text-danger' : 'text-ink-secondary')}>
                      {JALALI_WEEKDAYS[i]} {toPersianDigits(cell.jalali.day)}
                      {cell.holiday && <span className="text-2xs text-danger me-2"> — {cell.holiday}</span>}
                    </p>
                    {wJobs.length === 0 ? (
                      <p className="text-xs text-ink-tertiary">بدون رویداد</p>
                    ) : (
                      <div className="space-y-1.5">
                        {wJobs.map((job) => (
                          <button key={job.id} onClick={() => setSelectedJob(job)}
                            className={cn('n-focus-ring w-full flex items-center gap-2.5 rounded-lg border px-3 min-h-[44px] text-start', PLATFORM_CHIP[job.platform] ?? 'bg-surface-subtle text-ink-secondary border-border')}>
                            <Clock3 className="size-3.5 shrink-0" />
                            <span className="text-sm font-semibold truncate flex-1">{job.title}</span>
                            <span className="text-2xs shrink-0">{formatJalaliTime(new Date(job.scheduledAt))}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <DragOverlay>
              {activeDrag ? (
                <div className="rounded-lg bg-primary text-primary-foreground px-2 py-1 text-2xs font-bold shadow-xl max-w-56 truncate">
                  {activeDrag.title}
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </TabsContent>

        {/* ── Day view ── */}
        <TabsContent value="day" className="space-y-4">
          {/* Day nav */}
          <div className="n-card n-gradient-border p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={goPrevDay} aria-label="روز قبل">
                <ChevronRight className="size-4" />
              </Button>
              <div className="text-center min-w-[140px]">
                <p className="text-sm font-bold text-ink-primary">
                  {JALALI_WEEKDAYS[toJalali(dayCursor).weekday]}{' '}
                  {toPersianDigits(toJalali(dayCursor).day)}{' '}
                  {JALALI_MONTHS[toJalali(dayCursor).month - 1]}
                </p>
                <p className="text-2xs text-ink-tertiary">{toPersianDigits(toJalali(dayCursor).year)}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={goNextDay} aria-label="روز بعد">
                <ChevronLeft className="size-4" />
              </Button>
            </div>
            <Button variant="outline" size="sm" onClick={goDayToday}>امروز</Button>
          </div>

          <div className="n-card p-5">
            {dayJobs.length === 0 ? (
              <EmptyState
                icon={CalendarDays}
                title="رویدادی برای این روز نیست"
                message="با زمان‌بندی محتوای جدید، این روز را پر کنید."
                illustration="calendar"
                action={
                  <Button size="sm" onClick={() => navigateTo('/compose')}>
                    <Plus className="size-4" />
                    ایجاد محتوا
                  </Button>
                }
              />
            ) : (
              <div className="space-y-2">
                {dayJobs.map((job) => (
                  <button
                    key={job.id}
                    onClick={() => setSelectedJob(job)}
                    className={cn(
                      'n-focus-ring w-full flex items-center gap-3 rounded-xl border px-4 min-h-[56px] text-start',
                      PLATFORM_CHIP[job.platform] ?? 'bg-surface-subtle text-ink-secondary border-border'
                    )}
                  >
                    <span className="text-sm font-bold tabular-nums shrink-0 min-w-12">
                      {formatJalaliTime(new Date(job.scheduledAt))}
                    </span>
                    <PlatformIcon platform={job.platform} className="size-5 shrink-0" />
                    <span className="text-sm font-semibold flex-1 truncate">{job.title}</span>
                    <StatusBadge label={STATUS_LABEL[job.status] ?? job.status} variant={job.status} />
                  </button>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── Agenda view ── */}
        <TabsContent value="agenda" className="space-y-4">
          <div className="n-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <ListChecks className="size-4 text-accent" />
              <h2 className="text-sm font-semibold text-ink-primary">برنامه انتشار این ماه</h2>
            </div>
            {(jobs ?? []).length === 0 ? (
              <EmptyState
                icon={CalendarDays}
                title="برنامه‌ای برای این ماه ثبت نشده"
                message="با ایجاد اولین رویداد، برنامه انتشار این ماه را آغاز کنید."
                illustration="calendar"
                action={
                  <Button size="sm" onClick={() => navigateTo('/compose')}>
                    <Plus className="size-4" />
                    ایجاد محتوا
                  </Button>
                }
              />
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto thin-scrollbar">
                {(jobs ?? [])
                  .slice()
                  .sort(
                    (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
                  )
                  .map((job) => (
                    <button
                      key={job.id}
                      onClick={() => setSelectedJob(job)}
                      className="n-focus-ring w-full n-card-compact flex items-center gap-3 p-3 text-start"
                    >
                      <PlatformIcon platform={job.platform} className="size-8 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-ink-primary truncate">
                          {job.title}
                        </p>
                        <p className="text-xs text-ink-tertiary mt-0.5">
                          {formatJalali(new Date(job.scheduledAt), true)} •{' '}
                          {formatJalaliTime(new Date(job.scheduledAt))}
                        </p>
                      </div>
                      <StatusBadge
                        label={STATUS_LABEL[job.status] ?? job.status}
                        variant={job.status}
                      />
                    </button>
                  ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Queue */}
      <div className="n-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Radio className="size-4 text-accent" />
          <h2 className="text-sm font-semibold text-ink-primary">صف انتشار</h2>
          <span className="text-2xs text-ink-tertiary ms-auto num-tabular">
            {toPersianDigits(queue?.length ?? 0)} کار در صف
          </span>
        </div>
        {!queue || queue.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="صف انتشار خالی است"
            message="هیچ کاری در صف انتشار وجود ندارد. با زمان‌بندی پست‌ها، صف را پر کنید."
            illustration="calendar"
          />
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto thin-scrollbar">
            {queue.map((job) => (
              <QueueRow key={job.id} job={job} />
            ))}
          </div>
        )}
      </div>

      {/* Job detail sheet */}
      <Sheet open={!!selectedJob} onOpenChange={(o) => !o && setSelectedJob(null)}>
        <SheetContent side="left" className="w-full sm:max-w-md">
          {selectedJob && (
            <>
              <SheetHeader>
                <SheetTitle className="text-start">{selectedJob.title}</SheetTitle>
                <SheetDescription className="text-start">
                  جزئیات انتشار برنامه‌ریزی‌شده
                </SheetDescription>
              </SheetHeader>
              <div className="px-4 pb-4 space-y-4 mt-4">
                {selectedJob.thumbnail && (
                  <img
                    src={selectedJob.thumbnail}
                    alt={selectedJob.title}
                    className="w-full aspect-video rounded-xl object-cover"
                  />
                )}
                <div className="flex items-center gap-3">
                  <PlatformIcon platform={selectedJob.platform} className="size-10" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-ink-primary">
                      {selectedJob.platform}
                    </p>
                    <StatusBadge
                      label={STATUS_LABEL[selectedJob.status] ?? selectedJob.status}
                      variant={selectedJob.status}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl bg-surface-subtle p-3">
                    <p className="text-2xs text-ink-tertiary mb-1">زمان انتشار</p>
                    <p className="font-bold text-ink-primary">
                      {formatJalali(new Date(selectedJob.scheduledAt), true)}
                    </p>
                    <p className="text-ink-secondary">
                      {formatJalaliTime(new Date(selectedJob.scheduledAt))}
                    </p>
                  </div>
                  <div className="rounded-xl bg-surface-subtle p-3">
                    <p className="text-2xs text-ink-tertiary mb-1">پیشرفت</p>
                    <p className="font-bold text-ink-primary num-tabular">
                      {toPersianDigits(selectedJob.progress)}٪
                    </p>
                  </div>
                </div>
                <Button className="w-full" variant="outline" onClick={() => navigateTo('/compose')}>
                  ایجاد محتوای جدید
                </Button>
              </div>

              {/* Reschedule section — uses JalaliDatePicker popover */}
              <div className="rounded-xl border border-border bg-surface-subtle p-3 space-y-3">
                <div className="flex items-center gap-2">
                  <CalendarClock className="size-4 text-accent" />
                  <p className="text-sm font-semibold text-ink-primary">تغییر زمان‌بندی</p>
                </div>
                <JalaliDatePicker
                  value={editingSchedule ?? new Date(selectedJob.scheduledAt)}
                  onChange={(d) => {
                    if (d) setEditingSchedule(d)
                  }}
                  showTime
                  inline
                  placeholder="انتخاب تاریخ و ساعت جدید"
                  className="w-full"
                />
                {editingSchedule && (
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-ink-tertiary">
                      جدید: {formatJalali(editingSchedule, true)} •{' '}
                      {formatJalaliTime(editingSchedule)}
                    </span>
                    <Button
                      size="sm"
                      className="h-7 text-xs"
                      disabled={rescheduleMutation.isPending}
                      onClick={() =>
                        rescheduleMutation.mutate({
                          jobId: selectedJob.id,
                          scheduledAt: editingSchedule,
                        })
                      }
                    >
                      {rescheduleMutation.isPending ? 'در حال ذخیره...' : 'ذخیره زمان جدید'}
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </motion.div>
  )
}

function DayCell({
  cell,
  jobs,
  onSelectJob,
  activeDragId,
  tall = false,
}: {
  cell: CalendarCell
  jobs: CalendarJob[]
  onSelectJob: (j: CalendarJob) => void
  activeDragId?: string | null
  tall?: boolean
}) {
  const day = toPersianDigits(cell.jalali.day)
  const dropId = `day-${cell.date.toISOString()}`
  const { setNodeRef, isOver } = useDroppable({
    id: dropId,
    data: { date: cell.date },
  })
  return (
    <div
      ref={setNodeRef}
      aria-label={`انتقال به ${day} ${JALALI_MONTHS[cell.jalali.month - 1]}`}
      className={cn(
        'rounded-xl border p-1.5 transition-colors relative',
        tall ? 'min-h-32' : 'min-h-20 sm:min-h-24',
        isOver && 'ring-2 ring-accent ring-offset-1',
        cell.isToday
          ? 'border-accent ring-1 ring-accent/30 bg-accent-soft'
          : cell.holiday
            ? 'border-danger-soft bg-danger-tint/40'
            : cell.isWeekend && cell.inMonth
              ? 'border-border bg-surface-hover'
              : 'border-border',
        !cell.inMonth && 'opacity-40'
      )}
    >
      <div className="flex items-center justify-between mb-1">
        <span
          className={cn(
            'text-xs font-bold leading-none',
            cell.isToday
              ? 'bg-accent text-white rounded-full size-5 inline-flex items-center justify-center'
              : cell.holiday
                ? 'text-danger'
                : cell.isWeekend
                  ? 'text-danger'
                  : 'text-ink-secondary'
          )}
        >
          {day}
        </span>
        {cell.holiday && (
          <span className="text-2xs text-danger truncate max-w-12" title={cell.holiday}>
            {cell.holiday}
          </span>
        )}
      </div>
      <div className="space-y-0.5">
        {jobs.slice(0, tall ? 5 : 3).map((job) => (
          <JobChip
            key={job.id}
            job={job}
            onSelectJob={onSelectJob}
            isDimmed={activeDragId === job.id}
          />
        ))}
        {jobs.length > (tall ? 5 : 3) && (
          <p className="text-2xs text-ink-tertiary px-1.5">
            +{toPersianDigits(jobs.length - (tall ? 5 : 3))} مورد دیگر
          </p>
        )}
      </div>
    </div>
  )
}

function JobChip({
  job,
  onSelectJob,
  isDimmed,
}: {
  job: CalendarJob
  onSelectJob: (j: CalendarJob) => void
  isDimmed: boolean
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: job.id,
    data: { jobId: job.id, scheduledAt: job.scheduledAt },
  })
  return (
    <button
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={() => onSelectJob(job)}
      aria-label="کشیدن برای جابجایی"
      title={job.title}
      className={cn(
        'n-focus-ring w-full text-start text-2xs font-semibold px-1.5 py-1 rounded-md border truncate flex items-center gap-1 hover:scale-[1.02] transition-transform cursor-grab active:cursor-grabbing',
        PLATFORM_CHIP[job.platform] ?? 'bg-surface-subtle text-ink-secondary border-border',
        (isDragging || isDimmed) && 'opacity-30'
      )}
    >
      <Clock3 className="size-2.5 shrink-0" />
      <span className="truncate">{job.title}</span>
    </button>
  )
}

function QueueRow({ job }: { job: PublishJob }) {
  return (
    <div className="n-card-compact flex items-center gap-3 p-3">
      <div className="relative shrink-0">
        {job.thumbnail ? (
          <img src={job.thumbnail} alt="" className="size-11 rounded-xl object-cover" />
        ) : (
          <div className="size-11 rounded-xl bg-border flex items-center justify-center">
            <PlatformIcon platform={job.platform} className="size-5" />
          </div>
        )}
        <span className="absolute -bottom-1 -end-1 flex size-5 items-center justify-center rounded-full bg-background ring-1 ring-border">
          <PlatformIcon platform={job.platform} className="size-3" />
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-ink-primary truncate">{job.title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-2xs text-ink-tertiary truncate">{job.platformName}</span>
          <span className="text-ink-tertiary">•</span>
          <span className="text-2xs text-ink-tertiary truncate">{job.campaign}</span>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <StatusBadge label={job.statusLabel} variant={job.status} />
          <span className="text-2xs text-ink-tertiary">
            {job.scheduledAt ? relativeTime(new Date(job.scheduledAt)) : job.processLabel}
          </span>
        </div>
      </div>
      <Avatar className="size-7 shrink-0 ring-2 ring-background">
        {job.assigneeAvatar ? <AvatarImage src={job.assigneeAvatar} alt={job.assignee} /> : null}
        <AvatarFallback className="text-2xs">
          {!job.assignee || job.assignee === '—' ? '؟' : job.assignee.slice(0, 1)}
        </AvatarFallback>
      </Avatar>
    </div>
  )
}
