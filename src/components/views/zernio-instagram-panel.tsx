'use client'

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { ExternalLink, PlugZap } from 'lucide-react'
import { api } from '@/lib/api'
import { PlatformIcon } from '@/components/dashboard/shared'
import { Button } from '@/components/ui/button'
import type { ZernioAccountHealth } from '../../../shared/zernio-health'

interface InstagramAccount {
  id: string
  platformId: string | null
  username: string
  displayName: string | null
  profileUrl: string | null
  avatarUrl: string | null
  bio: string | null
  websiteUrl: string | null
  followersCount: number | null
  isActive: boolean
}

interface InstagramPost {
  id: string
  caption: string | null
  permalink: string | null
  mediaType: string | null
  likeCount: number | null
  commentCount: number | null
}

interface InstagramOverview {
  insights: {
    reach: number | null
    views: number | null
    accountsEngaged: number | null
    totalInteractions: number | null
  } | null
  insightsStatus: 'available' | 'upgrade_required' | 'unavailable'
  recentPosts: InstagramPost[]
  postsStatus: 'available' | 'unavailable'
}

const numberFormatter = new Intl.NumberFormat('fa-IR')

function count(value: number | null | undefined): string {
  return typeof value === 'number' ? numberFormatter.format(value) : '—'
}

interface InitialSyncRun {
  status: string
  currentStep: string | null
  importedMediaCount: number
  canResume: boolean
}

function connectionStatus(
  isActive: boolean,
  health: ZernioAccountHealth | undefined,
  loading: boolean,
  error: boolean,
): { label: string; className: string } {
  if (!isActive || health?.tokenValid === false) return { label: 'نیازمند اتصال مجدد', className: 'text-warning' }
  if (error || (!loading && !health)) return { label: 'وضعیت اتصال نامشخص', className: 'text-warning' }
  if (loading) return { label: 'در حال بررسی اتصال…', className: 'text-ink-tertiary' }
  if (health?.status === 'error') return { label: 'اتصال نیازمند بررسی', className: 'text-warning' }
  if (health?.tokenValid !== true) return { label: 'وضعیت مجوز نامشخص', className: 'text-warning' }
  if (health.status === 'warning' || health.canPost !== true || health.canFetchAnalytics === false) {
    return { label: 'اتصال محدود', className: 'text-warning' }
  }
  return { label: 'سلامت اتصال در Zernio تأیید شد', className: 'text-success' }
}

