'use client'

/**
 * Issue #131: Channel Health Center view.
 *
 * Shows per-channel diagnostics: connection status, token expiry countdown,
 * granted/missing scopes, last success, 7-day failure rate, API version,
 * reconnect action.
 */

import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  RefreshCw,
  Activity,
  Shield,
  ShieldAlert,
  Calendar,
} from 'lucide-react'
import { api } from '@/lib/api'
import { ease } from '@/lib/motion'
import { toPersianDigits, relativeTime } from '@/lib/jalali'
import {
  SectionTitle,
  PlatformIcon,
  SkeletonCard,
  LoadingState,
  EmptyState,
} from '@/components/dashboard/shared'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ChannelHealth {
  id: string
  name: string
  type: string
  username: string
  status: string
  statusLabel: string
  statusColor: string
  tokenExpiresAt: string | null
  daysRemaining: number | null
  tokenWarning: boolean
  tokenExpired: boolean
  grantedScopes: string[]
  requiredScopes: string[]
  missingScopes: string[]
  lastSuccessAt: string | null
  lastError: string | null
  lastValidatedAt: string | null
  failureRate7d: number
  attemptCount7d: number
  apiVersion: string
  reconnectUrl: string
}

export function ChannelHealthView() {
  const { data: channels, isLoading, isError, refetch } = useQuery<ChannelHealth[]>({
    queryKey: ['channels-health'],
    queryFn: () => api.get<ChannelHealth[]>('/api/channels/health'),
  })

  return (
    <motion.div
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: ease.enter }}
      className="space-y-4"
    >
      <SectionTitle icon={Activity} badge={
        <span className="text-xs text-ink-tertiary">
          {channels ? `${toPersianDigits(channels.length)} کانال` : '—'}
        </span>
      }>
        مرکز سلامت کانال‌ها
      </SectionTitle>

      <LoadingState
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
        errorLabel="خطا در بارگذاری وضعیت کانال‌ها"
        skeleton={
          <div className="grid gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonCard key={i} className="h-32" />
            ))}
          </div>
        }
      >
        {(!channels || channels.length === 0) ? (
          <EmptyState
            icon={Activity}
            title="هیچ کانالی متصل نیست"
            message="برای مشاهده وضعیت سلامت، ابتدا یک کانال متصل کنید."
          />
        ) : (
          <div className="grid gap-3 max-h-[calc(100vh-220px)] overflow-y-auto thin-scrollbar">
            {channels.map((ch, idx) => (
              <ChannelHealthCard key={ch.id} channel={ch} index={idx} />
            ))}
          </div>
        )}
      </LoadingState>
    </motion.div>
  )
}

