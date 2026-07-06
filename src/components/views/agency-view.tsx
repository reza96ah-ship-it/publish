'use client'

/**
 * Issue #254: Agency multi-client overview — admin view (`/agency`).
 *
 * Client component following the smart-pages-view + listening-view pattern:
 *  - useQuery for profile / overview / clients / templates / portal-access
 *  - useMutation for setup/update profile, create/delete templates, create
 *    client from template, create/revoke portal access (with optimistic
 *    updates + rollback where it makes sense)
 *  - LoadingState + EmptyState + SkeletonCard for loading / empty / error
 *  - "ایجاد فضای کار جدید از قالب" Dialog with template selector + client name
 *  - White-label settings card (brand name, logo URL, hide Nashrino branding)
 *  - Client portal access management (create/revoke, copy URL)
 *  - pageTransition + pageTransitionProps for view enter animation
 *  - toast + announce() for accessibility
 *  - toPersianDigits for all numeric display
 */

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { pageTransition, pageTransitionProps } from '@/lib/motion'
import { toast } from 'sonner'
import {
  Building2,
  Plus,
  Trash2,
  Copy,
  ShieldOff,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Users,
  Save,
  Settings2,
} from 'lucide-react'

import { api } from '@/lib/api'
import { toPersianDigits, formatJalali, relativeTime } from '@/lib/jalali'
import { announce } from '@/lib/aria-live'
import {
  SectionTitle,
  EmptyState,
  LoadingState,
  SkeletonCard,
  StatusBadge,
} from '@/components/dashboard/shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type {
  AgencyOverview,
  AgencyProfileItem,
  ClientPortalAccessItem,
  ClientWorkspaceSummary,
  WorkspaceTemplateItem,
} from '@/modules/agency'

// ── Display metadata ─────────────────────────────────────────────────────────

const PLAN_LABELS: Record<string, string> = {
  free: 'رایگان',
  pro: 'حرفه‌ای',
  business: 'تجاری',
  enterprise: 'سازمانی',
}

const STATUS_LABELS: Record<ClientWorkspaceSummary['status'], string> = {
  active: 'فعال',
  expired: 'منقضی',
  error: 'خطا',
  disconnected: 'قطع‌شده',
  unknown: 'نامشخص',
}

const STATUS_VARIANT: Record<ClientWorkspaceSummary['status'], string> = {
  active: 'published',
  expired: 'high',
  error: 'high',
  disconnected: 'medium',
  unknown: 'draft',
}

const PERMISSION_LABELS: Record<string, string> = {
  'content:view': 'مشاهده محتوا',
  'content:approve': 'تأیید محتوا',
  'content:comment': 'ثبت کامنت',
}

const ALL_PERMISSIONS = ['content:view', 'content:approve', 'content:comment']

// Build the public client-portal URL for a token (relative to current origin).
function portalUrl(token: string): string {
  if (typeof window === 'undefined') return `/api/agency/portal/${token}`
  return `${window.location.origin}/api/agency/portal/${token}`
}

// ── View ─────────────────────────────────────────────────────────────────────