function InstagramAccountCard({ account }: { account: InstagramAccount }) {
  const [retryingSync, setRetryingSync] = useState(false)
  const [syncActionError, setSyncActionError] = useState(false)
  const { data: syncData, refetch: refreshSync } = useQuery<{ run: InitialSyncRun | null }>({
    queryKey: ['instagram-initial-sync', account.platformId],
    queryFn: () => api.get(`/api/platforms/sync-status?platformId=${encodeURIComponent(account.platformId ?? '')}&source=zernio`),
    enabled: !!account.platformId,
    refetchInterval: (query) => ['PENDING', 'RUNNING'].includes(query.state.data?.run?.status ?? '') ? 5_000 : false,
  })
  const syncRun = syncData?.run
  async function resumeSync() {
    if (!account.platformId || retryingSync) return
    setRetryingSync(true)
    setSyncActionError(false)
    try {
      await api.post('/api/platforms/sync-status', { platformId: account.platformId })
      await refreshSync()
    } catch {
      setSyncActionError(true)
    } finally {
      setRetryingSync(false)
    }
  }
  const { data: overview, isLoading, isError } = useQuery<InstagramOverview>({
    queryKey: ['zernio-instagram-overview', account.id],
    queryFn: () => api.get(`/api/platforms/zernio/instagram/accounts/${account.id}/overview`),
    enabled: account.isActive,
    staleTime: 5 * 60 * 1000,
  })

  const { data: healthData, isPending: healthLoading, isError: healthError, refetch: refreshHealth } = useQuery<{ health: ZernioAccountHealth }>({
    queryKey: ['zernio-instagram-health', account.id],
    queryFn: () => api.get(`/api/platforms/zernio/instagram/accounts/${account.id}/health`),
    enabled: account.isActive,
    staleTime: 60_000,
    refetchInterval: 60_000,
  })
  const health = healthData?.health
  const status = connectionStatus(account.isActive, health, healthLoading, healthError)

  const metrics = [
    { label: 'دنبال‌کنندگان', value: account.followersCount },
    { label: 'دسترسی ۳۰ روز', value: overview?.insights?.reach },
    { label: 'بازدید ۳۰ روز', value: overview?.insights?.views },
    { label: 'حساب‌های درگیر', value: overview?.insights?.accountsEngaged },
    { label: 'کل تعاملات', value: overview?.insights?.totalInteractions },
  ]

  return (
    <div className="rounded-xl border border-border p-4 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative size-12 shrink-0">
            <PlatformIcon platform="instagram" className="size-12" />
            {account.avatarUrl && (
              <img
                src={account.avatarUrl}
                alt={`تصویر پروفایل ${account.username}`}
                className="absolute inset-0 size-12 rounded-full object-cover"
                onError={(event) => { event.currentTarget.style.display = 'none' }}
              />
            )}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-ink-primary truncate">{account.displayName || account.username || 'Instagram'}</p>
            <p className="text-xs text-ink-tertiary truncate" dir="ltr">@{account.username || '—'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className={status.className}>
            {status.label}
          </span>
          {account.profileUrl && (
            <a href={account.profileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-accent">
              مشاهده پروفایل <ExternalLink className="size-3" />
            </a>
          )}
        </div>
      </div>

      {account.isActive && (
        <div className="rounded-lg border border-border bg-surface-subtle p-3 text-xs text-ink-secondary" aria-live="polite">
          {healthError ? (
            <div className="flex flex-wrap items-center gap-2">
              <span>بررسی سلامت اتصال ممکن نشد؛ این به‌تنهایی به معنی قطع اتصال نیست.</span>
              <Button variant="outline" size="sm" onClick={() => void refreshHealth()}>بررسی دوباره</Button>
            </div>
          ) : health ? (
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <span>انتشار: {health.canPost === true ? 'مجاز' : health.canPost === false ? 'نیازمند مجوز' : 'نامشخص'}</span>
              <span>آمار: {health.canFetchAnalytics === true ? 'مجاز' : health.canFetchAnalytics === false ? 'نیازمند مجوز' : 'نامشخص'}</span>
              {health.missingRequired.length > 0 && <span className="text-warning">برخی مجوزهای لازم داده نشده‌اند.</span>}
              {health.needsRefresh && <span className="text-warning">مجوز اتصال به‌زودی نیازمند نوسازی است.</span>}
            </div>
          ) : <span>در حال دریافت وضعیت مجوزها…</span>}
          {isLoading ? (
            <p className="mt-2">در حال دریافت نخستین داده‌های حساب…</p>
          ) : overview ? (
            <p className="mt-2">
              پروفایل آماده است · پست‌های اخیر: {overview.postsStatus === 'available' ? 'بررسی شدند' : 'در دسترس نیستند'} · آمار: {overview.insightsStatus === 'available' ? 'دریافت شد' : 'در دسترس نیست'}
            </p>
          ) : null}
        </div>
      )}

      {account.isActive && account.platformId && (
        <div className="rounded-lg border border-border bg-surface-subtle p-3 text-xs text-ink-secondary" aria-live="polite">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>
              {!syncRun ? 'همگام‌سازی اولیه هنوز شروع نشده است.' :
                syncRun.status === 'COMPLETED' ? `همگام‌سازی اولیه کامل شد · ${count(syncRun.importedMediaCount)} پست بررسی شد` :
                syncRun.status === 'FAILED' ? 'همگام‌سازی اولیه متوقف شد؛ می‌توانید ادامه دهید.' :
                syncRun.currentStep || 'همگام‌سازی اولیه در جریان است…'}
            </span>
            {(!syncRun || syncRun.canResume) && (
              <Button variant="outline" size="sm" disabled={retryingSync} onClick={() => void resumeSync()}>
                {retryingSync ? 'در حال شروع…' : syncRun ? 'ادامه همگام‌سازی' : 'شروع همگام‌سازی'}
              </Button>
            )}
          </div>
          {syncActionError && <p className="mt-2 text-danger">شروع همگام‌سازی ممکن نشد. دوباره تلاش کنید.</p>}
          <p className="mt-2 text-ink-tertiary">تاریخچه پیام‌ها جداگانه در صندوق ورودی بارگذاری می‌شود و ممکن است با تأخیر برسد.</p>
        </div>
      )}

      {account.bio && <p className="text-sm text-ink-secondary whitespace-pre-line">{account.bio}</p>}
      {account.websiteUrl && (
        <a href={account.websiteUrl} target="_blank" rel="noopener noreferrer" className="block text-xs text-accent break-all" dir="ltr">
          {account.websiteUrl}
        </a>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {metrics.map((metric, index) => (
          <div key={metric.label} className="flex min-h-20 flex-col items-center justify-center rounded-lg border border-border p-3 text-center">
            <p className="text-xs leading-5 text-ink-tertiary">{metric.label}</p>
            <p className="mt-1 w-full text-center text-lg font-semibold text-ink-primary num-tabular" dir="ltr">
              {index > 0 && isLoading ? '…' : count(metric.value)}
            </p>
          </div>
        ))}
      </div>

      {overview?.insightsStatus === 'upgrade_required' && (
        <p className="text-xs text-warning">نمایش آمار به افزونه Analytics در Zernio نیاز دارد.</p>
      )}
      {(isError || overview?.insightsStatus === 'unavailable') && (
        <p className="text-xs text-warning">آمار اینستاگرام فعلاً در دسترس نیست.</p>
      )}

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-ink-primary">پست‌های اخیر</h3>
        {isLoading && <p className="text-xs text-ink-tertiary">در حال دریافت پست‌ها...</p>}
        {overview?.postsStatus === 'unavailable' && <p className="text-xs text-warning">دریافت پست‌ها فعلاً ممکن نیست.</p>}
        {overview?.postsStatus === 'available' && overview.recentPosts.length === 0 && (
          <p className="text-xs text-ink-tertiary">پستی برای نمایش یافت نشد.</p>
        )}
        {overview?.recentPosts.slice(0, 4).map((post) => (
          <div key={post.id} className="flex items-start justify-between gap-3 rounded-lg border border-border p-3 text-xs">
            <div className="min-w-0">
              <p className="text-ink-secondary line-clamp-2">{post.caption || post.mediaType || 'پست اینستاگرام'}</p>
              <p className="mt-1 text-ink-tertiary">
                {count(post.likeCount)} پسند · {count(post.commentCount)} نظر
              </p>
            </div>
            {post.permalink && (
              <a href={post.permalink} target="_blank" rel="noopener noreferrer" className="shrink-0 text-accent" aria-label="مشاهده پست در اینستاگرام">
                <ExternalLink className="size-4" />
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export function ZernioInstagramPanel() {
  const { data, isLoading, isError, refetch } = useQuery<{ accounts: InstagramAccount[] }>({
    queryKey: ['zernio-instagram-accounts'],
    queryFn: () => api.get('/api/platforms/zernio/instagram/accounts'),
  })

  return (
    <section className="n-card p-5 space-y-4" aria-label="اتصال اینستاگرام با Zernio">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <PlatformIcon platform="instagram" className="size-10 shrink-0" />
          <div>
            <h2 className="font-semibold text-ink-primary">اتصال رسمی اینستاگرام</h2>
            <p className="text-xs text-ink-tertiary">از طریق صفحه تأیید اینستاگرام و سرویس Zernio</p>
          </div>
        </div>
        <Button size="sm" onClick={() => { window.location.href = '/api/platforms/zernio/instagram/start' }}>
          <PlugZap className="size-4" />
          اتصال حساب حرفه‌ای
        </Button>
      </div>

      {isLoading && <p className="text-sm text-ink-tertiary">در حال بررسی حساب‌های متصل...</p>}
      {isError && (
        <div className="flex items-center gap-3 text-sm text-danger">
          <span>بررسی حساب‌های Zernio ناموفق بود.</span>
          <Button variant="outline" size="sm" onClick={() => void refetch()}>تلاش دوباره</Button>
        </div>
      )}
      {!isLoading && !isError && data?.accounts.length === 0 && (
        <p className="text-sm text-ink-secondary">هنوز هیچ حساب اینستاگرامی از این مسیر به فضای کاری شما متصل نشده است.</p>
      )}
      {data?.accounts.map((account) => <InstagramAccountCard key={account.id} account={account} />)}

      <p className="text-xs text-ink-tertiary">
        اطلاعات پروفایل، پست‌ها و آمار از Zernio خوانده می‌شوند. قابلیت‌های انتشار و پاسخ خودکار به مجوزها و تنظیمات حساب متصل بستگی دارند.
      </p>
    </section>
  )
}
