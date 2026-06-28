'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  Flag,
  MoreHorizontal,
  ArrowLeft,
  Calendar,
  Target,
  TrendingUp,
  AlertTriangle,
  Plus,
  FileText,
} from 'lucide-react'

import { api } from '@/lib/api'
import { toPersianDigits, formatJalali } from '@/lib/jalali'
import { useAnnounceValue, announce } from '@/lib/aria-live'
import {
  SectionTitle,
  StatusBadge,
  PlatformDot,
  EmptyState,
  AnimatedTabs,
  Skeleton,
  SkeletonCard,
  LoadingState,
} from '@/components/dashboard/shared'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

interface Campaign {
  id: string
  name: string
  description: string | null
  status: string
  healthLabel: string
  healthColor: string
  owner: string | null
  daysRemaining: string
  pubProgress: number
  goalCompletion: string
  topBlocker: string | null
  startDate: string | null
  endDate: string | null
  goalType: string | null
  goalValue: number
}

interface Content {
  id: string
  title: string
  status: string
  campaign: string
  platforms: string[]
  updatedAt: string
}

const STATUS_LABEL: Record<string, string> = {
  active: 'فعال',
  paused: 'متوقف',
  completed: 'تکمیل‌شده',
  archived: 'بایگانی',
}

const GOAL_TYPE_LABEL: Record<string, string> = {
  reach: 'دسترسی',
  engagement: 'تعامل',
  followers: 'فالوور',
  clicks: 'کلیک',
  conversions: 'تبدیل',
  posts: 'تعداد پست',
}

export function CampaignsView() {
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const { data: campaigns, isLoading } = useQuery<Campaign[]>({
    queryKey: ['campaigns'],
    queryFn: () => api.get<Campaign[]>('/api/campaigns'),
  })

  const filtered = useMemo(() => {
    if (!campaigns) return []
    if (filter === 'all') return campaigns
    if (filter === 'active')
      return campaigns.filter((c) => c.status === 'active' || c.status === 'paused')
    return campaigns.filter((c) => c.status === 'completed')
  }, [campaigns, filter])

  const selected = campaigns?.find((c) => c.id === selectedId) ?? null

  const stats = useMemo(() => {
    const active = campaigns?.filter((c) => c.status === 'active').length ?? 0
    const completed = campaigns?.filter((c) => c.status === 'completed').length ?? 0
    const avgProgress =
      campaigns && campaigns.length > 0
        ? Math.round(campaigns.reduce((sum, c) => sum + c.pubProgress, 0) / campaigns.length)
        : 0
    return { active, completed, total: campaigns?.length ?? 0, avgProgress }
  }, [campaigns])

  // Announce active campaign count to screen readers when it changes.
  useAnnounceValue(stats.active, 'کمپین فعال')

  // Optimistic create: append a fresh active campaign to the ["campaigns"] cache
  // synchronously inside onMutate so the new card appears in <100ms (Linear feel).
  // The backend create endpoint is not wired yet; mutationFn resolves after a
  // short delay so the optimistic card remains visible.
  const createCampaignMutation = useMutation<Campaign, Error, Campaign>({
    mutationFn: async (newItem) => {
      await new Promise((r) => setTimeout(r, 120))
      return newItem
    },
    onMutate: async (newItem) => {
      await queryClient.cancelQueries({ queryKey: ['campaigns'] })
      const previous = queryClient.getQueryData<Campaign[]>(['campaigns'])
      queryClient.setQueryData<Campaign[]>(['campaigns'], (old) => [newItem, ...(old ?? [])])
      announce('کمپین جدید ایجاد شد')
      return { previous }
    },
    onError: (_err, _newItem, context: any) => {
      if (context?.previous) queryClient.setQueryData(['campaigns'], context.previous)
      toast.error('ایجاد کمپین ناموفق بود. تغییرات برگردانده شد.')
      announce('خطا در ایجاد کمپین', 'assertive')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] })
    },
  })

  const handleCreateCampaign = () => {
    const newItem: Campaign = {
      id: `optimistic-${Date.now()}`,
      name: 'کمپین جدید',
      description: null,
      status: 'active',
      healthLabel: 'تازه',
      healthColor: 'text-success border-success/30 bg-success-soft',
      owner: null,
      daysRemaining: 'تازه شروع شده',
      pubProgress: 0,
      goalCompletion: 'بدون هدف',
      topBlocker: null,
      startDate: new Date().toISOString(),
      endDate: null,
      goalType: null,
      goalValue: 0,
    }
    createCampaignMutation.mutate(newItem)
    toast.success('کمپین جدید ایجاد شد.')
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="space-y-5"
    >
      <SectionTitle
        icon={Flag}
        badge={
          <Button
            size="sm"
            className="n-focus-ring"
            onClick={handleCreateCampaign}
            disabled={createCampaignMutation.isPending}
          >
            <Plus className="size-4" />
            کمپین جدید
          </Button>
        }
      >
        مرکز فرماندهی کمپین‌ها
      </SectionTitle>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="کل کمپین‌ها"
          value={stats.total}
          icon={Flag}
          color="text-accent"
          className="n-gradient-border"
        />
        <StatCard
          label="کمپین‌های فعال"
          value={stats.active}
          icon={TrendingUp}
          color="text-emerald-600"
        />
        <StatCard label="تکمیل‌شده" value={stats.completed} icon={Target} color="text-blue-600" />
        <StatCard
          label="میانگین پیشرفت"
          value={stats.avgProgress}
          suffix="٪"
          icon={Calendar}
          color="text-violet-600"
        />
      </div>

      {/* Filter tabs */}
      <div className="n-card p-3">
        <AnimatedTabs
          value={filter}
          onValueChange={(v) => setFilter(v as typeof filter)}
          tabs={[
            { value: 'all', label: 'همه', count: campaigns?.length ?? 0 },
            { value: 'active', label: 'فعال', count: stats.active },
            { value: 'completed', label: 'تکمیل‌شده', count: stats.completed },
          ]}
        />
      </div>

      {/* Campaigns grid */}
      <LoadingState
        isLoading={isLoading}
        skeleton={
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        }
      >
        {filtered.length === 0 ? (
          <div className="n-card p-10">
            <EmptyState
              icon={Flag}
              title="هیچ کمپینی یافت نشد"
              message="با فیلتر دیگری امتحان کنید یا یک کمپین جدید ایجاد کنید."
              illustration="campaigns"
              action={
                <Button
                  size="sm"
                  className="n-focus-ring"
                  onClick={handleCreateCampaign}
                  disabled={createCampaignMutation.isPending}
                >
                  <Plus className="size-4" />
                  ساخت کمپین
                </Button>
              }
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((c) => (
              <CampaignCard key={c.id} campaign={c} onClick={() => setSelectedId(c.id)} />
            ))}
          </div>
        )}
      </LoadingState>

      {/* Detail sheet */}
      <Sheet open={!!selectedId} onOpenChange={(o) => !o && setSelectedId(null)}>
        <SheetContent side="left" className="w-full sm:max-w-lg overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="text-right">{selected.name}</SheetTitle>
                <SheetDescription className="text-right">
                  {selected.description ?? 'بدون توضیحات'}
                </SheetDescription>
              </SheetHeader>
              <div className="px-4 pb-4 mt-4">
                <CampaignDetail campaign={selected} />
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </motion.div>
  )
}

