'use client'

import { useQuery } from '@tanstack/react-query'
import { ExternalLink, PlugZap } from 'lucide-react'
import { api } from '@/lib/api'
import { PlatformIcon } from '@/components/dashboard/shared'
import { Button } from '@/components/ui/button'

interface InstagramAccount {
  id: string
  username: string
  displayName: string | null
  profileUrl: string | null
  avatarUrl: string | null
  isActive: boolean
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
      {data?.accounts.map((account) => (
        <div key={account.id} className="rounded-xl border border-border p-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {account.avatarUrl ? (
              <img src={account.avatarUrl} alt="" className="size-10 rounded-full object-cover" />
            ) : <PlatformIcon platform="instagram" className="size-10 shrink-0" />}
            <div className="min-w-0">
              <p className="font-semibold text-ink-primary truncate">{account.displayName || account.username || 'Instagram'}</p>
              <p className="text-xs text-ink-tertiary truncate" dir="ltr">@{account.username || '—'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className={account.isActive ? 'text-success' : 'text-warning'}>
              {account.isActive ? 'تأییدشده در Zernio' : 'نیازمند اتصال مجدد'}
            </span>
            {account.profileUrl && (
              <a href={account.profileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-accent">
                مشاهده پروفایل <ExternalLink className="size-3" />
              </a>
            )}
          </div>
        </div>
      ))}

      <p className="text-xs text-ink-tertiary">
        این اتصال فعلاً برای تأیید حساب و نمایش پروفایل است؛ انتشار پست و پاسخ خودکار با Zernio هنوز به این بخش متصل نشده‌اند.
      </p>
    </section>
  )
}
