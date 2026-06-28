'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { toPersianDigits } from '@/lib/jalali'
import { CountUp } from '@/lib/motion'
import { Activity, CheckCircle2, Clock, AlertTriangle, Inbox, Flag, Zap } from 'lucide-react'

interface Summary {
  health: string
  healthLabel: string
  healthColor: string
  publishedToday: number
  queued: number
  processing: number
  failed: number
  pendingApproval: number
  unreadInbox: number
  activeCampaigns: number
  disconnected: number
  slaRisk: number
}

export function OperationalSummary() {
  const { data } = useQuery<Summary>({
    queryKey: ['dashboard-summary'],
    queryFn: () => api.get<Summary>('/api/dashboard/summary'),
    refetchInterval: 15000,
  })

  const healthIcon =
    data?.health === 'healthy' ? CheckCircle2 : data?.health === 'warning' ? AlertTriangle : Zap

  const healthTone: Record<string, string> = {
    healthy: 'text-success bg-success-soft border-success/20',
    warning: 'text-warning bg-warning-soft border-warning/20',
    critical: 'text-danger bg-danger-soft border-danger/20',
  }

  return (
    <div className="n-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex size-7 items-center justify-center rounded-md bg-accent-soft">
            <Activity className="size-[14px] text-accent" strokeWidth={2} />
          </div>
          <div className="leading-tight">
            <h2 className="text-[13px] font-[700] text-ink-primary tracking-tight">خلاصه عملیات</h2>
            <p className="text-[11px] text-ink-tertiary mt-0.5 leading-tight">
              وضعیت لحظه‌ای سیستم
            </p>
          </div>
        </div>
        {data && (
          <span
            className={`inline-flex items-center gap-1 text-[10.5px] font-[600] px-2 py-1 rounded-md border ${healthTone[data.health] ?? healthTone.warning}`}
          >
            {(() => {
              const Icon = healthIcon
              return <Icon className="size-3" strokeWidth={2.5} />
            })()}
            {data.healthLabel}
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
        <Stat
          icon={CheckCircle2}
          label="منتشرشده امروز"
          value={data?.publishedToday}
          color="text-success"
          bg="bg-success-soft"
        />
        <Stat icon={Clock} label="در صف" value={data?.queued} color="text-info" bg="bg-info-soft" />
        <Stat
          icon={Activity}
          label="در حال پردازش"
          value={data?.processing}
          color="text-accent"
          bg="bg-accent-soft"
        />
        <Stat
          icon={AlertTriangle}
          label="ناموفق"
          value={data?.failed}
          color="text-danger"
          bg="bg-danger-soft"
        />
        <Stat
          icon={CheckCircle2}
          label="در انتظار تأیید"
          value={data?.pendingApproval}
          color="text-warning"
          bg="bg-warning-soft"
        />
        <Stat
          icon={Inbox}
          label="خوانده‌نشده"
          value={data?.unreadInbox}
          color="text-info"
          bg="bg-info-soft"
        />
        <Stat
          icon={Flag}
          label="کمپین‌های فعال"
          value={data?.activeCampaigns}
          color="text-accent"
          bg="bg-accent-soft"
        />
      </div>
    </div>
  )
}

function Stat({
  icon: Icon,
  label,
  value,
  color,
  bg,
}: {
  icon: typeof Activity
  label: string
  value?: number
  color: string
  bg: string
}) {
  return (
    <div className="n-card-compact flex flex-col gap-1.5 p-2.5">
      <div className="flex items-center gap-1.5">
        <span className={`flex size-5 items-center justify-center rounded-md ${bg}`}>
          <Icon className={`size-3 ${color}`} strokeWidth={2} />
        </span>
        <span className="text-[10px] font-[500] text-ink-secondary leading-tight line-clamp-1">
          {label}
        </span>
      </div>
      <span className="text-[22px] font-[700] text-ink-primary num-tabular leading-none tracking-tight">
        {value != null ? <CountUp value={value} duration={600} /> : '—'}
      </span>
    </div>
  )
}