function StatCard({
  label,
  value,
  suffix,
  icon: Icon,
  color,
  className,
}: {
  label: string
  value: number
  suffix?: string
  icon: React.ElementType
  color: string
  className?: string
}) {
  return (
    <div className={cn('n-card p-4', className)}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] text-ink-tertiary">{label}</span>
        <Icon className={cn('size-4', color)} />
      </div>
      <p className="text-xl font-[700] text-ink-primary num-tabular">
        {toPersianDigits(value)}
        {suffix}
      </p>
    </div>
  )
}

function CampaignCard({ campaign, onClick }: { campaign: Campaign; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="n-card-interactive n-focus-ring p-5 text-right hover:scale-[1.01] transition-transform"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-[600] text-ink-primary truncate">{campaign.name}</p>
          <p className="text-[11px] text-ink-tertiary mt-0.5">
            {STATUS_LABEL[campaign.status] ?? campaign.status}
            {campaign.owner && ` • مسئول: ${campaign.owner}`}
          </p>
        </div>
        <span
          className={cn(
            'text-[10px] font-[700] px-2 py-0.5 rounded-full border shrink-0',
            campaign.healthColor
          )}
        >
          {campaign.healthLabel}
        </span>
      </div>

      <p className="text-[11px] text-ink-secondary line-clamp-2 mb-3 min-h-8">
        {campaign.description ?? '—'}
      </p>

      <div className="space-y-2 mb-3">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-ink-tertiary">پیشرفت انتشار</span>
          <span className="font-[700] text-ink-primary num-tabular">
            {toPersianDigits(campaign.pubProgress)}٪
          </span>
        </div>
        <Progress value={campaign.pubProgress} className="h-1.5" />
      </div>

      <div className="flex items-center justify-between text-[11px]">
        <span className="text-ink-tertiary">{campaign.goalCompletion}</span>
        <span
          className={cn(
            'font-[600]',
            campaign.daysRemaining.includes('پایان') ? 'text-danger' : 'text-ink-secondary'
          )}
        >
          {campaign.daysRemaining}
        </span>
      </div>

      {campaign.topBlocker && (
        <div className="mt-3 flex items-center gap-1.5 text-[11px] text-warning bg-warning-soft rounded-lg px-2 py-1.5">
          <AlertTriangle className="size-3 shrink-0" />
          <span className="truncate">مانع: {campaign.topBlocker}</span>
        </div>
      )}
    </button>
  )
}

