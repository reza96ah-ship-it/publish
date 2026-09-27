'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { ExternalLink, Instagram } from 'lucide-react'
import { api } from '@/lib/api'
import { PlatformIcon } from './shared'

interface InstagramAccount {
  id: string
  username: string
  displayName: string | null
  profileUrl: string | null
  avatarUrl: string | null
  followersCount: number | null
  isActive: boolean
}

interface InstagramOverview {
  insights: {
    reach: number | null
    views: number | null
    accountsEngaged: number | null
    totalInteractions: number | null
  } | null
  insightsStatus: 'available' | 'upgrade_required' | 'unavailable'
  recentPosts: Array<{
    id: string
    caption: string | null
    permalink: string | null
    likeCount: number | null
    commentCount: number | null
  }>
  postsStatus: 'available' | 'unavailable'
}

const numberFormatter = new Intl.NumberFormat('fa-IR')

function formatCount(value: number | null | undefined) {
  return typeof value === 'number' ? numberFormatter.format(value) : '—'
}

function InstagramAccountSummary({ account }: { account: InstagramAccount }) {
  const { data: overview, isLoading, isError } = useQuery<InstagramOverview>({
    queryKey: ['zernio-instagram-overview', account.id],
    queryFn: () => api.get(`/api/platforms/zernio/instagram/accounts/${account.id}/overview`),
    enabled: account.isActive,
    staleTime: 5 * 60 * 1000,
  })

  const metrics = [
    { label: 'دنبال‌کنندگان', value: account.followersCount, available: true },
    { label: 'دسترسی ۳۰ روز', value: overview?.insights?.reach, available: !isLoading },
    { label: 'بازدید ۳۰ روز', value: overview?.insights?.views, available: !isLoading },
    { label: 'تعاملات ۳۰ روز', value: overview?.insights?.totalInteractions, available: !isLoading },
  ]
  const recentPost = overview?.recentPosts[0]

  return (
    <div className="rounded-xl border border-border p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative size-11 shrink-0">
            <PlatformIcon platform="instagram" className="size-11" />
            {account.avatarUrl && (
              <img
                src={account.avatarUrl}
                alt={`تصویر پروفایل ${account.username}`}
                className="absolute inset-0 size-11 rounded-full object-cover"
                onError={(event) => { event.currentTarget.style.display = 'none' }}
              />
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink-primary">{account.displayName || account.username}</p>
            <p className="truncate text-xs text-ink-tertiary" dir="ltr">@{account.username}</p>
          </div>
        </div>
        <span className={`text-xs ${account.isActive ? 'text-success' : 'text-warning'}`}>
          {account.isActive ? 'متصل' : 'نیازمند اتصال مجدد'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {metrics.map((metric) => (
          <div key={metric.label} className="rounded-lg bg-surface px-3 py-2.5">
            <p className="text-xs text-ink-tertiary">{metric.label}</p>
            <p className="mt-1 text-lg font-semibold text-ink-primary num-tabular" dir="ltr">
              {metric.available ? formatCount(metric.value) : '…'}
            </p>
          </div>
        ))}
      </div>

      {!account.isActive && <p className="text-xs text-warning">برای دریافت آمار، حساب را دوباره متصل کنید.</p>}
      {account.isActive && (isError || overview?.insightsStatus === 'unavailable') && (
        <p className="text-xs text-warning">آمار این حساب فعلاً در دسترس نیست.</p>
      )}
      {overview?.insightsStatus === 'upgrade_required' && (
        <p className="text-xs text-warning">نمایش آمار به افزونه Analytics در Zernio نیاز دارد.</p>
      )}

      {recentPost && (
        <div className="flex items-start justify-between gap-3 border-t border-border pt-3 text-xs">
          <div className="min-w-0">
            <p className="text-ink-tertiary">آخرین پست</p>
            <p className="mt-1 line-clamp-1 text-ink-secondary">{recentPost.caption || 'پست اینستاگرام'}</p>
            <p className="mt-1 text-ink-tertiary">
              {formatCount(recentPost.likeCount)} پسند · {formatCount(recentPost.commentCount)} نظر
            </p>
          </div>
          {recentPost.permalink && (
            <a href={recentPost.permalink} target="_blank" rel="noopener noreferrer" className="shrink-0 text-accent" aria-label="مشاهده آخرین پست در اینستاگرام">
              <ExternalLink className="size-4" />
            </a>
          )}
        </div>
      )}
    </div>
  )
}

export function InstagramSummaryPanel() {
  const { data, isLoading, isError, refetch } = useQuery<{ accounts: InstagramAccount[] }>({
    queryKey: ['zernio-instagram-accounts'],
    queryFn: () => api.get('/api/platforms/zernio/instagram/accounts'),
    staleTime: 5 * 60 * 1000,
  })

  return (
    <section className="n-card p-5" aria-label="نمای کلی اینستاگرام">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-accent-soft">
            <Instagram className="size-4 text-accent" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-ink-primary">نمای کلی اینستاگرام</h2>
            <p className="mt-0.5 text-xs text-ink-tertiary">آمار ۳۰ روز گذشته از حساب‌های متصل با Zernio؛ مستقل از فیلترهای داشبورد</p>
          </div>
        </div>
        <Link href="/channels" className="n-focus-ring inline-flex min-h-9 items-center text-xs font-semibold text-accent hover:text-accent-hover">
          مدیریت حساب‌ها ←
        </Link>
      </div>

      {isLoading && <p className="text-sm text-ink-tertiary">در حال دریافت اطلاعات اینستاگرام...</p>}
      {isError && (
        <div className="flex flex-wrap items-center gap-3 text-sm text-danger">
          <span>دریافت اطلاعات اینستاگرام ناموفق بود.</span>
          <button type="button" onClick={() => void refetch()} className="text-accent underline">تلاش دوباره</button>
        </div>
      )}
      {!isLoading && !isError && data?.accounts.length === 0 && (
        <p className="text-sm text-ink-secondary">هنوز حساب حرفه‌ای اینستاگرام متصل نشده است. از بخش کانال‌ها آن را متصل کنید.</p>
      )}
      {data?.accounts && data.accounts.length > 0 && (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {data.accounts.map((account) => <InstagramAccountSummary key={account.id} account={account} />)}
        </div>
      )}
    </section>
  )
}
