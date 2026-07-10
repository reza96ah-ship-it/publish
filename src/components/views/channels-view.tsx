'use client'

import { useMemo, useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { pageTransition, pageTransitionProps } from '@/lib/motion'
import { toast } from 'sonner'
import {
  Link2,
  Plus,
  MoreHorizontal,
  Plug,
  PlugZap,
  Pencil,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  LayoutGrid,
  Activity,
} from 'lucide-react'

import { api } from '@/lib/api'
import { toPersianDigits, relativeTime } from '@/lib/jalali'
import { useAnnounceValue, announce } from '@/lib/aria-live'
import { getCapabilities, isPlatformEnabled } from '@/lib/provider-capabilities'
import {
  SectionTitle,
  PlatformIcon,
  EmptyState,
  SkeletonCard,
  LoadingState,
  AnimatedTabs,
  ProviderSupportBadge,
} from '@/components/dashboard/shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { IgGridDialog } from '@/components/editor/ig-grid-board'
import { cn } from '@/lib/utils'

interface Platform {
  id: string
  name: string
  type: string
  state: string
  stateColor: string
  accounts: number
  primaryIssue: string | null
  lastSuccess: string | null
  accountKind: string
  circuitState: string
  username: string
}

const ALL_PLATFORMS = [
  { id: 'instagram', label: 'اینستاگرام', method: 'oauth' },
  { id: 'telegram', label: 'تلگرام', method: 'bot' },
  { id: 'linkedin', label: 'لینکدین', method: 'oauth' },
  { id: 'rubika', label: 'روبیکا', method: 'bot' },
  { id: 'eitaa', label: 'ایتا', method: 'bot' },
] as const

const AVAILABLE_PLATFORMS = ALL_PLATFORMS.filter((p) => isPlatformEnabled(p.id))


export function ChannelsView() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()

  // Show toast when returning from OAuth provider redirect
  useEffect(() => {
    const success = searchParams.get('oauth_success')
    const error = searchParams.get('oauth_error')
    if (success) {
      toast.success('پلتفرم با موفقیت متصل شد')
      queryClient.invalidateQueries({ queryKey: ['platforms'] })
      // Clean URL without reload
      window.history.replaceState({}, '', '/channels')
    } else if (error) {
      toast.error(`خطا در اتصال OAuth: ${decodeURIComponent(error)}`)
      window.history.replaceState({}, '', '/channels')
    }
  }, [searchParams, queryClient])

  const { data: platforms, isLoading, isError, refetch } = useQuery<Platform[]>({
    queryKey: ['platforms'],
    queryFn: () => api.getPaginated<Platform>('/api/platforms'),
  })

  const [connectOpen, setConnectOpen] = useState(false)
  const [selectedType, setSelectedType] = useState<string>('instagram')
  const [statusFilter, setStatusFilter] = useState<'all' | 'connected' | 'issues'>('all')

  const healthyCount = useMemo(
    () =>
      platforms?.filter((p) => p.state.includes('متصل') || p.state.includes('پایدار')).length ?? 0,
    [platforms]
  )
  // Announce connected-platform count to screen readers when it changes.
  useAnnounceValue(healthyCount, 'پلتفرم متصل')
  const issuesCount = useMemo(
    () =>
      platforms?.filter((p) => {
        const healthy = p.state.includes('متصل') || p.state.includes('پایدار')
        return !healthy || !!p.primaryIssue
      }).length ?? 0,
    [platforms]
  )
  const filteredPlatforms = useMemo(() => {
    if (!platforms) return []
    return platforms.filter((p) => {
      const healthy = p.state.includes('متصل') || p.state.includes('پایدار')
      if (statusFilter === 'connected') return healthy
      if (statusFilter === 'issues') return !healthy || !!p.primaryIssue
      return true
    })
  }, [platforms, statusFilter])

  return (
    <motion.div
      initial={pageTransition.initial}
      animate={pageTransition.animate}
      transition={pageTransitionProps}
      className="space-y-5"
    >
      <SectionTitle
        icon={Link2}
        badge={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/channels/health')}
              title="سلامت کانال‌ها"
            >
              <Activity className="size-4" />
              <span className="hidden sm:inline">سلامت کانال</span>
            </Button>
            <Button size="sm" onClick={() => setConnectOpen(true)}>
              <Plus className="size-4" />
              اتصال پلتفرم جدید
            </Button>
          </div>
        }
      >
        مدیریت پلتفرم‌ها
      </SectionTitle>

      <Breadcrumb>
        <BreadcrumbList className="text-sm">
          <BreadcrumbItem>
            <BreadcrumbLink className="cursor-pointer">تنظیمات</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>پلتفرم‌ها</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <LoadingState
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
        errorLabel="خطا در بارگذاری کانال‌ها"
        skeleton={
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        }
      >
        {!platforms || platforms.length === 0 ? (
          <div className="n-card p-12">
            <EmptyState
              icon={Plug}
              title="پلتفرمی متصل نیست"
              message="با اتصال اولین پلتفرم، انتشار محتوا را آغاز کنید."
              illustration="channels"
              action={
                <Button onClick={() => setConnectOpen(true)}>
                  <Plus className="size-4" />
                  اتصال پلتفرم
                </Button>
              }
            />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Connection status summary card (hero with gradient border) */}
            <div className="n-card n-gradient-border p-5">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-accent-soft flex items-center justify-center">
                    <PlugZap className="size-5 text-accent" />
                  </div>
                  <div>
                    <p className="text-xs text-ink-tertiary">وضعیت اتصال پلتفرم‌ها</p>
                    <p className="text-xl font-bold text-ink-primary num-tabular leading-tight mt-0.5">
                      {toPersianDigits(healthyCount)} از {toPersianDigits(platforms.length)} پلتفرم
                      فعال
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-success" />
                    <span className="text-ink-secondary num-tabular">
                      {toPersianDigits(healthyCount)} متصل
                    </span>
                  </div>
                  {issuesCount > 0 && (
                    <div className="flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-warning" />
                      <span className="text-ink-secondary num-tabular">
                        {toPersianDigits(issuesCount)} نیازمند توجه
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Status filter tabs */}
            <AnimatedTabs
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
              tabs={[
                { value: 'all', label: 'همه' },
                { value: 'connected', label: 'متصل', count: healthyCount },
                { value: 'issues', label: 'نیازمند توجه', count: issuesCount },
              ]}
            />

            {/* Platform grid */}
            {filteredPlatforms.length === 0 ? (
              <div className="n-card p-8">
                <EmptyState
                  icon={Plug}
                  title="پلتفرمی در این فیلتر یافت نشد"
                  message="با تغییر فیلتر، سایر پلتفرم‌ها را مشاهده کنید."
                  size="compact"
                  action={
                    <Button size="sm" variant="outline" onClick={() => setStatusFilter('all')}>
                      نمایش همه
                    </Button>
                  }
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredPlatforms.map((p) => (
                  <PlatformCard key={p.id} platform={p} />
                ))}
              </div>
            )}
          </div>
        )}
      </LoadingState>

      <ConnectDialog
        open={connectOpen}
        onOpenChange={setConnectOpen}
        selectedType={selectedType}
        onSelectType={setSelectedType}
      />
    </motion.div>
  )
}

