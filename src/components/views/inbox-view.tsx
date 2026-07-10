'use client'

import { useMemo, useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { pageTransition, pageTransitionProps } from '@/lib/motion'
import { toast } from 'sonner'
import {
  Inbox as InboxIcon,
  Send,
  MessageSquare,
  AtSign,
  Mail,
  Sparkles,
  Zap,
  Bot,
  ChevronLeft,
  Plus,
  UserCheck,
  Loader2,
  CheckCheck,
  BookOpen,
} from 'lucide-react'

import { api } from '@/lib/api'
import { relativeTime } from '@/lib/jalali'
import {
  SectionTitle,
  PlatformIcon,
  EmptyState,
  SkeletonList,
  LoadingState,
  AnimatedTabs,
} from '@/components/dashboard/shared'
import { useAnnounceValue } from '@/lib/aria-live'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { interpolate } from '@/modules/inbox/snippet-shared'
import type { SavedReply } from '@/modules/inbox/snippet-shared'
import type { CommentDmRule } from '@/modules/automation/comment-dm-shared'

interface InboxMessage {
  id: string
  senderName: string
  senderAvatar: string | null
  message: string
  isRead: boolean
  isReplied: boolean
  reply: string | null
  platform: string
  platformName: string
  messageType: string
  assigneeId: string | null
  assigneeName: string | null
  assigneeAvatar: string | null
  createdAt: string
  status: 'new' | 'assigned' | 'in_progress' | 'resolved'
  slaStartedAt: string | null
}

const STATUS_LABEL: Record<string, string> = {
  new: 'جدید',
  assigned: 'ارجاع شده',
  in_progress: 'در حال بررسی',
  resolved: 'حل شده',
}

const STATUS_COLOR: Record<string, string> = {
  new: 'text-info bg-info-soft border-info/20',
  assigned: 'text-warning bg-warning-soft border-warning/20',
  in_progress: 'text-accent bg-accent/10 border-accent/20',
  resolved: 'text-success bg-success-soft border-success/20',
}

const SLA_TARGET_MINUTES = 120 // 2h default

function useSlaOverdue(slaStartedAt: string | null): boolean {
  if (!slaStartedAt) return false
  const elapsed = (Date.now() - new Date(slaStartedAt).getTime()) / 60000
  return elapsed > SLA_TARGET_MINUTES
}

interface Member {
  id: string
  name: string
  avatar: string | null
  roleLabel: string
}

const MESSAGE_TYPE_LABEL: Record<string, string> = {
  comment: 'کامنت',
  dm: 'پیام مستقیم',
  mention: 'منشن',
}

const MESSAGE_TYPE_ICON: Record<string, React.ElementType> = {
  comment: MessageSquare,
  dm: Mail,
  mention: AtSign,
}

/** Display shape for the automation panel — derived from real CommentDmRule rows. */
interface AutomationDisplay {
  trigger: string
  action: string
  platform: string
  active: boolean
}

/** Map a real CommentDmRule to the compact shape the automation panel renders. */
function ruleToAutomation(rule: CommentDmRule): AutomationDisplay {
  const kws = rule.keywords && rule.keywords.length > 0 ? rule.keywords : [rule.keyword]
  const trigger = kws.filter(Boolean).join('، ') || '—'
  const action = rule.dmTemplate.length > 50 ? `${rule.dmTemplate.slice(0, 50)}…` : rule.dmTemplate
  return {
    trigger,
    action,
    platform: rule.platformName,
    active: rule.isActive,
  }
}

export function InboxView() {
  const [filter, setFilter] = useState<
    'all' | 'unread' | 'comment' | 'dm' | 'unassigned' | 'overdue' | 'resolved'
  >('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [isGeneratingReply, setIsGeneratingReply] = useState(false)
  const [showSnippets, setShowSnippets] = useState(false)
  const queryClient = useQueryClient()
  const router = useRouter()

  // Real comment→DM automation rules (P1-17: replaces hardcoded mock data).
  const { data: commentDmRules } = useQuery<CommentDmRule[]>({
    queryKey: ['comment-dm-rules'],
    queryFn: () => api.get<CommentDmRule[]>('/api/automation/comment-dm-rules'),
  })
  const automations = useMemo(() => (commentDmRules ?? []).map(ruleToAutomation), [commentDmRules])

  const { data: savedReplies } = useQuery<SavedReply[]>({
    queryKey: ['inbox-saved-replies'],
    queryFn: () => api.get<SavedReply[]>('/api/inbox/saved-replies'),
  })

  const {
    data: messages,
    isLoading,
    isError,
    refetch,
  } = useQuery<InboxMessage[]>({
    queryKey: ['inbox'],
    queryFn: () => api.getPaginated<InboxMessage>('/api/inbox'),
  })

  const { data: members } = useQuery<Member[]>({
    queryKey: ['members'],
    queryFn: () => api.getPaginated<Member>('/api/members'),
  })

  const filtered = useMemo(() => {
    if (!messages) return []
    return messages.filter((m) => {
      if (filter === 'unread') return !m.isRead || m.id === selectedId
      if (filter === 'comment') return m.messageType === 'comment'
      if (filter === 'dm') return m.messageType === 'dm'
      if (filter === 'unassigned') return !m.assigneeId && m.status !== 'resolved'
      if (filter === 'overdue') {
        if (!m.slaStartedAt || m.status === 'resolved') return false
        return (Date.now() - new Date(m.slaStartedAt).getTime()) / 60000 > SLA_TARGET_MINUTES
      }
      if (filter === 'resolved') return m.status === 'resolved'
      return true
    })
  }, [messages, filter, selectedId])

  const selected = messages?.find((m) => m.id === selectedId) ?? null
  const unreadCount = messages?.filter((m) => !m.isRead).length ?? 0
  useAnnounceValue(unreadCount, 'پیام خوانده‌نشده')

  const insertSnippet = useCallback(
    (reply: SavedReply) => {
      const text = interpolate(reply.body, {
        senderName: selected?.senderName,
        channelName: selected?.platform,
      })
      setReplyText(text)
      setShowSnippets(false)
    },
    [selected]
  )

  // ── Mutations ──────────────────────────────────────────────────────
  const replyMutation = useMutation({
    mutationFn: ({ id, reply }: { id: string; reply: string }) =>
      api.post(`/api/inbox/${id}/reply`, { reply }),
    onSuccess: () => {
      toast.success('پاسخ ارسال شد ✓')
      setReplyText('')
      queryClient.invalidateQueries({ queryKey: ['inbox'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] })
    },
    onError: () => toast.error('خطا در ارسال پاسخ'),
  })

  const assignMutation = useMutation({
    mutationFn: ({ id, assigneeId }: { id: string; assigneeId: string | null }) =>
      api.post(`/api/inbox/${id}/assign`, { assigneeId }),
    onSuccess: () => {
      toast.success('ارجاع شد')
      queryClient.invalidateQueries({ queryKey: ['inbox'] })
    },
    onError: () => toast.error('خطا در ارجاع'),
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.post(`/api/inbox/${id}/status`, { status }),
    onSuccess: (_data, vars) => {
      toast.success(STATUS_LABEL[vars.status] ? `وضعیت: ${STATUS_LABEL[vars.status]}` : 'به‌روزشد')
      queryClient.invalidateQueries({ queryKey: ['inbox'] })
    },
    onError: () => toast.error('خطا در تغییر وضعیت'),
  })

  const readStateMutation = useMutation({
    mutationFn: ({ id, isRead }: { id: string; isRead: boolean }) =>
      api.post<{ ok: boolean }>(`/api/inbox/${id}/${isRead ? 'read' : 'unread'}`, {}),
    onMutate: async ({ id, isRead }) => {
      await queryClient.cancelQueries({ queryKey: ['inbox'] })
      const previous = queryClient.getQueryData<InboxMessage[]>(['inbox'])

      queryClient.setQueryData<InboxMessage[]>(['inbox'], (current) =>
        current?.map((message) => (message.id === id ? { ...message, isRead } : message))
      )

      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData<InboxMessage[]>(['inbox'], context.previous)
      }
      toast.error('خطا در تغییر وضعیت خواندن')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['inbox'] })
    },
  })

  // ── Handlers ───────────────────────────────────────────────────────
  const handleSelectMessage = (id: string) => {
    setSelectedId(id)
    const message = messages?.find((m) => m.id === id)
    if (message && !message.isRead) {
      readStateMutation.mutate({ id, isRead: true })
    }
  }

  const handleReply = () => {
    if (!replyText.trim()) {
      toast.error('متن پاسخ خالی است.')
      return
    }
    if (!selected) return
    replyMutation.mutate({ id: selected.id, reply: replyText })
  }

  const handleSmartReply = async () => {
    if (!selected) return
    setIsGeneratingReply(true)
    try {
      const res = await fetch('/api/ai/caption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: `پاسخ به این پیام: "${selected.message}"`,
          platform: selected.platform,
          tone: 'friendly',
        }),
      })
      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let fullText = ''
      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const jsonStr = line.slice(6).trim()
              if (jsonStr === '[DONE]') break
              try {
                const json = JSON.parse(jsonStr)
                if (json.content) {
                  fullText += json.content
                  setReplyText(fullText)
                }
              } catch {
                /* intentional no-op */
              }
            }
          }
        }
      }
      toast.success('پاسخ هوشمند آماده شد — بررسی و ارسال کنید')
    } catch {
      toast.error('خطا در تولید پاسخ هوشمند')
    } finally {
      setIsGeneratingReply(false)
    }
  }

  return (
    <motion.div
      initial={pageTransition.initial}
      animate={pageTransition.animate}
      transition={pageTransitionProps}
      className="space-y-5"
    >
      <SectionTitle
        icon={InboxIcon}
        badge={
          unreadCount > 0 && (
            <span className="inline-flex items-center gap-1 text-xs bg-info-soft text-info border border-info/20 px-2 py-0.5 rounded-full num-tabular">
              <span className="size-1.5 rounded-full bg-info" />
              {relativeTime(new Date(Date.now() - 1000 * 60 * 5))} — {unreadCount} ناخوانده
            </span>
          )
        }
      >
        صندوق ورودی یکپارچه
      </SectionTitle>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4">
        {/* Left: List */}
        <div className="lg:col-span-4 n-card p-0 overflow-hidden">
          <div className="px-3 pt-3 pb-0 border-b border-border overflow-x-auto thin-scrollbar">
            <AnimatedTabs
              value={filter}
              onValueChange={(v) => setFilter(v as typeof filter)}
              tabs={[
                { value: 'all', label: 'همه' },
                { value: 'unread', label: 'ناخوانده', count: unreadCount },
                { value: 'unassigned', label: 'بدون ارجاع' },
                { value: 'overdue', label: 'تأخیر SLA' },
                { value: 'resolved', label: 'حل‌شده' },
                { value: 'comment', label: 'کامنت' },
                { value: 'dm', label: 'پیام مستقیم' },
              ]}
            />
          </div>

          <div className="max-h-[60vh] overflow-y-auto thin-scrollbar">
            <LoadingState
              isLoading={isLoading}
              isError={isError}
              onRetry={refetch}
              errorLabel="خطا در بارگذاری صندوق ورودی"
              skeleton={<SkeletonList rows={6} avatar />}
            >
              {filtered.length === 0 ? (
                <EmptyState
                  icon={InboxIcon}
                  title="پیامی یافت نشد"
                  message="در این فیلتر پیامی وجود ندارد. با شروع گفتگو با مخاطبان، پیام‌های جدید اینجا نمایش داده می‌شوند."
                  illustration="inbox"
                />
              ) : (
                filtered.map((m) => (
                  <MessageListItem
                    key={m.id}
                    message={m}
                    active={m.id === selectedId}
                    onClick={() => handleSelectMessage(m.id)}
                  />
                ))
              )}
            </LoadingState>
          </div>
        </div>

        {/* Center: Thread */}
        <div className="lg:col-span-5 n-card n-gradient-border p-0 overflow-hidden flex flex-col min-h-0 sm:min-h-[60vh]">
          {!selected ? (
            <div className="flex-1 flex items-center justify-center p-10">
              <EmptyState
                icon={MessageSquare}
                title="یک پیام را انتخاب کنید"
                message="برای مشاهده محتوای کامل و پاسخ‌دهی، پیامی را از فهرست انتخاب کنید."
                illustration="inbox"
              />
            </div>
          ) : (
            <>
              {/* Thread header */}
              <div className="p-4 border-b border-border">
                <div className="flex items-center gap-3">
                  <Avatar className="size-10">
                    {selected.senderAvatar && (
                      <AvatarImage src={selected.senderAvatar} alt={selected.senderName} />
                    )}
                    <AvatarFallback>{selected.senderName.slice(0, 1)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-semibold text-ink-primary truncate">
                      {selected.senderName}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <PlatformIcon platform={selected.platform} className="size-3.5" />
                      <span className="text-xs text-ink-tertiary">{selected.platformName}</span>
                      <span className="text-ink-tertiary">•</span>
                      <TypeBadge type={selected.messageType} />
                      {selected.assigneeName && (
                        <>
                          <span className="text-ink-tertiary">•</span>
                          <span className="inline-flex items-center gap-1 text-2xs text-ink-tertiary">
                            <UserCheck className="size-3" />
                            {selected.assigneeName}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-ink-tertiary">
                    {relativeTime(new Date(selected.createdAt))}
                  </span>
                </div>
                {/* Status workflow */}
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  <span
                    className={cn(
                      'text-2xs font-semibold px-2 py-0.5 rounded-md border',
                      STATUS_COLOR[selected.status ?? 'new']
                    )}
                  >
                    {STATUS_LABEL[selected.status ?? 'new']}
                  </span>
                  <span
                    className={cn(
                      'text-2xs font-semibold px-2 py-0.5 rounded-md border',
                      selected.isRead
                        ? 'text-ink-secondary bg-surface border-border'
                        : 'text-info bg-info-soft border-info/20'
                    )}
                  >
                    {selected.isRead ? 'خوانده‌شده' : 'ناخوانده'}
                  </span>
                  {selected.slaStartedAt && selected.status !== 'resolved' && (
                    <SlaTimer slaStartedAt={selected.slaStartedAt} />
                  )}
                  <button
                    onClick={() =>
                      readStateMutation.mutate({ id: selected.id, isRead: !selected.isRead })
                    }
                    disabled={readStateMutation.isPending}
                    className={cn(
                      'n-focus-ring inline-flex items-center gap-1 text-2xs font-semibold px-2 py-0.5 rounded-md border transition-colors',
                      selected.isRead
                        ? 'text-info bg-info-soft border-info/20 hover:bg-info/15'
                        : 'text-ink-secondary bg-surface border-border hover:bg-surface-hover'
                    )}
                  >
                    <CheckCheck className="size-3" />
                    {selected.isRead ? 'ناخوانده کن' : 'خوانده کن'}
                  </button>
                  {selected.status !== 'resolved' && (
                    <button
                      onClick={() => statusMutation.mutate({ id: selected.id, status: 'resolved' })}
                      disabled={statusMutation.isPending}
                      className="n-focus-ring text-2xs font-semibold px-2 py-0.5 rounded-md border text-success bg-success-soft border-success/20 hover:bg-success/20 transition-colors"
                    >
                      حل شد ✓
                    </button>
                  )}
                  {selected.status === 'resolved' && (
                    <button
                      onClick={() => statusMutation.mutate({ id: selected.id, status: 'new' })}
                      disabled={statusMutation.isPending}
                      className="n-focus-ring text-2xs font-semibold px-2 py-0.5 rounded-md border text-ink-secondary bg-surface border-border hover:bg-surface-hover transition-colors"
                    >
                      بازگشایی
                    </button>
                  )}
                  {selected.status === 'new' && (
                    <button
                      onClick={() =>
                        statusMutation.mutate({ id: selected.id, status: 'in_progress' })
                      }
                      disabled={statusMutation.isPending}
                      className="n-focus-ring text-2xs font-semibold px-2 py-0.5 rounded-md border text-accent bg-accent/10 border-accent/20 hover:bg-accent/20 transition-colors"
                    >
                      شروع بررسی
                    </button>
                  )}
                </div>

                {/* Assign dropdown */}
                {members && members.length > 0 && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-2xs text-ink-tertiary">ارجاع به:</span>
                    <Select
                      value={selected.assigneeId ?? 'none'}
                      onValueChange={(v) =>
                        assignMutation.mutate({
                          id: selected.id,
                          assigneeId: v === 'none' ? null : v,
                        })
                      }
                    >
                      <SelectTrigger className="h-7 w-full sm:w-40 text-xs">
                        <SelectValue placeholder="بدون ارجاع" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">بدون ارجاع</SelectItem>
                        {members.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* Thread body */}
              <div className="flex-1 overflow-y-auto thin-scrollbar p-4 space-y-3">
                <div className="flex justify-start">
                  <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-surface-hover px-4 py-2.5">
                    <p className="text-sm text-ink-primary whitespace-pre-wrap" dir="auto">
                      {selected.message}
                    </p>
                  </div>
                </div>
                {selected.isReplied && selected.reply && (
                  <div className="flex justify-end">
                    <div className="max-w-[80%] rounded-2xl rounded-tl-sm bg-accent-soft border border-accent/20 px-4 py-2.5">
                      <p className="text-2xs text-accent font-bold mb-1">پاسخ شما</p>
                      <p className="text-sm text-ink-primary whitespace-pre-wrap">
                        {selected.reply}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Reply box */}
              <div className="p-3 border-t border-border bg-surface-subtle">
                {/* Snippet picker */}
                {showSnippets && savedReplies && savedReplies.length > 0 && (
                  <div className="mb-2 rounded-xl border border-border bg-background shadow-lg max-h-48 overflow-y-auto">
                    {savedReplies.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => insertSnippet(r)}
                        className="n-focus-ring w-full text-start px-3 py-2.5 hover:bg-surface-hover border-b border-border last:border-0"
                      >
                        <p className="text-sm font-semibold text-ink-primary">{r.title}</p>
                        <p className="text-xs text-ink-secondary truncate">{r.body}</p>
                      </button>
                    ))}
                  </div>
                )}
                <Textarea
                  dir="rtl"
                  rows={3}
                  placeholder="پاسخ خود را بنویسید… (/ برای قالب‌های ذخیره‌شده)"
                  value={replyText}
                  onChange={(e) => {
                    setReplyText(e.target.value)
                    if (e.target.value.startsWith('/')) setShowSnippets(true)
                    else setShowSnippets(false)
                  }}
                  className="resize-none bg-background mb-2"
                />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs text-ink-tertiary">
                    {isGeneratingReply ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin" />
                        <span>در حال تولید پاسخ هوشمند…</span>
                      </>
                    ) : replyText ? (
                      <>
                        <CheckCheck className="size-3.5 text-success" />
                        <span>آماده ارسال</span>
                      </>
                    ) : (
                      <>
                        <Bot className="size-3.5" />
                        <span>از پاسخ هوشمند استفاده کنید</span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {savedReplies && savedReplies.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="min-h-[44px] sm:min-h-0"
                        onClick={() => setShowSnippets((v) => !v)}
                        aria-label="پاسخ‌های ذخیره‌شده"
                        aria-expanded={showSnippets}
                      >
                        <BookOpen className="size-3.5" />
                        قالب‌ها
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="min-h-[44px] sm:min-h-0"
                      onClick={handleSmartReply}
                      disabled={isGeneratingReply}
                    >
                      {isGeneratingReply ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="size-3.5" />
                      )}
                      پیشنهاد هوشمند
                    </Button>
                    <Button
                      size="sm"
                      className="min-h-[44px] sm:min-h-0"
                      onClick={handleReply}
                      disabled={replyMutation.isPending || !replyText.trim()}
                    >
                      {replyMutation.isPending ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Send className="size-3.5" />
                      )}
                      ارسال پاسخ
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Right: Automation events — desktop only */}
        <div className="hidden lg:block lg:col-span-3 n-card p-4 h-fit">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="size-4 text-accent" />
            <h3 className="text-sm font-semibold text-ink-primary">رویدادهای اتوماسیون</h3>
          </div>
          <p className="text-xs text-ink-tertiary mb-3">
            قوانین فعال برای پاسخ‌دهی خودکار به مخاطبان
          </p>
          <Separator className="mb-3" />
          <div className="space-y-2 max-h-96 overflow-y-auto thin-scrollbar">
            {automations.length > 0 ? (
              automations.map((a, i) => (
                <div
                  key={i}
                  className={cn(
                    'rounded-xl border p-3 transition-colors',
                    a.active
                      ? 'border-border bg-surface-subtle'
                      : 'border-border bg-surface-subtle opacity-60'
                  )}
                >
                  <div className="flex items-start gap-2">
                    <PlatformIcon platform={a.platform} className="size-6 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-ink-primary truncate">{a.trigger}</p>
                      <div className="flex items-center gap-1 mt-1 text-xs text-ink-tertiary">
                        <ChevronLeft className="size-3" />
                        <span className="truncate">{a.action}</span>
                      </div>
                    </div>
                    <span
                      className={cn(
                        'size-2 rounded-full shrink-0 mt-1.5',
                        a.active ? 'bg-success' : 'bg-ink-tertiary'
                      )}
                    />
                  </div>
                </div>
              ))
            ) : (
              <EmptyState
                icon={Bot}
                title="اتوماسیونی فعال نیست"
                message="با ساخت قانون کامنت→DM، پاسخ خودکار به مخاطبان را فعال کنید."
                size="compact"
                action={
                  <Button variant="outline" size="sm" onClick={() => router.push('/settings')}>
                    <Plus className="size-3.5" />
                    ساخت اتوماسیون
                  </Button>
                }
              />
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full mt-3"
            onClick={() => router.push('/settings')}
          >
            <Plus className="size-3.5" />
            اتوماسیون جدید
          </Button>
        </div>
      </div>
    </motion.div>
  )
}

function SlaTimer({ slaStartedAt }: { slaStartedAt: string }) {
  const overdue = useSlaOverdue(slaStartedAt)
  const elapsedMin = Math.floor((Date.now() - new Date(slaStartedAt).getTime()) / 60000)
  const h = Math.floor(elapsedMin / 60)
  const m = elapsedMin % 60
  const label = h > 0 ? `${h}h ${m}m` : `${m}m`
  // Subtle SLA indicator — warning color text only, no full background, so the
  // message text remains the primary visual element in the row.
  return (
    <span
      className={cn(
        'text-2xs font-mono px-1.5 py-0.5 rounded-md border',
        overdue
          ? 'text-warning border-warning/30 bg-transparent'
          : 'text-ink-tertiary bg-surface border-border'
      )}
    >
      ⏱ {label}
      {overdue ? ' — تأخیر' : ''}
    </span>
  )
}

function MessageListItem({
  message,
  active,
  onClick,
}: {
  message: InboxMessage
  active: boolean
  onClick: () => void
}) {
  const TypeIcon = MESSAGE_TYPE_ICON[message.messageType] ?? MessageSquare
  const overdue = useSlaOverdue(message.slaStartedAt)
  return (
    <button
      onClick={onClick}
      aria-current={active ? 'true' : undefined}
      aria-label={`${message.senderName}، ${message.isRead ? 'خوانده‌شده' : 'ناخوانده'}، ${STATUS_LABEL[message.status] ?? message.status}`}
      className={cn(
        'n-focus-ring w-full text-start flex items-start gap-3 p-3 border-b border-s-4 border-border border-s-transparent transition-colors',
        active
          ? 'bg-accent-tint border-s-accent'
          : message.isRead
            ? 'hover:bg-surface-subtle'
            : 'bg-info-soft/45 hover:bg-info-soft/70',
        overdue && !active && 'border-s-danger'
      )}
    >
      <div className="relative shrink-0">
        <Avatar className="size-10">
          {message.senderAvatar && (
            <AvatarImage src={message.senderAvatar} alt={message.senderName} />
          )}
          <AvatarFallback className="text-sm">{message.senderName.slice(0, 1)}</AvatarFallback>
        </Avatar>
        <span className="absolute -bottom-0.5 -end-0.5 flex size-4 items-center justify-center rounded-full bg-background ring-1 ring-border">
          <PlatformIcon platform={message.platform} className="size-2.5" />
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <p
            className={cn(
              'text-sm truncate',
              message.isRead ? 'font-semibold text-ink-secondary' : 'font-bold text-ink-primary'
            )}
          >
            {message.senderName}
          </p>
          <span className="text-2xs text-ink-tertiary shrink-0">
            {relativeTime(new Date(message.createdAt))}
          </span>
        </div>
        <p
          className={cn(
            'text-sm line-clamp-2 leading-relaxed',
            message.isRead ? 'text-ink-tertiary' : 'font-medium text-ink-secondary'
          )}
          dir="auto"
        >
          {message.message}
        </p>
        <div className="flex items-center gap-1.5 mt-1 overflow-hidden">
          <TypeIcon className="size-3 text-ink-tertiary shrink-0" />
          <span className="text-2xs text-ink-tertiary shrink-0">
            {MESSAGE_TYPE_LABEL[message.messageType] ?? message.messageType}
          </span>
          {/* Status chip row — limit visible chips to at most 2 via overflow-hidden so the message text stays primary. */}
          <span className="inline-flex items-center gap-1 ms-auto overflow-hidden">
            <span
              className={cn(
                'text-2xs font-semibold px-1.5 py-0.5 rounded border shrink-0',
                STATUS_COLOR[message.status]
              )}
            >
              {STATUS_LABEL[message.status]}
            </span>
            {!message.isRead && (
              <span className="inline-flex items-center gap-1 text-2xs font-semibold px-1.5 py-0.5 rounded border text-info bg-info-soft border-info/20 shrink-0">
                <span className="size-1.5 rounded-full bg-info" />
                ناخوانده
              </span>
            )}
            {message.isReplied && (
              <span className="text-2xs text-success font-semibold shrink-0">پاسخ داده شد</span>
            )}
          </span>
        </div>
      </div>
    </button>
  )
}

function TypeBadge({ type }: { type: string }) {
  const Icon = MESSAGE_TYPE_ICON[type] ?? MessageSquare
  return (
    <span className="inline-flex items-center gap-1 text-2xs text-ink-tertiary">
      <Icon className="size-3" />
      {MESSAGE_TYPE_LABEL[type] ?? type}
    </span>
  )
}