export function AgencyView() {
  const queryClient = useQueryClient()
  const [showCreateClient, setShowCreateClient] = useState(false)
  const [showCreateTemplate, setShowCreateTemplate] = useState(false)
  const [showCreatePortal, setShowCreatePortal] = useState(false)

  // ── Queries ────────────────────────────────────────────────────────────────

  const profileQ = useQuery<AgencyProfileItem | null>({
    queryKey: ['agency-profile'],
    queryFn: () => api.get<AgencyProfileItem | null>('/api/agency'),
  })

  const overviewQ = useQuery<AgencyOverview>({
    queryKey: ['agency-overview'],
    queryFn: () => api.get<AgencyOverview>('/api/agency/overview'),
    enabled: !!profileQ.data,
  })

  const clientsQ = useQuery<ClientWorkspaceSummary[]>({
    queryKey: ['agency-clients'],
    queryFn: () => api.get<ClientWorkspaceSummary[]>('/api/agency/clients'),
    enabled: !!profileQ.data,
  })

  const templatesQ = useQuery<WorkspaceTemplateItem[]>({
    queryKey: ['agency-templates'],
    queryFn: () => api.get<WorkspaceTemplateItem[]>('/api/agency/templates'),
  })

  const portalQ = useQuery<ClientPortalAccessItem[]>({
    queryKey: ['agency-portal-access'],
    queryFn: () => api.get<ClientPortalAccessItem[]>('/api/agency/portal-access'),
    enabled: !!profileQ.data,
  })

  const profile = profileQ.data ?? null
  const isSetup = !!profile

  // ── Mutations ──────────────────────────────────────────────────────────────

  const setupMutation = useMutation<AgencyProfileItem, Error, void>({
    mutationFn: () => api.post<AgencyProfileItem>('/api/agency'),
    onSuccess: () => {
      toast.success('پروفایل آژانس فعال شد.')
      announce('پروفایل آژانس فعال شد')
    },
    onError: (err) => {
      toast.error(err.message || 'فعال‌سازی پروفایل آژانس ناموفق بود.')
      announce('خطا در فعال‌سازی آژانس', 'assertive')
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['agency-profile'] }),
  })

  const updateProfileMutation = useMutation<
    AgencyProfileItem,
    Error,
    Partial<AgencyProfileItem>
  >({
    mutationFn: (patch) => api.patch<AgencyProfileItem>('/api/agency', patch),
    onSuccess: () => {
      toast.success('تنظیمات برند سفید ذخیره شد.')
      announce('تنظیمات برند سفید ذخیره شد')
    },
    onError: (err) => {
      toast.error(err.message || 'ذخیره تنظیمات ناموفق بود.')
      announce('خطا در ذخیره تنظیمات', 'assertive')
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['agency-profile'] }),
  })

  const createTemplateMutation = useMutation<
    WorkspaceTemplateItem,
    Error,
    { name: string; description?: string; template: Record<string, unknown> }
  >({
    mutationFn: (input) => api.post<WorkspaceTemplateItem>('/api/agency/templates', input),
    onSuccess: () => {
      toast.success('قالب جدید ایجاد شد.')
      announce('قالب جدید ایجاد شد')
      setShowCreateTemplate(false)
    },
    onError: (err) => {
      toast.error(err.message || 'ایجاد قالب ناموفق بود.')
      announce('خطا در ایجاد قالب', 'assertive')
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['agency-templates'] }),
  })

  const deleteTemplateMutation = useMutation<void, Error, WorkspaceTemplateItem>({
    mutationFn: (item) => api.delete<void>(`/api/agency/templates/${item.id}`),
    onMutate: async (item) => {
      await queryClient.cancelQueries({ queryKey: ['agency-templates'] })
      const previous = queryClient.getQueryData<WorkspaceTemplateItem[]>(['agency-templates'])
      queryClient.setQueryData<WorkspaceTemplateItem[]>(['agency-templates'], (old) =>
        (old ?? []).filter((t) => t.id !== item.id)
      )
      return { previous }
    },
    onError: (err, _item, context: unknown) => {
      const ctx = context as { previous?: WorkspaceTemplateItem[] } | undefined
      if (ctx?.previous) queryClient.setQueryData(['agency-templates'], ctx.previous)
      toast.error(err.message || 'حذف قالب ناموفق بود.')
      announce('خطا در حذف قالب', 'assertive')
    },
    onSuccess: () => {
      toast.success('قالب حذف شد.')
      announce('قالب حذف شد')
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['agency-templates'] }),
  })

  const createClientMutation = useMutation<
    { workspaceId: string },
    Error,
    { templateId: string; clientName: string }
  >({
    mutationFn: (input) =>
      api.post<{ workspaceId: string }>('/api/agency/templates', {
        templateId: input.templateId,
        clientName: input.clientName,
      }),
    onSuccess: (_data, vars) => {
      toast.success(`فضای کار «${vars.clientName}» از روی قالب ایجاد شد.`)
      announce(`فضای کار جدید برای ${vars.clientName} ایجاد شد`)
      setShowCreateClient(false)
    },
    onError: (err) => {
      toast.error(err.message || 'ایجاد فضای کار ناموفق بود.')
      announce('خطا در ایجاد فضای کار', 'assertive')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['agency-clients'] })
      queryClient.invalidateQueries({ queryKey: ['agency-overview'] })
      queryClient.invalidateQueries({ queryKey: ['agency-profile'] })
    },
  })

  const createPortalMutation = useMutation<
    ClientPortalAccessItem,
    Error,
    { workspaceId: string; permissions: string[] }
  >({
    mutationFn: (input) =>
      api.post<ClientPortalAccessItem>('/api/agency/portal-access', {
        workspaceId: input.workspaceId,
        permissions: input.permissions,
      }),
    onSuccess: () => {
      toast.success('دسترسی پورتال مشتری ایجاد شد.')
      announce('دسترسی پورتال مشتری ایجاد شد')
      setShowCreatePortal(false)
    },
    onError: (err) => {
      toast.error(err.message || 'ایجاد دسترسی پورتال ناموفق بود.')
      announce('خطا در ایجاد دسترسی پورتال', 'assertive')
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['agency-portal-access'] }),
  })

  const revokePortalMutation = useMutation<void, Error, ClientPortalAccessItem>({
    mutationFn: (item) => api.delete<void>(`/api/agency/portal-access/${item.id}`),
    onMutate: async (item) => {
      await queryClient.cancelQueries({ queryKey: ['agency-portal-access'] })
      const previous = queryClient.getQueryData<ClientPortalAccessItem[]>(['agency-portal-access'])
      queryClient.setQueryData<ClientPortalAccessItem[]>(['agency-portal-access'], (old) =>
        (old ?? []).filter((p) => p.id !== item.id)
      )
      return { previous }
    },
    onError: (err, _item, context: unknown) => {
      const ctx = context as { previous?: ClientPortalAccessItem[] } | undefined
      if (ctx?.previous) queryClient.setQueryData(['agency-portal-access'], ctx.previous)
      toast.error(err.message || 'ابطال دسترسی ناموفق بود.')
      announce('خطا در ابطال دسترسی', 'assertive')
    },
    onSuccess: () => {
      toast.success('دسترسی پورتال ابطال شد.')
      announce('دسترسی پورتال ابطال شد')
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['agency-portal-access'] }),
  })

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleCopyUrl = async (token: string) => {
    try {
      await navigator.clipboard.writeText(portalUrl(token))
      toast.success('لینک پورتال مشتری کپی شد.')
      announce('لینک پورتال کپی شد')
    } catch {
      toast.error('کپی لینک ناموفق بود.')
    }
  }

  // ── Not-yet-setup state ─────────────────────────────────────────────────────

  if (!profileQ.isLoading && !isSetup) {
    return (
      <motion.div
        initial={pageTransition.initial}
        animate={pageTransition.animate}
        transition={pageTransitionProps}
        className="space-y-5"
      >
        <SectionTitle icon={Building2}>آژانس</SectionTitle>
        <div className="n-card p-10">
          <EmptyState
            icon={Building2}
            title="این فضای کار هنوز به‌عنوان آژانس فعال نشده است"
            message="با فعال‌سازی پروفایل آژانس می‌توانید چندین فضای کار مشتری را مدیریت کنید، قالب آماده بسازید و دسترسی پورتال برای مشتریان صادر کنید."
            action={
              <Button
                size="sm"
                className="n-focus-ring"
                onClick={() => setupMutation.mutate()}
                disabled={setupMutation.isPending}
              >
                <Sparkles className="size-4" />
                فعال‌سازی پروفایل آژانس
              </Button>
            }
          />
        </div>
      </motion.div>
    )
  }

  const overview = overviewQ.data

  return (
    <motion.div
      initial={pageTransition.initial}
      animate={pageTransition.animate}
      transition={pageTransitionProps}
      className="space-y-5"
    >
      <SectionTitle icon={Building2}>آژانس</SectionTitle>

      {/* Overview stat cards */}
      <LoadingState
        isLoading={overviewQ.isLoading}
        isError={overviewQ.isError}
        onRetry={() => overviewQ.refetch()}
        errorLabel="خطا در بارگذاری نمای کلی"
        skeleton={
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        }
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            label="کل مشتریان"
            value={overview?.totalClients ?? 0}
            icon={Users}
            color="text-accent"
          />
          <StatCard
            label="در انتظار تأیید"
            value={overview?.pendingApprovals ?? 0}
            icon={Clock}
            color="text-warning"
          />
          <StatCard
            label="مشتریان پرخطر"
            value={overview?.atRiskClients ?? 0}
            icon={AlertTriangle}
            color="text-danger"
          />
          <StatCard
            label="تمدیدهای پیش‌رو"
            value={overview?.upcomingRenewals ?? 0}
            icon={CheckCircle2}
            color="text-success"
          />
        </div>
      </LoadingState>

      {/* Client workspaces list */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-ink-primary tracking-tight">
            فضاهای کار مشتریان
          </h2>
          <Button
            size="sm"
            variant="outline"
            className="n-focus-ring"
            onClick={() => setShowCreateClient(true)}
            disabled={!isSetup || (templatesQ.data?.length ?? 0) === 0}
          >
            <Plus className="size-4" />
            ایجاد فضای کار جدید از قالب
          </Button>
        </div>
        <LoadingState
          isLoading={clientsQ.isLoading}
          isError={clientsQ.isError}
          onRetry={() => clientsQ.refetch()}
          errorLabel="خطا در بارگذاری مشتریان"
          skeleton={
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          }
        >
          {!clientsQ.data || clientsQ.data.length === 0 ? (
            <div className="n-card p-8">
              <EmptyState
                icon={Users}
                title="هنوز فضای کار مشتری اضافه نشده است"
                message="با ایجاد فضای کار از روی قالب، مشتریان جدید را به آژانس خود اضافه کنید."
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto pe-1">
              {clientsQ.data.map((c) => (
                <ClientCard key={c.id} client={c} />
              ))}
            </div>
          )}
        </LoadingState>
      </section>

      {/* Workspace templates */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-ink-primary tracking-tight">قالب‌های فضای کار</h2>
          <Button
            size="sm"
            variant="outline"
            className="n-focus-ring"
            onClick={() => setShowCreateTemplate(true)}
          >
            <Plus className="size-4" />
            قالب جدید
          </Button>
        </div>
        <LoadingState
          isLoading={templatesQ.isLoading}
          isError={templatesQ.isError}
          onRetry={() => templatesQ.refetch()}
          errorLabel="خطا در بارگذاری قالب‌ها"
          skeleton={
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Array.from({ length: 2 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          }
        >
          {!templatesQ.data || templatesQ.data.length === 0 ? (
            <div className="n-card p-8">
              <EmptyState
                icon={Sparkles}
                title="قالبی ساخته نشده است"
                message="قالب‌ها به شما اجازه می‌دهند فضای کار مشتریان را با تنظیمات پیش‌فرض (رنگ برند، پلن، نوع کانال) سریع بسازید."
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {templatesQ.data.map((t) => (
                <TemplateCard
                  key={t.id}
                  template={t}
                  onDelete={() => deleteTemplateMutation.mutate(t)}
                  deleting={
                    deleteTemplateMutation.isPending &&
                    deleteTemplateMutation.variables?.id === t.id
                  }
                />
              ))}
            </div>
          )}
        </LoadingState>
      </section>

      {/* White-label settings */}
      <WhiteLabelCard
        profile={profile}
        saving={updateProfileMutation.isPending}
        onSave={(patch) => updateProfileMutation.mutate(patch)}
      />

      {/* Portal access management */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-ink-primary tracking-tight">
            دسترسی پورتال مشتری
          </h2>
          <Button
            size="sm"
            variant="outline"
            className="n-focus-ring"
            onClick={() => setShowCreatePortal(true)}
            disabled={!isSetup || (clientsQ.data?.length ?? 0) === 0}
          >
            <Plus className="size-4" />
            صدور توکن جدید
          </Button>
        </div>
        <LoadingState
          isLoading={portalQ.isLoading}
          isError={portalQ.isError}
          onRetry={() => portalQ.refetch()}
          errorLabel="خطا در بارگذاری توکن‌ها"
          skeleton={<SkeletonCard />}
        >
          {!portalQ.data || portalQ.data.length === 0 ? (
            <div className="n-card p-8">
              <EmptyState
                icon={ShieldOff}
                title="هیچ توکن پورتالی صادر نشده است"
                message="با صدور توکن، مشتریان می‌توانند بدون ورود به سیستم، محتوای خود را مشاهده و تأیید کنند."
              />
            </div>
          ) : (
            <div className="n-card p-0 overflow-hidden">
              <div className="divide-y divide-border/60 max-h-96 overflow-y-auto">
                {portalQ.data.map((p) => {
                  const client = clientsQ.data?.find((c) => c.id === p.workspaceId)
                  return (
                    <PortalAccessRow
                      key={p.id}
                      access={p}
                      clientName={client?.name ?? 'فضای کار نامشخص'}
                      onCopy={() => handleCopyUrl(p.accessToken)}
                      onRevoke={() => revokePortalMutation.mutate(p)}
                      revoking={
                        revokePortalMutation.isPending &&
                        revokePortalMutation.variables?.id === p.id
                      }
                    />
                  )
                })}
              </div>
            </div>
          )}
        </LoadingState>
      </section>

      {/* Create client from template dialog */}
      <CreateClientDialog
        open={showCreateClient}
        onOpenChange={setShowCreateClient}
        templates={templatesQ.data ?? []}
        submitting={createClientMutation.isPending}
        onSubmit={(templateId, clientName) =>
          createClientMutation.mutate({ templateId, clientName })
        }
      />

      {/* Create template dialog */}
      <CreateTemplateDialog
        open={showCreateTemplate}
        onOpenChange={setShowCreateTemplate}
        submitting={createTemplateMutation.isPending}
        onSubmit={(name, description, template) =>
          createTemplateMutation.mutate({ name, description, template })
        }
      />

      {/* Create portal access dialog */}
      <CreatePortalAccessDialog
        open={showCreatePortal}
        onOpenChange={setShowCreatePortal}
        clients={clientsQ.data ?? []}
        submitting={createPortalMutation.isPending}
        onSubmit={(workspaceId, permissions) =>
          createPortalMutation.mutate({ workspaceId, permissions })
        }
      />
    </motion.div>
  )
}

// ── Subcomponents ────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string
  value: number
  icon: typeof Users
  color: string
}) {
  return (
    <div className="n-card p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-ink-tertiary">{label}</span>
        <Icon className={cn('size-4', color)} />
      </div>
      <p className="text-xl font-bold text-ink-primary num-tabular">
        {toPersianDigits(value)}
      </p>
    </div>
  )
}

function ClientCard({ client }: { client: ClientWorkspaceSummary }) {
  return (
    <div className="n-card p-4">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-ink-primary truncate">{client.name}</p>
          <p className="text-2xs text-ink-tertiary mt-0.5 truncate">
            {client.category || 'مشتری آژانس'} · {PLAN_LABELS[client.plan] ?? client.plan}
          </p>
        </div>
        <StatusBadge
          label={STATUS_LABELS[client.status]}
          variant={STATUS_VARIANT[client.status]}
        />
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-surface-hover/50 py-2">
          <p className="text-base font-bold text-ink-primary num-tabular">
            {toPersianDigits(client.pendingApprovals)}
          </p>
          <p className="text-2xs text-ink-tertiary mt-0.5">در انتظار تأیید</p>
        </div>
        <div className="rounded-lg bg-surface-hover/50 py-2">
          <p className="text-base font-bold text-ink-primary num-tabular">
            {toPersianDigits(client.usageStats.postsThisMonth)}
          </p>
          <p className="text-2xs text-ink-tertiary mt-0.5">پست این ماه</p>
        </div>
        <div className="rounded-lg bg-surface-hover/50 py-2">
          <p className="text-base font-bold text-ink-primary num-tabular">
            {toPersianDigits(client.usageStats.scheduledUpcoming)}
          </p>
          <p className="text-2xs text-ink-tertiary mt-0.5">زمان‌بندی آتی</p>
        </div>
      </div>
    </div>
  )
}

function TemplateCard({
  template,
  onDelete,
  deleting,
}: {
  template: WorkspaceTemplateItem
  onDelete: () => void
  deleting: boolean
}) {
  const configKeys = Object.keys(template.template ?? {}).filter((k) => k !== undefined)
  return (
    <div className="n-card p-4">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-ink-primary truncate">{template.name}</p>
          {template.description && (
            <p className="text-2xs text-ink-tertiary mt-0.5 line-clamp-2">
              {template.description}
            </p>
          )}
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="text-danger hover:text-danger hover:bg-danger-soft h-7 px-2"
          onClick={onDelete}
          disabled={deleting}
          aria-label="حذف قالب"
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
      {configKeys.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {configKeys.slice(0, 5).map((k) => (
            <span
              key={k}
              className="inline-flex items-center text-2xs font-medium px-1.5 py-0.5 rounded-md bg-surface-hover text-ink-secondary border border-border"
            >
              {k}
            </span>
          ))}
          {configKeys.length > 5 && (
            <span className="text-2xs text-ink-tertiary">
              +{toPersianDigits(configKeys.length - 5)}
            </span>
          )}
        </div>
      )}
      <p className="text-2xs text-ink-tertiary mt-2">
        {formatJalali(new Date(template.createdAt))}
      </p>
    </div>
  )
}

function WhiteLabelCard({
  profile,
  saving,
  onSave,
}: {
  profile: AgencyProfileItem | null
  saving: boolean
  onSave: (patch: Partial<AgencyProfileItem>) => void
}) {
  const [brandName, setBrandName] = useState('')
  const [brandLogoUrl, setBrandLogoUrl] = useState('')
  const [hideBranding, setHideBranding] = useState(false)

  // Sync local state when profile loads.
  const [syncedId, setSyncedId] = useState<string | null>(null)
  if (profile && profile.id !== syncedId) {
    setSyncedId(profile.id)
    setBrandName(profile.brandName ?? '')
    setBrandLogoUrl(profile.brandLogoUrl ?? '')
    setHideBranding(profile.hideNashrinoBranding)
  }

  const handleSave = () => {
    onSave({
      brandName: brandName.trim() || null,
      brandLogoUrl: brandLogoUrl.trim() || null,
      hideNashrinoBranding: hideBranding,
    })
  }

  return (
    <section className="n-card p-5">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="flex size-7 items-center justify-center rounded-md bg-accent-soft">
          <Settings2 className="size-[14px] text-accent" strokeWidth={2} />
        </div>
        <h2 className="text-sm font-bold text-ink-primary tracking-tight">
          تنظیمات برند سفید (White-label)
        </h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="agency-brand-name">نام برند</Label>
          <Input
            id="agency-brand-name"
            value={brandName}
            onChange={(e) => setBrandName(e.target.value)}
            placeholder="مثلاً آژانس محتوای پارس"
            maxLength={100}
          />
          <p className="text-2xs text-ink-tertiary">
            جایگزین «نشرینو» در گزارش‌های سفارشی می‌شود.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="agency-brand-logo">آدرس لوگوی برند</Label>
          <Input
            id="agency-brand-logo"
            value={brandLogoUrl}
            onChange={(e) => setBrandLogoUrl(e.target.value)}
            placeholder="https://..."
            dir="ltr"
            maxLength={500}
          />
          <p className="text-2xs text-ink-tertiary">
            لوگوی شما در هدر گزارش‌ها و پورتال مشتری نمایش داده می‌شود.
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/60">
        <div className="flex items-center gap-2.5">
          <Switch checked={hideBranding} onCheckedChange={setHideBranding} id="hide-branding" />
          <Label htmlFor="hide-branding" className="cursor-pointer">
            پنهان کردن برند نشرینو
          </Label>
        </div>
        <Button
          size="sm"
          className="n-focus-ring"
          onClick={handleSave}
          disabled={saving || !profile}
        >
          <Save className="size-4" />
          {saving ? 'در حال ذخیره…' : 'ذخیره'}
        </Button>
      </div>
    </section>
  )
}

function PortalAccessRow({
  access,
  clientName,
  onCopy,
  onRevoke,
  revoking,
}: {
  access: ClientPortalAccessItem
  clientName: string
  onCopy: () => void
  onRevoke: () => void
  revoking: boolean
}) {
  const expired = access.expiresAt !== null && new Date(access.expiresAt).getTime() < Date.now()
  const effective = access.isActive && !expired
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-ink-primary truncate">{clientName}</p>
          {expired && (
            <span className="text-2xs font-bold text-danger bg-danger-soft px-1.5 py-0.5 rounded-md">
              منقضی
            </span>
          )}
          {!access.isActive && !expired && (
            <span className="text-2xs font-bold text-ink-tertiary bg-surface-hover px-1.5 py-0.5 rounded-md">
              ابطال‌شده
            </span>
          )}
          {effective && (
            <span className="text-2xs font-bold text-success bg-success-soft px-1.5 py-0.5 rounded-md">
              فعال
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-1 mt-1">
          {access.permissions.map((p) => (
            <span
              key={p}
              className="inline-flex items-center text-2xs font-medium px-1.5 py-0.5 rounded-md bg-surface-hover text-ink-secondary border border-border"
            >
              {PERMISSION_LABELS[p] ?? p}
            </span>
          ))}
        </div>
        <p className="text-2xs text-ink-tertiary mt-1 font-mono" dir="ltr">
          {access.accessToken.slice(0, 8)}…{access.accessToken.slice(-6)}
        </p>
        {access.expiresAt && (
          <p className="text-2xs text-ink-tertiary mt-0.5">
            انقضا: {formatJalali(new Date(access.expiresAt))}
          </p>
        )}
        {access.lastAccessedAt && (
          <p className="text-2xs text-ink-tertiary">
            آخرین دسترسی: {relativeTime(new Date(access.lastAccessedAt))}
          </p>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button
          size="sm"
          variant="ghost"
          className="h-8 px-2"
          onClick={onCopy}
          aria-label="کپی لینک پورتال"
          title="کپی لینک"
        >
          <Copy className="size-3.5" />
        </Button>
        {access.isActive && (
          <Button
            size="sm"
            variant="ghost"
            className="h-8 px-2 text-danger hover:text-danger hover:bg-danger-soft"
            onClick={onRevoke}
            disabled={revoking}
            aria-label="ابطال توکن"
            title="ابطال"
          >
            <ShieldOff className="size-3.5" />
          </Button>
        )}
      </div>
    </div>
  )
}

// ── Dialogs ──────────────────────────────────────────────────────────────────

function CreateClientDialog({
  open,
  onOpenChange,
  templates,
  submitting,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  templates: WorkspaceTemplateItem[]
  submitting: boolean
  onSubmit: (templateId: string, clientName: string) => void
}) {
  const [templateId, setTemplateId] = useState('')
  const [clientName, setClientName] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!templateId || !clientName.trim()) return
    onSubmit(templateId, clientName.trim())
    setTemplateId('')
    setClientName('')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-start">ایجاد فضای کار جدید از قالب</DialogTitle>
          <DialogDescription className="text-start">
            یک قالب انتخاب کنید و نام مشتری را وارد نمایید.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="template-select">قالب</Label>
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger id="template-select">
                <SelectValue placeholder="قالب را انتخاب کنید" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="client-name">نام مشتری</Label>
            <Input
              id="client-name"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="مثلاً فروشگاه آرمان"
              maxLength={100}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              انصراف
            </Button>
            <Button
              type="submit"
              size="sm"
              className="n-focus-ring"
              disabled={submitting || !templateId || !clientName.trim()}
            >
              {submitting ? 'در حال ایجاد…' : 'ایجاد'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function CreateTemplateDialog({
  open,
  onOpenChange,
  submitting,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  submitting: boolean
  onSubmit: (name: string, description: string, template: Record<string, unknown>) => void
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [plan, setPlan] = useState('free')
  const [brandPrimary, setBrandPrimary] = useState('var(--n-accent)')
  const [brandAccent, setBrandAccent] = useState('var(--n-accent)')
  const [approvalWorkflow, setApprovalWorkflow] = useState(true)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    onSubmit(name.trim(), description.trim(), {
      plan,
      brandPrimaryColor: brandPrimary,
      brandAccentColor: brandAccent,
      approvalWorkflow,
    })
    setName('')
    setDescription('')
    setPlan('free')
    setBrandPrimary('var(--n-accent)')
    setBrandAccent('var(--n-accent)')
    setApprovalWorkflow(true)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-start">ایجاد قالب جدید</DialogTitle>
          <DialogDescription className="text-start">
            قالب‌ها تنظیمات پیش‌فرض فضای کار مشتریان را تعیین می‌کنند.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="tpl-name">نام قالب</Label>
            <Input
              id="tpl-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثلاً قالب فروشگاه آنلاین"
              maxLength={100}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tpl-desc">توضیحات (اختیاری)</Label>
            <Input
              id="tpl-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="توضیح کوتاه درباره قالب"
              maxLength={500}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tpl-plan">پلن پیش‌فرض</Label>
              <Select value={plan} onValueChange={setPlan}>
                <SelectTrigger id="tpl-plan">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">رایگان</SelectItem>
                  <SelectItem value="pro">حرفه‌ای</SelectItem>
                  <SelectItem value="business">تجاری</SelectItem>
                  <SelectItem value="enterprise">سازمانی</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tpl-primary">رنگ اصلی</Label>
              <Input
                id="tpl-primary"
                type="color"
                value={brandPrimary}
                onChange={(e) => setBrandPrimary(e.target.value)}
                className="h-9 p-1"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tpl-accent">رنگ تکمیلی</Label>
            <Input
              id="tpl-accent"
              type="color"
              value={brandAccent}
              onChange={(e) => setBrandAccent(e.target.value)}
              className="h-9 p-1"
            />
          </div>
          <div className="flex items-center gap-2.5">
            <Switch
              checked={approvalWorkflow}
              onCheckedChange={setApprovalWorkflow}
              id="tpl-approval"
            />
            <Label htmlFor="tpl-approval" className="cursor-pointer">
              فعال‌سازی گردش کار تأیید محتوا
            </Label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              انصراف
            </Button>
            <Button
              type="submit"
              size="sm"
              className="n-focus-ring"
              disabled={submitting || !name.trim()}
            >
              {submitting ? 'در حال ایجاد…' : 'ایجاد قالب'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function CreatePortalAccessDialog({
  open,
  onOpenChange,
  clients,
  submitting,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  clients: ClientWorkspaceSummary[]
  submitting: boolean
  onSubmit: (workspaceId: string, permissions: string[]) => void
}) {
  const [workspaceId, setWorkspaceId] = useState('')
  const [permissions, setPermissions] = useState<string[]>(['content:view'])

  const togglePerm = (p: string) => {
    setPermissions((cur) =>
      cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]
    )
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!workspaceId || permissions.length === 0) return
    onSubmit(workspaceId, permissions)
    setWorkspaceId('')
    setPermissions(['content:view'])
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-start">صدور توکن پورتال مشتری</DialogTitle>
          <DialogDescription className="text-start">
            مشتری با این توکن می‌تواند بدون ورود به سیستم، محتوای خود را مشاهده و تأیید کند.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="portal-client">فضای کار مشتری</Label>
            <Select value={workspaceId} onValueChange={setWorkspaceId}>
              <SelectTrigger id="portal-client">
                <SelectValue placeholder="مشتری را انتخاب کنید" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>دسترسی‌ها</Label>
            <div className="space-y-2">
              {ALL_PERMISSIONS.map((p) => (
                <div key={p} className="flex items-center gap-2.5">
                  <Checkbox
                    id={`perm-${p}`}
                    checked={permissions.includes(p)}
                    onCheckedChange={() => togglePerm(p)}
                  />
                  <Label htmlFor={`perm-${p}`} className="cursor-pointer text-sm">
                    {PERMISSION_LABELS[p]}
                  </Label>
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              انصراف
            </Button>
            <Button
              type="submit"
              size="sm"
              className="n-focus-ring"
              disabled={submitting || !workspaceId || permissions.length === 0}
            >
              {submitting ? 'در حال صدور…' : 'صدور توکن'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