function PlatformCard({ platform }: { platform: Platform }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [isValidating, setIsValidating] = useState(false)
  const [igGridOpen, setIgGridOpen] = useState(false)
  const healthy = platform.state.includes('متصل') || platform.state.includes('پایدار')

  const handleValidate = async () => {
    setIsValidating(true)
    try {
      const res = await api.post<{ valid: boolean; botInfo?: { username: string } }>(
        `/api/platforms/${platform.id}/validate`,
        {}
      )
      if (res.valid) {
        toast.success('اتصال تأیید شد ✓', {
          description: res.botInfo ? `ربات: @${res.botInfo.username}` : undefined,
        })
      } else {
        toast.error('اتصال نامعتبر است')
      }
      queryClient.invalidateQueries({ queryKey: ['platforms'] })
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'خطا در تست اتصال')
    } finally {
      setIsValidating(false)
    }
  }

  return (
    <div className={cn('n-card p-5 flex flex-col', !healthy && 'opacity-60')}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <PlatformIcon platform={platform.type} className="size-11 shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-base font-semibold text-ink-primary truncate">{platform.name}</p>
              <ProviderSupportBadge level={getCapabilities(platform.type).supportLevel} />
            </div>
            <p className="text-xs text-ink-tertiary truncate">@{platform.username || '—'}</p>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8 min-h-[44px] min-w-[44px] shrink-0">
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => router.push('/settings')}>
              <Pencil className="size-3.5" />
              ویرایش
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleValidate}>
              <PlugZap className="size-3.5" />
              تست اتصال
            </DropdownMenuItem>
            {platform.type === 'instagram' && (
              <DropdownMenuItem onClick={() => setIgGridOpen(true)}>
                <LayoutGrid className="size-3.5" />
                گرید اینستاگرام
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DisconnectItem platformName={platform.name} />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <span
          className={cn(
            'text-2xs font-bold px-2 py-0.5 rounded-full border inline-flex items-center gap-1',
            platform.stateColor
          )}
        >
          {healthy ? <CheckCircle2 className="size-3" /> : <AlertTriangle className="size-3" />}
          {platform.state}
        </span>
        <span className="text-2xs text-ink-tertiary ms-auto num-tabular">
          {toPersianDigits(platform.accounts)} حساب
        </span>
      </div>

      <div className="space-y-2 text-xs mt-auto">
        <div className="flex items-center justify-between">
          <span className="text-ink-tertiary">آخرین موفقیت</span>
          <span className="text-ink-secondary">
            {platform.lastSuccess ? relativeTime(new Date(platform.lastSuccess)) : '—'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-ink-tertiary">نوع حساب</span>
          <span className="text-ink-secondary">
            {platform.accountKind === 'professional'
              ? 'حرفه‌ای'
              : platform.accountKind === 'personal'
                ? 'شخصی'
                : platform.accountKind}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-ink-tertiary">وضعیت مدار</span>
          <span
            className={cn(
              'font-semibold',
              platform.circuitState === 'closed'
                ? 'text-success'
                : platform.circuitState === 'half_open'
                  ? 'text-warning'
                  : 'text-danger'
            )}
          >
            {platform.circuitState === 'closed'
              ? 'بسته (سالم)'
              : platform.circuitState === 'half_open'
                ? 'نیمه‌باز'
                : 'باز (قطع)'}
          </span>
        </div>
      </div>

      {platform.primaryIssue && (
        <div className="mt-3 flex items-start gap-1.5 text-xs text-warning bg-warning-soft rounded-lg px-2 py-1.5">
          <AlertTriangle className="size-3 shrink-0 mt-0.5" />
          <span className="truncate">{platform.primaryIssue}</span>
        </div>
      )}

      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
        {healthy ? (
          <Button
            variant="outline"
            size="sm"
            className="flex-1 min-h-[44px]"
            onClick={handleValidate}
            disabled={isValidating}
          >
            <PlugZap className="size-3.5" />
            {isValidating ? 'در حال تست...' : 'تست اتصال'}
          </Button>
        ) : (
          <Button
            variant="default"
            size="sm"
            className="flex-1 min-h-[44px] bg-accent text-white hover:bg-accent-hover"
            onClick={handleValidate}
            disabled={isValidating}
          >
            <PlugZap className="size-3.5" />
            {isValidating ? 'در حال اتصال...' : 'اتصال مجدد'}
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="flex-1 min-h-[44px]"
          onClick={() => router.push('/settings')}
        >
          <Pencil className="size-3.5" />
          ویرایش
        </Button>
      </div>

      {platform.type === 'instagram' && (
        <IgGridDialog
          open={igGridOpen}
          onOpenChange={setIgGridOpen}
          platforms={[{ id: platform.id, name: platform.name }]}
        />
      )}
    </div>
  )
}

function DisconnectItem({ platformName }: { platformName: string }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button className="n-focus-ring relative flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-3 text-sm text-danger outline-none transition-colors hover:bg-danger-soft focus:bg-danger-soft w-full">
          <Trash2 className="size-3.5" />
          قطع اتصال
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-start">قطع اتصال پلتفرم</AlertDialogTitle>
          <AlertDialogDescription className="text-start">
            آیا از قطع اتصال «{platformName}» مطمئن هستید؟ پس از قطع، انتشار به این پلتفرم متوقف
            می‌شود. این عملیات قابل بازگشت نیست.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>انصراف</AlertDialogCancel>
          <AlertDialogAction
            className="bg-danger hover:bg-danger"
            onClick={() => {
              toast.info('قطع اتصال به‌زودی فعال خواهد شد')
              announce('قطع اتصال به‌زودی فعال خواهد شد')
            }}
          >
            قطع اتصال
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function ConnectDialog({
  open,
  onOpenChange,
  selectedType,
  onSelectType,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  selectedType: string
  onSelectType: (t: string) => void
}) {
  const queryClient = useQueryClient()
  const platformDef = AVAILABLE_PLATFORMS.find((p) => p.id === selectedType)
  const isOAuth = platformDef?.method === 'oauth'
  const [botToken, setBotToken] = useState('')
  const [chatId, setChatId] = useState('')
  const [connecting, setConnecting] = useState(false)

  const handleConnect = async () => {
    if (!botToken) {
      toast.error('توکن را وارد کنید')
      return
    }
    setConnecting(true)
    try {
      // Find existing platform of this type or create new
      const platforms = await api.getPaginated<Platform>('/api/platforms')
      const existing = platforms.find((p) => p.type === selectedType)

      if (existing) {
        // Update existing platform with token
        const res = await api.post<{ ok: boolean; botInfo?: { username: string } }>(
          `/api/platforms/${existing.id}/connect`,
          {
            token: botToken,
            targetId: chatId || undefined,
          }
        )
        if (res.ok) {
          toast.success('پلتفرم متصل شد ✓', {
            description: res.botInfo ? `ربات: @${res.botInfo.username}` : undefined,
          })
        }
      } else {
        toast.info('ابتدا پلتفرم را در تنظیمات اضافه کنید')
      }

      queryClient.invalidateQueries({ queryKey: ['platforms'] })
      setBotToken('')
      setChatId('')
      onOpenChange(false)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'خطا در اتصال'
      toast.error(msg)
    } finally {
      setConnecting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-start">اتصال پلتفرم</DialogTitle>
          <DialogDescription className="text-start">
            توکن ربات را وارد کنید — اتصال به‌صورت خودکار بررسی می‌شود.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-sm text-ink-secondary mb-2 block">پلتفرم</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {AVAILABLE_PLATFORMS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => onSelectType(p.id)}
                  className={cn(
                    'n-focus-ring flex flex-col items-center gap-1.5 rounded-xl border p-3 transition-all',
                    selectedType === p.id
                      ? 'border-accent/30 bg-accent-soft'
                      : 'border-border bg-surface-subtle hover:bg-surface-hover'
                  )}
                >
                  <PlatformIcon platform={p.id} className="size-7" />
                  <span className="text-xs font-bold text-ink-primary">{p.label}</span>
                  <ProviderSupportBadge level={getCapabilities(p.id).supportLevel} />
                </button>
              ))}
            </div>
          </div>

          {isOAuth ? (
            <div className="space-y-3">
              <div className="n-card-compact p-4 text-center">
                <PlugZap className="size-8 text-accent mx-auto mb-2" />
                <p className="text-sm font-semibold text-ink-primary">اتصال با OAuth</p>
                <p className="text-xs text-ink-tertiary mt-1">
                  با کلیک روی دکمه به صفحه تأیید{' '}
                  {selectedType === 'instagram' ? 'اینستاگرام' : 'لینکدین'} هدایت می‌شوید.
                </p>
              </div>
              <Button
                className="w-full"
                onClick={() => {
                  window.location.href = `/api/platforms/oauth/start?type=${selectedType}`
                }}
              >
                <PlugZap className="size-4" />
                اتصال با OAuth
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <Label className="text-sm text-ink-secondary mb-1.5 block">
                  توکن ربات (Bot Token)
                </Label>
                <Input
                  dir="ltr"
                  placeholder="123456:ABC-DEF..."
                  value={botToken}
                  onChange={(e) => setBotToken(e.target.value)}
                />
                <p className="text-2xs text-ink-tertiary mt-1">
                  {selectedType === 'telegram' && 'از @BotFather در تلگرام دریافت کنید'}
                  {selectedType === 'bale' && 'از @botfather در بله دریافت کنید'}
                  {selectedType === 'rubika' && 'از @BotFather در روبیکا دریافت کنید'}
                  {selectedType === 'eitaa' && 'از پنل ایتا دریافت کنید'}
                </p>
              </div>
              <div>
                <Label className="text-sm text-ink-secondary mb-1.5 block">
                  شناسه چت / کانال (اختیاری)
                </Label>
                <Input
                  dir="ltr"
                  placeholder="@channel_username یا -1001234567890"
                  value={chatId}
                  onChange={(e) => setChatId(e.target.value)}
                />
                <p className="text-2xs text-ink-tertiary mt-1">
                  ربات را به‌عنوان ادمین به کانال اضافه کنید، سپس شناسه کانال را وارد کنید.
                </p>
              </div>
              <Button className="w-full" onClick={handleConnect} disabled={connecting || !botToken}>
                <Plug className="size-4" />
                {connecting ? 'در حال اتصال...' : 'اتصال و بررسی'}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
