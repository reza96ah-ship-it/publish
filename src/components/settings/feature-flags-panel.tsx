'use client'

/**
 * Settings → قابلیت‌های بتا: per-workspace feature flag toggles.
 * Backed by GET/PATCH /api/flags (admin-only). Beta features like the
 * comment→DM automation are enabled here — previously the only way was a
 * manual database row, which a re-seed silently wiped.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { FlaskConical } from 'lucide-react'

import { api } from '@/lib/api'
import { announce } from '@/lib/aria-live'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface FlagRow {
  name: string
  label: string
  description: string
  enabled: boolean
}

export function FeatureFlagsPanel() {
  const queryClient = useQueryClient()

  const { data, isLoading, isError } = useQuery<{ flags: FlagRow[] }>({
    queryKey: ['feature-flags'],
    queryFn: () => api.get<{ flags: FlagRow[] }>('/api/flags'),
  })

  const toggleMutation = useMutation({
    mutationFn: ({ flag, enabled }: { flag: string; enabled: boolean }) =>
      api.patch('/api/flags', { flag, enabled }),
    onMutate: async ({ flag, enabled }) => {
      // Optimistic flip so the switch feels instant
      await queryClient.cancelQueries({ queryKey: ['feature-flags'] })
      const prev = queryClient.getQueryData<{ flags: FlagRow[] }>(['feature-flags'])
      queryClient.setQueryData<{ flags: FlagRow[] }>(['feature-flags'], (old) =>
        old
          ? { flags: old.flags.map((f) => (f.name === flag ? { ...f, enabled } : f)) }
          : old
      )
      return { prev }
    },
    onSuccess: (_res, { enabled }) => {
      toast.success(enabled ? 'قابلیت فعال شد' : 'قابلیت غیرفعال شد')
      announce(enabled ? 'قابلیت فعال شد' : 'قابلیت غیرفعال شد')
      queryClient.invalidateQueries({ queryKey: ['feature-flags'] })
      queryClient.invalidateQueries({ queryKey: ['comment-dm-rules'] })
    },
    onError: (err: Error, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['feature-flags'], ctx.prev)
      toast.error(err.message || 'خطا در تغییر وضعیت قابلیت')
    },
  })

  return (
    <div className="n-card p-5 max-w-2xl">
      <div className="flex items-center gap-2 mb-1">
        <FlaskConical className="size-4 text-accent" />
        <h2 className="text-lg font-semibold text-ink-primary">قابلیت‌های بتا</h2>
      </div>
      <p className="text-xs text-ink-tertiary mb-5">
        قابلیت‌های آزمایشی را برای این فضای کار فعال یا غیرفعال کنید. تغییرات فقط توسط مدیر
        قابل انجام است و بلافاصله اعمال می‌شود.
      </p>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <p className="text-sm text-danger py-4">
          خطا در بارگذاری قابلیت‌ها — دسترسی مدیر لازم است
        </p>
      ) : (
        <div className="space-y-3">
          {(data?.flags ?? []).map((f) => (
            <div
              key={f.name}
              className={cn(
                'flex items-center justify-between gap-3 rounded-xl border p-3 transition-colors',
                f.enabled
                  ? 'border-success/30 bg-success-soft/40'
                  : 'border-border bg-surface-subtle'
              )}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className={cn('text-sm font-semibold', f.enabled ? 'text-success' : 'text-ink-tertiary')}>{f.label}</p>
                  <span
                    className={cn(
                      'text-2xs font-bold px-1.5 py-0.5 rounded-full',
                      f.enabled ? 'bg-success text-white' : 'bg-surface-hover text-ink-tertiary'
                    )}
                  >
                    {f.enabled ? 'فعال' : 'غیرفعال'}
                  </span>
                </div>
                <p className="text-xs text-ink-tertiary mt-0.5">{f.description}</p>
              </div>
              <Switch
                checked={f.enabled}
                disabled={toggleMutation.isPending}
                onCheckedChange={(checked) =>
                  toggleMutation.mutate({ flag: f.name, enabled: checked })
                }
                aria-label={f.label}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