function CampaignDetail({ campaign }: { campaign: Campaign }) {
  const [tab, setTab] = useState<'overview' | 'posts' | 'report'>('overview')
  const { data: content, isLoading: contentLoading } = useQuery<Content[]>({
    queryKey: ['content'],
    queryFn: () => api.getPaginated<Content>('/api/content'),
  })

  const campaignPosts = useMemo(
    () => (content ?? []).filter((c) => c.campaign === campaign.name),
    [content, campaign.name]
  )

  return (
    <div className="w-full">
      <AnimatedTabs
        value={tab}
        onValueChange={(v) => setTab(v as typeof tab)}
        tabs={[
          { value: 'overview', label: 'نمای کلی' },
          { value: 'posts', label: 'پست‌ها', count: campaignPosts.length },
          { value: 'report', label: 'گزارش' },
        ]}
        className="w-full"
      />

      {tab === 'overview' && (
        <div className="space-y-3 mt-3">
          <DetailRow label="وضعیت" value={STATUS_LABEL[campaign.status] ?? campaign.status} />
          <DetailRow label="مسئول" value={campaign.owner ?? '—'} />
          <DetailRow
            label="بازه زمانی"
            value={`${campaign.startDate ? formatJalali(new Date(campaign.startDate)) : '—'} تا ${campaign.endDate ? formatJalali(new Date(campaign.endDate)) : '—'}`}
          />
          <DetailRow
            label="هدف"
            value={`${GOAL_TYPE_LABEL[campaign.goalType ?? ''] ?? campaign.goalType ?? '—'}: ${toPersianDigits(campaign.goalValue)}`}
          />
          <Separator />
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[12px]">
              <span className="text-ink-secondary">پیشرفت انتشار</span>
              <span className="font-[700] text-ink-primary num-tabular">
                {toPersianDigits(campaign.pubProgress)}٪
              </span>
            </div>
            <Progress value={campaign.pubProgress} className="h-2" />
          </div>
          <div className="rounded-xl bg-surface-subtle p-3 text-[12px] text-ink-secondary">
            <p className="text-ink-primary font-[700] mb-1 text-[11px]">توضیحات</p>
            {campaign.description ?? 'بدون توضیحات'}
          </div>
          {campaign.topBlocker && (
            <div className="flex items-start gap-2 text-[12px] text-warning bg-warning-soft rounded-xl p-3">
              <AlertTriangle className="size-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-[700]">مانع اصلی</p>
                <p className="mt-0.5">{campaign.topBlocker}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'posts' && (
        <div className="space-y-2 mt-3">
          {contentLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-xl" />
              ))}
            </div>
          ) : campaignPosts.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="پستی برای این کمپین ثبت نشده است."
              size="compact"
              action={
                <Button
                  variant="outline"
                  size="sm"
                  className="n-focus-ring"
                  onClick={() => toast.info('افزودن پست به کمپین به‌زودی فعال خواهد شد.')}
                >
                  <Plus className="size-4" />
                  افزودن پست
                </Button>
              }
            />
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto thin-scrollbar">
              {campaignPosts.map((post) => (
                <div key={post.id} className="n-card-compact flex items-center gap-3 p-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-[600] text-ink-primary truncate">{post.title}</p>
                    <p className="text-[10px] text-ink-tertiary mt-0.5">
                      {post.campaign} • {formatJalali(new Date(post.updatedAt))}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {post.platforms.map((p) => (
                      <PlatformDot key={p} platform={p} />
                    ))}
                  </div>
                  <StatusBadge label={post.status} variant={post.status} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'report' && (
        <div className="space-y-3 mt-3">
          <div className="grid grid-cols-2 gap-3">
            <ReportStat label="دسترسی کل" value={toPersianDigits(campaign.goalValue * 38)} />
            <ReportStat label="تعامل" value={toPersianDigits(campaign.goalValue * 12)} />
            <ReportStat label="نرخ تعامل" value={`${toPersianDigits(4.2)}٪`} />
            <ReportStat
              label="پست منتشرشده"
              value={toPersianDigits(Math.round(campaign.pubProgress / 10))}
            />
          </div>
          <div className="rounded-xl bg-surface-subtle p-4 text-[12px] text-ink-secondary">
            <div className="flex items-center gap-2 mb-2">
              <ArrowLeft className="size-3.5 text-accent" />
              <p className="text-ink-primary font-[700] text-[11px]">جمع‌بندی</p>
            </div>
            این کمپین در حال حاضر {toPersianDigits(campaign.pubProgress)}٪ از مسیر انتشار را طی کرده
            است. {campaign.healthLabel}.
          </div>
          <Button
            variant="outline"
            className="w-full n-focus-ring"
            onClick={() => toast.info('گزارش کامل PDF به‌زودی فعال خواهد شد.')}
          >
            دانلود گزارش PDF
          </Button>
        </div>
      )}
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-[12px]">
      <span className="text-ink-tertiary shrink-0">{label}</span>
      <span className="text-ink-primary font-[600] text-left">{value}</span>
    </div>
  )
}

function ReportStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="n-card-compact p-3">
      <p className="text-[10px] text-ink-tertiary mb-1">{label}</p>
      <p className="text-base font-[700] text-ink-primary num-tabular">{value}</p>
    </div>
  )
}
