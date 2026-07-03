'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { toPersianDigits, relativeTime } from '@/lib/jalali'
import { PlatformIcon, PanelHeader, LinkAction, EmptyState } from './shared'
import {
  Radio,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  RefreshCw,
  RotateCcw,
  WifiOff,
  X,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

interface PulseJob {
  id: string
  title: string
  desc: string
  platform: string
  platformName: string
  status: string
  type: string
  schedule: string | null
  processLabel: string
  progress: number
  errorCategory: string | null
  assignee: string
  assigneeAvatar: string
  campaign: string
  thumbnail: string
  platformColor: string
  platformBg: string
}

export function PublishingPulse() {
  const queryClient = useQueryClient()
  const { data } = useQuery<PulseJob[]>({
    queryKey: ['dashboard-pulse'],
    queryFn: () => api.get<PulseJob[]>('/api/dashboard/pulse'),
    refetchInterval: 10000,
  })
  const router = useRouter()
  const navigateTo = (path: string) => router.push(path)

  // #113: retry / cancel mutations — refetch pulse on success
  const retryMutation = useMutation({
    mutationFn: (jobId: string) => api.patch(`/api/publish-jobs/${jobId}`, { action: 'retry' }),
    onSuccess: () => {
      toast.success('کار برای تلاش مجدد به صف بازگردانده شد')
      queryClient.invalidateQueries({ queryKey: ['dashboard-pulse'] })
    },
    onError: () => toast.error('خطا در تلاش مجدد'),
  })

  const cancelMutation = useMutation({
    mutationFn: (jobId: string) => api.patch(`/api/publish-jobs/${jobId}`, { action: 'cancel' }),
    onSuccess: () => {
      toast.success('انتشار لغو شد')
      queryClient.invalidateQueries({ queryKey: ['dashboard-pulse'] })
    },
    onError: () => toast.error('خطا در لغو انتشار'),
  })

  return (
    <div className="n-card p-5 h-full flex flex-col">
      <PanelHeader
        icon={Radio}
        title="نبض انتشار"
        subtitle="وضعیت لحظه‌ای انتشارها"
        action={<LinkAction onClick={() => navigateTo('/calendar')}>مشاهده صف ←</LinkAction>}
      />

      <div className="flex-1 overflow-y-auto thin-scrollbar -mx-1 px-1 space-y-1.5">
        {data?.map((job) => (
          <PulseItem
            key={job.id}
            job={job}
            onRetry={() => retryMutation.mutate(job.id)}
            onCancel={() => cancelMutation.mutate(job.id)}
            onReconnect={() => navigateTo('/channels')}
          />
        ))}
        {(!data || data.length === 0) && (
          <EmptyState
            icon={Clock3}
            title="هیچ انتشار فعالی وجود ندارد"
            message="انتشارهای در حال انجام و برنامه‌ریزی‌شده اینجا نمایش داده می‌شوند."
          />
        )}
      </div>
    </div>
  )
}

function PulseItem({
  job,
  onRetry,
  onCancel,
  onReconnect,
}: {
  job: PulseJob
  onRetry: () => void
  onCancel: () => void
  onReconnect: () => void
}) {
  const Icon =
    job.type === 'live'
      ? RefreshCw
      : job.type === 'action'
        ? AlertTriangle
        : job.type === 'success'
          ? CheckCircle2
          : Clock3
  const iconColor =
    job.type === 'live'
      ? 'text-accent'
      : job.type === 'action'
        ? 'text-danger'
        : job.type === 'success'
          ? 'text-success'
          : 'text-info'
  const iconBg =
    job.type === 'live'
      ? 'bg-accent-soft'
      : job.type === 'action'
        ? 'bg-danger-soft'
        : job.type === 'success'
          ? 'bg-success-soft'
          : 'bg-info-soft'

  return (
    <div className="n-card-compact flex items-start gap-2.5 p-2.5">
      {/* thumbnail */}
      <div className="relative shrink-0">
        {job.thumbnail ? (
          <img src={job.thumbnail} alt="" className="size-10 rounded-md object-cover" />
        ) : (
          <div className="flex size-10 items-center justify-center rounded-md bg-surface-hover">
            <PlatformIcon platform={job.platform} className="size-5" />
          </div>
        )}
        <span
          className={`absolute -bottom-1 -end-1 flex size-4 items-center justify-center rounded-full ${iconBg} ring-2 ring-canvas`}
        >
          <Icon
            className={`size-2.5 ${iconColor} ${job.type === 'live' ? 'animate-spin' : ''}`}
            strokeWidth={2.5}
          />
        </span>
      </div>

      {/* content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <PlatformIcon platform={job.platform} className="size-3.5" />
          <span className="text-xs font-medium text-ink-tertiary truncate">
            {job.platformName}
          </span>
          <span className={`text-2xs font-semibold ${iconColor} ms-auto`}>{job.status}</span>
        </div>
        <p className="text-sm font-semibold text-ink-primary truncate leading-snug">
          {job.title}
        </p>
        <p className="text-xs text-ink-tertiary truncate leading-tight">{job.campaign}</p>

        {/* progress */}
        {job.type === 'live' && (
          <div className="mt-1.5 flex items-center gap-2">
            <div className="flex-1 h-1 rounded-full bg-border overflow-hidden">
              <div
                className="h-full rounded-full bg-accent transition-all duration-300"
                style={{ width: `${job.progress}%` }}
              />
            </div>
            <span className="text-2xs font-semibold text-ink-secondary num-tabular">
              {toPersianDigits(job.progress)}٪
            </span>
          </div>
        )}
        {job.type !== 'live' && (
          <div className="mt-1 flex items-center gap-1 text-2xs text-ink-tertiary">
            <Clock3 className="size-2.5" strokeWidth={2} />
            <span>{job.schedule ? relativeTime(new Date(job.schedule)) : job.processLabel}</span>
          </div>
        )}

        {/* #113: repair actions for failed / action_required jobs */}
        {job.type === 'action' && (
          <div className="mt-2 flex items-center gap-1.5 flex-wrap">
            {job.errorCategory !== 'auth' && (
              <Button
                size="sm"
                variant="outline"
                className="h-6 px-2 text-2xs"
                onClick={onRetry}
              >
                <RotateCcw className="size-2.5 me-1" />
                تلاش مجدد
              </Button>
            )}
            {job.errorCategory === 'auth' && (
              <Button
                size="sm"
                variant="outline"
                className="h-6 px-2 text-2xs"
                onClick={onReconnect}
              >
                <WifiOff className="size-2.5 me-1" />
                اتصال مجدد
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-2xs text-ink-tertiary"
              onClick={onCancel}
            >
              <X className="size-2.5 me-1" />
              لغو
            </Button>
          </div>
        )}
      </div>

      {/* assignee */}
      {job.assigneeAvatar && (
        <img
          src={job.assigneeAvatar}
          alt={job.assignee}
          title={job.assignee}
          className="size-6 rounded-full ring-2 ring-white shrink-0"
        />
      )}
    </div>
  )
}