function ChannelHealthCard({ channel: ch, index }: { channel: ChannelHealth; index: number }) {
  const isHealthy = ch.status === 'active' && !ch.tokenExpired && ch.missingScopes.length === 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.25 }}
      className="n-card p-4 space-y-3"
    >
      {/* Header: icon + name + status badge */}
      <div className="flex items-center gap-3">
        <div className={cn(
          'rounded-xl p-2',
          isHealthy ? 'bg-success-tint' : ch.tokenExpired ? 'bg-danger-tint' : 'bg-warning-tint'
        )}>
          <PlatformIcon platform={ch.type} className="size-6" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-ink-primary truncate">{ch.name}</h3>
          <p className="text-xs text-ink-tertiary truncate">
            @{ch.username || '—'} • {ch.apiVersion}
          </p>
        </div>
        <span className={cn(
          'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-2xs font-semibold',
          ch.statusColor
        )}>
          {ch.tokenExpired || ch.status === 'error' ? (
            <XCircle className="size-3" />
          ) : ch.tokenWarning || ch.missingScopes.length > 0 ? (
            <AlertTriangle className="size-3" />
          ) : (
            <CheckCircle2 className="size-3" />
          )}
          {ch.statusLabel}
        </span>
      </div>

      {/* Grid: token expiry + failure rate + last success */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {/* Token expiry */}
        <div className="rounded-lg bg-surface-subtle p-2.5">
          <div className="flex items-center gap-1 mb-1">
            <Clock className="size-3 text-ink-tertiary" />
            <span className="text-2xs font-semibold text-ink-secondary">انقضای توکن</span>
          </div>
          {ch.daysRemaining !== null ? (
            <p className={cn(
              'text-sm font-bold num-tabular',
              ch.tokenExpired ? 'text-danger' : ch.tokenWarning ? 'text-warning' : 'text-ink-primary'
            )}>
              {ch.tokenExpired ? 'منقضی شده' : `${toPersianDigits(ch.daysRemaining)} روز دیگر`}
            </p>
          ) : (
            <p className="text-sm text-ink-tertiary">بدون انقضا</p>
          )}
          {ch.tokenExpiresAt && (
            <p className="text-2xs text-ink-tertiary mt-0.5">
              {relativeTime(new Date(ch.tokenExpiresAt))}
            </p>
          )}
        </div>

        {/* 7-day failure rate */}
        <div className="rounded-lg bg-surface-subtle p-2.5">
          <div className="flex items-center gap-1 mb-1">
            <Activity className="size-3 text-ink-tertiary" />
            <span className="text-2xs font-semibold text-ink-secondary">نرخ خطا (۷ روز)</span>
          </div>
          <p className={cn(
            'text-sm font-bold num-tabular',
            ch.failureRate7d > 20 ? 'text-danger' : ch.failureRate7d > 5 ? 'text-warning' : 'text-success'
          )}>
            {toPersianDigits(ch.failureRate7d)}٪
          </p>
          <p className="text-2xs text-ink-tertiary mt-0.5">
            {toPersianDigits(ch.attemptCount7d)} تلاش
          </p>
        </div>

        {/* Last success */}
        <div className="rounded-lg bg-surface-subtle p-2.5">
          <div className="flex items-center gap-1 mb-1">
            <Calendar className="size-3 text-ink-tertiary" />
            <span className="text-2xs font-semibold text-ink-secondary">آخرین موفقیت</span>
          </div>
          {ch.lastSuccessAt ? (
            <>
              <p className="text-sm font-semibold text-ink-primary">
                {relativeTime(new Date(ch.lastSuccessAt))}
              </p>
            </>
          ) : (
            <p className="text-sm text-ink-tertiary">هنوز منتشر نشده</p>
          )}
        </div>
      </div>

      {/* OAuth scopes: granted + missing */}
      {(ch.requiredScopes.length > 0) && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1">
            {ch.missingScopes.length > 0 ? (
              <ShieldAlert className="size-3.5 text-danger" />
            ) : (
              <Shield className="size-3.5 text-success" />
            )}
            <span className="text-xs font-semibold text-ink-secondary">دسترسی‌های OAuth</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {ch.requiredScopes.map((scope) => {
              const granted = ch.grantedScopes.includes(scope)
              return (
                <span
                  key={scope}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-2xs font-semibold border',
                    granted
                      ? 'border-success-soft bg-success-tint text-success'
                      : 'border-danger-soft bg-danger-tint text-danger'
                  )}
                >
                  {granted ? <CheckCircle2 className="size-2.5" /> : <XCircle className="size-2.5" />}
                  {scope}
                </span>
              )
            })}
          </div>
          {ch.missingScopes.length > 0 && (
            <p className="text-2xs text-danger">
              {toPersianDigits(ch.missingScopes.length)} دسترسی مفقود — نیاز به اتصال مجدد
            </p>
          )}
        </div>
      )}

      {/* Last error (if any) */}
      {ch.lastError && (
        <div className="rounded-lg border border-danger-soft bg-danger-tint/50 p-2">
          <p className="text-2xs font-semibold text-danger mb-0.5">آخرین خطا</p>
          <p className="text-2xs text-danger truncate" title={ch.lastError}>
            {ch.lastError}
          </p>
        </div>
      )}

      {/* Reconnect action */}
      <div className="flex justify-start pt-1">
        <Button
          size="sm"
          variant={ch.tokenExpired || ch.missingScopes.length > 0 ? 'default' : 'outline'}
          className="n-focus-ring text-xs h-8"
          onClick={() => {
            window.location.href = ch.reconnectUrl
          }}
        >
          <RefreshCw className="size-3.5" />
          اتصال مجدد
        </Button>
      </div>
    </motion.div>
  )
}
