'use client'

import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
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
  JALALI_WEEKDAYS_SHORT,
  toPersianDigits,
  formatJalali,
  formatJalaliTime,
  relativeTime,
  getJalaliMonthGrid,
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
  instagram: 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-400 border-pink-200 dark:border-pink-800/50',
  telegram: 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400 border-sky-200 dark:border-sky-800/50',
  linkedin: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800/50',
  rubika: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800/50',
  eitaa: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800/50',
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
  const [view, setView] = useState<'month' | 'week' | 'agenda'>(() =>
    typeof window !== 'undefined' && window.innerWidth < 640 ? 'agenda' : 'month'
  )
  const [selectedJob, setSelectedJob] = useState<CalendarJob | null>(null)
  const [editingSchedule, setEditingSchedule] = useState<Date | null>(null)
  const [activeDrag, setActiveDrag] = useState<{ id: string; title: string } | null>(null)
  const queryClient = useQueryClient()

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

  const { data: jobs, isLoading } = useQuery<CalendarJob[]>({
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
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
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
                    i >= 5 ? 'text-rose-500' : 'text-ink-tertiary'
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

        {/* ── Week view (simplified) ── */}
        <TabsContent value="week" className="space-y-4">
          <div className="n-card p-3 sm:p-5">
            <p className="text-sm text-ink-tertiary mb-3">نمای هفته‌ای — هفته جاری</p>
            {/* Desktop: 7-col grid */}
            <div className="hidden sm:block overflow-x-auto">
              <div className="min-w-[320px] grid grid-cols-7 gap-2">
                {cells.slice(7, 14).map((cell, i) => (
                  <DayCell
                    key={i}
                    cell={cell}
                    jobs={
                      jobsByDay.get(
                        `${cell.date.getFullYear()}-${cell.date.getMonth()}-${cell.date.getDate()}`
                      ) ?? []
                    }
                    onSelectJob={setSelectedJob}
                    tall
                  />
                ))}
              </div>
            </div>
            {/* Mobile: vertical day list */}
            <div className="sm:hidden space-y-2">
              {cells.slice(7, 14).map((cell, i) => {
                const dayJobs = jobsByDay.get(
                  `${cell.date.getFullYear()}-${cell.date.getMonth()}-${cell.date.getDate()}`
                ) ?? []
                return (
                  <div key={i} className={cn(
                    'rounded-xl border p-3',
                    cell.isToday ? 'border-accent bg-accent-soft' : 'border-border'
                  )}>
                    <p className={cn(
                      'text-sm font-bold mb-2',
                      cell.isToday ? 'text-accent' : cell.isWeekend ? 'text-rose-500' : 'text-ink-secondary'
                    )}>
                      {JALALI_WEEKDAYS_SHORT[i % 7]} {toPersianDigits(cell.jalali.day)}
                      {cell.holiday && <span className="text-2xs text-rose-500 me-2">— {cell.holiday}</span>}
                    </p>
                    {dayJobs.length === 0 ? (
                      <p className="text-xs text-ink-tertiary">بدون رویداد</p>
                    ) : (
                      <div className="space-y-1.5">
                        {dayJobs.map((job) => (
                          <button
                            key={job.id}
                            onClick={() => setSelectedJob(job)}
                            className={cn(
                              'n-focus-ring w-full flex items-center gap-2.5 rounded-lg border px-3 min-h-[44px] text-right',
                              PLATFORM_CHIP[job.platform] ?? 'bg-slate-100 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                            )}
                          >
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
                      className="n-focus-ring w-full n-card-compact flex items-center gap-3 p-3 text-right"
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
                <SheetTitle className="text-right">{selectedJob.title}</SheetTitle>
                <SheetDescription className="text-right">
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
            ? 'border-rose-200 bg-rose-50/40'
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
                ? 'text-rose-600'
                : cell.isWeekend
                  ? 'text-rose-500'
                  : 'text-ink-secondary'
          )}
        >
          {day}
        </span>
        {cell.holiday && (
          <span className="text-2xs text-rose-500 truncate max-w-12" title={cell.holiday}>
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
        'n-focus-ring w-full text-right text-2xs font-semibold px-1.5 py-1 rounded-md border truncate flex items-center gap-1 hover:scale-[1.02] transition-transform cursor-grab active:cursor-grabbing',
        PLATFORM_CHIP[job.platform] ?? 'bg-slate-100 text-slate-700 border-slate-200',
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
        <span className="absolute -bottom-1 -left-1 flex size-5 items-center justify-center rounded-full bg-background ring-1 ring-border">
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
          {job.assignee === '—' ? '؟' : job.assignee.slice(0, 1)}
        </AvatarFallback>
      </Avatar>
    </div>
  )
}
