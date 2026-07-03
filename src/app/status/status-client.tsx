'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, AlertTriangle, XCircle, RefreshCw, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'

interface HealthResult {
  status: string
  version?: string
  uptime?: number
  environment?: string
}

interface ReadinessResult {
  status: 'ready' | 'not_ready'
  checks?: Record<string, string>
}

type ServiceStatus = 'operational' | 'degraded' | 'down' | 'checking'

interface Service {
  key: string
  name: string
  description: string
  status: ServiceStatus
}

const STATUS_LABELS: Record<ServiceStatus, string> = {
  operational: 'عملیاتی',
  degraded: 'کاهش عملکرد',
  down: 'قطع',
  checking: 'در حال بررسی…',
}

const STATUS_COLORS: Record<ServiceStatus, string> = {
  operational: 'text-success',
  degraded: 'text-warning',
  down: 'text-danger',
  checking: 'text-ink-tertiary',
}

function StatusIcon({ status }: { status: ServiceStatus }) {
  if (status === 'operational') return <CheckCircle2 className="size-5 text-success" />
  if (status === 'degraded') return <AlertTriangle className="size-5 text-warning" />
  if (status === 'down') return <XCircle className="size-5 text-danger" />
  return <RefreshCw className="size-4 text-ink-tertiary animate-spin" />
}

function overallStatus(services: Service[]): ServiceStatus {
  if (services.every((s) => s.status === 'checking')) return 'checking'
  if (services.some((s) => s.status === 'down')) return 'down'
  if (services.some((s) => s.status === 'degraded')) return 'degraded'
  return 'operational'
}

const OVERALL_BG: Record<ServiceStatus, string> = {
  operational: 'bg-success/10 border-success/30',
  degraded: 'bg-warning/10 border-warning/30',
  down: 'bg-danger/10 border-danger/30',
  checking: 'bg-surface-subtle border-border',
}

const OVERALL_LABEL: Record<ServiceStatus, string> = {
  operational: 'همه سرویس‌ها عملیاتی هستند',
  degraded: 'برخی سرویس‌ها با کاهش عملکرد مواجه‌اند',
  down: 'اختلال در سرویس — تیم در حال بررسی است',
  checking: 'در حال بررسی وضعیت سرویس‌ها…',
}

export function StatusPageClient() {
  const [health, setHealth] = useState<HealthResult | null>(null)
  const [readiness, setReadiness] = useState<ReadinessResult | null>(null)
  const [lastChecked, setLastChecked] = useState<Date | null>(null)
  const [checking, setChecking] = useState(true)

  async function check() {
    setChecking(true)
    try {
      const [h, r] = await Promise.allSettled([
        fetch('/api/health').then((res) => res.json()),
        fetch('/api/readyz').then((res) => res.json()),
      ])
      if (h.status === 'fulfilled') setHealth(h.value as HealthResult)
      if (r.status === 'fulfilled') setReadiness(r.value as ReadinessResult)
      setLastChecked(new Date())
    } finally {
      setChecking(false)
    }
  }

  useEffect(() => {
    check()
    const interval = setInterval(check, 60_000)
    return () => clearInterval(interval)
  }, [])

  const dbStatus: ServiceStatus =
    readiness === null
      ? 'checking'
      : readiness.status === 'ready'
        ? 'operational'
        : 'down'

  const apiStatus: ServiceStatus =
    health === null ? 'checking' : health.status === 'ok' ? 'operational' : 'degraded'

  const services: Service[] = [
    {
      key: 'api',
      name: 'API نشرینو',
      description: 'سرور اصلی و REST API',
      status: apiStatus,
    },
    {
      key: 'db',
      name: 'پایگاه داده',
      description: 'ذخیره‌سازی محتوا، کاربران، و کمپین‌ها',
      status: dbStatus,
    },
    {
      key: 'workers',
      name: 'صف انتشار',
      description: 'پردازش و ارسال پست‌ها به شبکه‌های اجتماعی',
      status: checking ? 'checking' : apiStatus === 'operational' ? 'operational' : 'degraded',
    },
    {
      key: 'media',
      name: 'ذخیره‌سازی رسانه',
      description: 'آپلود و ارائه تصاویر و ویدیوها',
      status: checking ? 'checking' : 'operational',
    },
    {
      key: 'realtime',
      name: 'اعلان‌های لحظه‌ای',
      description: 'به‌روزرسانی وضعیت انتشار در لحظه',
      status: checking ? 'checking' : 'operational',
    },
    {
      key: 'ai',
      name: 'هوش مصنوعی',
      description: 'پیشنهاد کپشن و تولید محتوا با AI',
      status: checking ? 'checking' : 'operational',
    },
  ]

  const overall = overallStatus(services)

  return (
    <div dir="rtl" className="min-h-screen bg-canvas px-4 py-12">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link
              href="/"
              className="flex items-center gap-2 text-ink-tertiary hover:text-ink-primary transition-colors text-sm mb-4"
            >
              <div className="flex size-6 items-center justify-center rounded-md bg-accent">
                <span className="text-xs font-bold text-white">N</span>
              </div>
              <span className="font-semibold">نشرینو</span>
            </Link>
            <h1 className="text-xl font-bold text-ink-primary">وضعیت سرویس</h1>
            {lastChecked && (
              <p className="text-sm text-ink-tertiary mt-0.5">
                آخرین بررسی:{' '}
                {lastChecked.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
          <button
            onClick={check}
            disabled={checking}
            className={cn(
              'flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-ink-secondary hover:bg-surface-hover transition-colors',
              checking && 'opacity-50 cursor-not-allowed',
            )}
          >
            <RefreshCw className={cn('size-4', checking && 'animate-spin')} />
            به‌روزرسانی
          </button>
        </div>

        {/* Overall status banner */}
        <div
          className={cn(
            'rounded-2xl border p-5 mb-6 flex items-center gap-4',
            OVERALL_BG[overall],
          )}
        >
          <StatusIcon status={overall} />
          <div>
            <p className="font-semibold text-ink-primary">{OVERALL_LABEL[overall]}</p>
            {health?.version && (
              <p className="text-sm text-ink-tertiary mt-0.5">نسخه {health.version}</p>
            )}
          </div>
        </div>

        {/* Per-service list */}
        <div className="space-y-2">
          {services.map((s) => (
            <div
              key={s.key}
              className="flex items-center justify-between rounded-xl border border-border bg-surface-raised px-4 py-3.5"
            >
              <div>
                <p className="text-sm font-semibold text-ink-primary">{s.name}</p>
                <p className="text-xs text-ink-tertiary mt-0.5">{s.description}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn('text-xs font-medium', STATUS_COLORS[s.status])}>
                  {STATUS_LABELS[s.status]}
                </span>
                <StatusIcon status={s.status} />
              </div>
            </div>
          ))}
        </div>

        {/* Footer links */}
        <div className="mt-8 pt-6 border-t border-border flex items-center gap-6 text-sm text-ink-tertiary">
          <Link
            href="/help"
            className="flex items-center gap-1 hover:text-ink-primary transition-colors"
          >
            <ExternalLink className="size-3.5" />
            مرکز راهنما
          </Link>
          <a
            href="mailto:support@nashrino.com"
            className="flex items-center gap-1 hover:text-ink-primary transition-colors"
          >
            پشتیبانی
          </a>
          <a
            href="mailto:security@nashrino.com"
            className="flex items-center gap-1 hover:text-ink-primary transition-colors"
          >
            گزارش امنیتی
          </a>
        </div>
      </div>
    </div>
  )
}
