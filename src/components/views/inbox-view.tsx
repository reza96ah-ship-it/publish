'use client'

import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import {
  useInfiniteQuery,
  useQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query'
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
  Paperclip,
  Clock,
  Search,
  Tag,
  X,
  ChevronRight,
} from 'lucide-react'

import { api } from '@/lib/api'
import type { PaginatedResponse } from '@/lib/api'
import { relativeTime, toPersianDigits } from '@/lib/jalali'
import {
  SectionTitle,
  PlatformIcon,
  EmptyState,
  SkeletonList,
  LoadingState,
  AnimatedTabs,
} from '@/components/dashboard/shared'
import { useAnnounceValue } from '@/lib/aria-live'
import { useInboxStream } from '@/hooks/use-inbox-stream'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
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
  firstResponseAt?: string | null
  resolvedAt?: string | null
  priority?: string
  tags?: string[]
  attachments?: InboxThreadAttachment[]
  lockedById?: string | null
  lockedByName?: string | null
  lockExpiresAt?: string | null
}

interface InboxThreadAttachment {
  type: string
  title: string
  url: string | null
  providerId: string | null
}

interface InboxThreadTimelineMessage {
  id: string
  providerMessageId: string
  direction: 'inbound' | 'outbound' | 'internal' | string
  messageType: string
  senderExternalId: string | null
  senderName: string
  body: string
  attachments: InboxThreadAttachment[]
  createdAt: string
}

interface InboxThreadSummary {
  id: string
  providerThreadId: string
  providerUserId: string | null
  title: string
  platform: string
  platformName: string
  messageType: string
  status: string
  assigneeId: string | null
  assigneeName: string | null
  assigneeAvatar: string | null
  priority: string
  tags: string[]
  lockedById: string | null
  lockedByName: string | null
  lockExpiresAt: string | null
  unreadCount: number
  lastMessageAt: string
  lastInboundAt: string | null
  slaStartedAt: string
  firstResponseAt: string | null
  resolvedAt: string | null
  replyWindowExpiresAt: string | null
  createdAt: string
  updatedAt: string
  lastMessage: InboxThreadTimelineMessage | null
}

interface InboxThreadDetail extends InboxThreadSummary {
  messages: InboxThreadTimelineMessage[]
}

interface ThreadCustomerContext {
  customer: { name: string; firstSeenAt: string | null; threadCount: number }
  priorThreads: {
    id: string
    messageType: string
    status: string
    lastMessageAt: string
    preview: string
  }[]
}

type ConversationKind = 'message' | 'thread'
type InboxStatus = InboxMessage['status']

const INBOX_STATUSES: InboxStatus[] = ['new', 'assigned', 'in_progress', 'resolved']

function asInboxStatus(status: string): InboxStatus {
  return INBOX_STATUSES.includes(status as InboxStatus) ? (status as InboxStatus) : 'new'
}

function latestOutbound(messages: InboxThreadTimelineMessage[] | undefined) {
  if (!messages) return null
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.direction === 'outbound') return messages[i]
  }
  return null
}

function threadToMessage(thread: InboxThreadSummary, detail?: InboxThreadDetail): InboxMessage {
  const outbound = latestOutbound(detail?.messages)
  return {
    id: thread.id,
    senderName: thread.title || thread.providerUserId || 'Instagram user',
    senderAvatar: null,
    message: thread.lastMessage?.body ?? '',
    isRead: thread.unreadCount === 0,
    isReplied: Boolean(outbound),
    reply: outbound?.body ?? null,
    platform: thread.platform,
    platformName: thread.platformName,
    messageType: thread.messageType,
    assigneeId: thread.assigneeId,
    assigneeName: thread.assigneeName,
    assigneeAvatar: thread.assigneeAvatar,
    createdAt: thread.lastMessageAt,
    status: asInboxStatus(thread.status),
    slaStartedAt: thread.slaStartedAt,
    firstResponseAt: thread.firstResponseAt,
    resolvedAt: thread.resolvedAt,
    priority: thread.priority,
    tags: thread.tags,
    attachments: thread.lastMessage?.attachments ?? [],
    lockedById: thread.lockedById,
    lockedByName: thread.lockedByName,
    lockExpiresAt: thread.lockExpiresAt,
  }
}

const STATUS_LABEL: Record<string, string> = {
  new: 'رسیدگی‌نشده',
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

const PRIORITY_LABEL: Record<string, string> = {
  low: 'کم',
  normal: 'عادی',
  high: 'زیاد',
  urgent: 'فوری',
}

const PRIORITY_COLOR: Record<string, string> = {
  low: 'text-ink-tertiary bg-surface border-border',
  normal: 'text-ink-secondary bg-surface border-border',
  high: 'text-warning bg-warning-soft border-warning/20',
  urgent: 'text-danger bg-danger-soft border-danger/20',
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

function updateInfiniteItems<T>(
  data: InfiniteData<PaginatedResponse<T>> | undefined,
  update: (item: T) => T
): InfiniteData<PaginatedResponse<T>> | undefined {
  if (!data) return data
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      data: page.data.map(update),
    })),
  }
}

function initialInboxSelection(): { id: string | null; kind: ConversationKind | null } {
  if (typeof window === 'undefined') return { id: null, kind: null }
  const params = new URLSearchParams(window.location.search)
  const threadId = params.get('thread')
  if (threadId) return { id: threadId, kind: 'thread' }
  const messageId = params.get('message')
  return messageId ? { id: messageId, kind: 'message' } : { id: null, kind: null }
}

function setInboxSelectionUrl(id: string | null, kind: ConversationKind | null) {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  url.searchParams.delete('thread')
  url.searchParams.delete('message')
  if (id && kind) url.searchParams.set(kind === 'thread' ? 'thread' : 'message', id)
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}`)
}

export function InboxView() {
  const [initialSelection] = useState(initialInboxSelection)
  const [filter, setFilter] = useState<
    'all' | 'unread' | 'comment' | 'dm' | 'unassigned' | 'mine' | 'urgent' | 'overdue' | 'resolved'
  >('all')
  const [selectedId, setSelectedId] = useState<string | null>(initialSelection.id)
  const [selectedKindHint, setSelectedKindHint] = useState<ConversationKind | null>(
    initialSelection.kind
  )
  const [replyText, setReplyText] = useState('')
  const [isGeneratingReply, setIsGeneratingReply] = useState(false)
  const [showSnippets, setShowSnippets] = useState(false)
  const [tagDraft, setTagDraft] = useState('')
  const queryClient = useQueryClient()
  const router = useRouter()

  // Realtime: webhook ingest + teammate replies land live — no manual refresh.
  const { data: workspaceId } = useQuery<string>({
    queryKey: ['workspace-id'],
    queryFn: async () => {
      const ws = await api.get<{ id: string }>('/api/workspace')
      return ws.id
    },
    staleTime: Infinity,
  })
  useInboxStream(workspaceId, (event) => {
    if (event.kind === 'created' || event.kind === 'message') {
      toast.info(
        event.senderName ? `پیام جدید از ${event.senderName}` : 'پیام جدید در صندوق ورودی',
        { description: event.preview }
      )
    }
  })

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
    data: legacyPages,
    isPending: isLegacyPending,
    isError: isLegacyError,
    refetch: refetchLegacy,
    fetchNextPage: fetchNextLegacy,
    hasNextPage: hasNextLegacy,
    isFetchingNextPage: isFetchingNextLegacy,
  } = useInfiniteQuery({
    queryKey: ['inbox'],
    queryFn: ({ pageParam }) =>
      api.getPage<InboxMessage>(
        `/api/inbox${pageParam ? `?cursor=${encodeURIComponent(pageParam)}` : ''}`
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  })
  const messages = useMemo(
    () => legacyPages?.pages.flatMap((page) => page.data) ?? [],
    [legacyPages]
  )

  // Full-text search over titles + message bodies (server-side `q` param).
  // Debounced so keystrokes don't fan out into a request each.
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  // Server-side queue filter — 'overdue' stays client-side (SLA math in view).
  const serverQueue = filter === 'overdue' ? 'all' : filter
  const {
    data: threadPages,
    isPending: isThreadsPending,
    isError: isThreadsError,
    refetch: refetchThreads,
    fetchNextPage: fetchNextThreads,
    hasNextPage: hasNextThreads,
    isFetchingNextPage: isFetchingNextThreads,
  } = useInfiniteQuery({
    queryKey: ['inbox-threads', serverQueue, search],
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ queue: serverQueue })
      if (search) params.set('q', search)
      if (pageParam) params.set('cursor', pageParam)
      return api.getPage<InboxThreadSummary>(`/api/inbox/threads?${params}`)
    },
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  })
  const threads = useMemo(
    () => threadPages?.pages.flatMap((page) => page.data) ?? [],
    [threadPages]
  )

  // Queue-rail badge counts + own membership id (hides own presence lock).
  const { data: queueCounts } = useQuery<{
    counts: Record<string, number>
    membershipId: string | null
    legacyUnread: number
  }>({
    queryKey: ['inbox-thread-counts'],
    queryFn: () =>
      api.get<{
        counts: Record<string, number>
        membershipId: string | null
        legacyUnread: number
      }>(
        '/api/inbox/threads/counts'
      ),
  })
  const myMembershipId = queueCounts?.membershipId ?? null

  const { data: members } = useQuery<Member[]>({
    queryKey: ['members'],
    queryFn: () => api.getPaginated<Member>('/api/members'),
  })

  const selectedThreadFromList =
    selectedKindHint === 'thread' && selectedId
      ? (threads.find((thread) => thread.id === selectedId) ?? null)
      : null
  const selectedMessage =
    selectedKindHint === 'message' && selectedId
      ? (messages.find((message) => message.id === selectedId) ?? null)
      : null
  const selectedThreadId = selectedKindHint === 'thread' ? selectedId : null

  const { data: selectedThreadDetail, isLoading: isThreadDetailLoading } =
    useQuery<InboxThreadDetail>({
      queryKey: ['inbox-thread', selectedThreadId],
      queryFn: () => api.get<InboxThreadDetail>(`/api/inbox/threads/${selectedThreadId}`),
      enabled: Boolean(selectedThreadId),
    })
  const selectedThread =
    selectedThreadFromList ??
    (selectedThreadDetail?.id === selectedThreadId ? selectedThreadDetail : null)

  const {
    data: timelinePages,
    fetchNextPage: fetchOlderMessages,
    hasNextPage: hasOlderMessages,
    isFetchingNextPage: isFetchingOlderMessages,
  } = useInfiniteQuery({
    queryKey: ['inbox-thread-messages', selectedThreadId],
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ limit: '50' })
      if (pageParam) params.set('cursor', pageParam)
      return api.getPage<InboxThreadTimelineMessage>(
        `/api/inbox/threads/${selectedThreadId}/messages?${params}`
      )
    },
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled: Boolean(selectedThreadId),
  })
  const timelineMessages = useMemo(() => {
    if (!timelinePages) return selectedThreadDetail?.messages ?? []
    return [...timelinePages.pages].reverse().flatMap((page) => page.data)
  }, [selectedThreadDetail?.messages, timelinePages])

  const { data: threadContext } = useQuery<ThreadCustomerContext>({
    queryKey: ['inbox-thread-context', selectedThread?.id],
    queryFn: () =>
      api.get<ThreadCustomerContext>(`/api/inbox/threads/${selectedThread?.id}/context`),
    enabled: Boolean(selectedThread?.id),
  })

  const conversationMessages = useMemo(() => {
    const threadMessages = threads.map((thread) =>
        threadToMessage(
          thread,
          selectedThreadDetail?.id === thread.id ? selectedThreadDetail : undefined
        )
      )
    return [...threadMessages, ...messages].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  }, [messages, selectedThreadDetail, threads])

  const filtered = useMemo(() => {
    return conversationMessages.filter((m) => {
      if (search) {
        const haystack = `${m.senderName} ${m.message}`.toLocaleLowerCase('fa')
        if (!haystack.includes(search.toLocaleLowerCase('fa'))) return false
      }
      if (filter === 'unread') return !m.isRead || m.id === selectedId
      if (filter === 'comment') return m.messageType === 'comment'
      if (filter === 'dm') return m.messageType === 'dm'
      if (filter === 'unassigned') return !m.assigneeId && m.status !== 'resolved'
      if (filter === 'mine') return Boolean(myMembershipId) && m.assigneeId === myMembershipId
      if (filter === 'urgent')
        return (m.priority === 'high' || m.priority === 'urgent') && m.status !== 'resolved'
      if (filter === 'overdue') {
        if (!m.slaStartedAt || m.firstResponseAt || m.status === 'resolved') return false
        return (Date.now() - new Date(m.slaStartedAt).getTime()) / 60000 > SLA_TARGET_MINUTES
      }
      if (filter === 'resolved') return m.status === 'resolved'
      return true
    })
  }, [conversationMessages, filter, myMembershipId, search, selectedId])

  const selected = selectedThread
    ? threadToMessage(selectedThread, selectedThreadDetail)
    : (selectedMessage ?? null)
  const selectedKind: ConversationKind | null = selectedThread
    ? 'thread'
    : selectedMessage
      ? 'message'
      : null
  // Presence: claim the thread when the agent starts typing so teammates see
  // "در حال پاسخ" live. Once per thread selection; 409 (already claimed by
  // someone else) is informational, not an error.
  const claimAttemptAtRef = useRef(new Map<string, number>())
  const claimOnType = useCallback(
    (threadId: string) => {
      const now = Date.now()
      const previousAttempt = claimAttemptAtRef.current.get(threadId) ?? 0
      if (now - previousAttempt < 4 * 60_000) return
      claimAttemptAtRef.current.set(threadId, now)
      void api.post(`/api/inbox/threads/${threadId}/claim`, {}).then(
        () => queryClient.invalidateQueries({ queryKey: ['inbox-threads'] }),
        () => claimAttemptAtRef.current.set(threadId, now - 3 * 60_000)
      )
    },
    [queryClient]
  )
  useEffect(() => {
    if (!selectedThreadId || !replyText.trim()) return
    const timer = window.setInterval(() => claimOnType(selectedThreadId), 4 * 60_000)
    return () => window.clearInterval(timer)
  }, [claimOnType, replyText, selectedThreadId])

  // Meta 24h DM window — set only for DM threads (public comment replies have
  // no window). Drives the countdown chip and the disabled composer state.
  const replyWindowExpiresAt =
    selectedThread?.messageType === 'dm' ? selectedThread.replyWindowExpiresAt : null
  const replyWindowClosed = Boolean(
    replyWindowExpiresAt && new Date(replyWindowExpiresAt).getTime() < Date.now()
  )
  const lockActive = Boolean(
    selectedThread?.lockedById &&
      selectedThread.lockExpiresAt &&
      new Date(selectedThread.lockExpiresAt).getTime() > Date.now()
  )
  const claimedByMe = Boolean(lockActive && selectedThread?.lockedById === myMembershipId)
  const claimedByOther = Boolean(lockActive && selectedThread?.lockedById !== myMembershipId)
  const composerBlocked = replyWindowClosed || claimedByOther
  const unreadCount =
    (queueCounts?.counts.unread ?? threads.reduce((count, thread) => count + thread.unreadCount, 0)) +
    (queueCounts?.legacyUnread ?? messages.filter((message) => !message.isRead).length)
  const isConversationLoading = isLegacyPending && isThreadsPending
  const isConversationError = isLegacyError && isThreadsError
  const refetchConversations = () => {
    void refetchLegacy()
    void refetchThreads()
  }
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
    mutationFn: ({ id, reply, kind }: { id: string; reply: string; kind: ConversationKind }) =>
      api.post(kind === 'thread' ? `/api/inbox/threads/${id}/reply` : `/api/inbox/${id}/reply`, {
        reply,
      }),
    onSuccess: (_data, vars) => {
      toast.success('پاسخ ارسال شد ✓')
      setReplyText('')
      queryClient.invalidateQueries({ queryKey: ['inbox'] })
      queryClient.invalidateQueries({ queryKey: ['inbox-threads'] })
      queryClient.invalidateQueries({ queryKey: ['inbox-thread', vars.id] })
      queryClient.invalidateQueries({ queryKey: ['inbox-thread-messages', vars.id] })
      queryClient.invalidateQueries({ queryKey: ['inbox-thread-counts'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] })
    },
    onError: (err) => {
      // Surface the server's actionable message (e.g. the Meta 24h-window
      // rejection) instead of a generic failure — the body is JSON {error}.
      let message = 'خطا در ارسال پاسخ'
      try {
        const parsed = JSON.parse((err as Error).message) as { error?: string }
        if (parsed?.error) message = parsed.error
      } catch {
        /* non-JSON body → keep the generic message */
      }
      toast.error(message)
    },
  })

  const assignMutation = useMutation({
    mutationFn: ({
      id,
      assigneeId,
      kind,
    }: {
      id: string
      assigneeId: string | null
      kind: ConversationKind
    }) =>
      api.post(kind === 'thread' ? `/api/inbox/threads/${id}/assign` : `/api/inbox/${id}/assign`, {
        assigneeId,
      }),
    onSuccess: (_data, vars) => {
      toast.success('ارجاع شد')
      queryClient.invalidateQueries({ queryKey: ['inbox'] })
      queryClient.invalidateQueries({ queryKey: ['inbox-threads'] })
      queryClient.invalidateQueries({ queryKey: ['inbox-thread', vars.id] })
    },
    onError: () => toast.error('خطا در ارجاع'),
  })

  const claimMutation = useMutation({
    mutationFn: ({ id }: { id: string }) => api.post(`/api/inbox/threads/${id}/claim`, {}),
    onSuccess: (_data, vars) => {
      toast.success('گفتگو به شما واگذار شد')
      queryClient.invalidateQueries({ queryKey: ['inbox'] })
      queryClient.invalidateQueries({ queryKey: ['inbox-threads'] })
      queryClient.invalidateQueries({ queryKey: ['inbox-thread', vars.id] })
    },
    onError: () => toast.error('خطا در دریافت گفتگو'),
  })

  const priorityMutation = useMutation({
    mutationFn: ({ id, priority }: { id: string; priority: string }) =>
      api.post(`/api/inbox/threads/${id}/priority`, { priority }),
    onSuccess: (_data, vars) => {
      toast.success('اولویت به‌روزرسانی شد')
      queryClient.invalidateQueries({ queryKey: ['inbox-threads'] })
      queryClient.invalidateQueries({ queryKey: ['inbox-thread', vars.id] })
    },
    onError: () => toast.error('خطا در تغییر اولویت'),
  })

  const tagsMutation = useMutation({
    mutationFn: ({ id, tags }: { id: string; tags: string[] }) =>
      api.post(`/api/inbox/threads/${id}/tags`, { tags }),
    onSuccess: (_data, vars) => {
      setTagDraft('')
      toast.success('برچسب‌ها به‌روزرسانی شدند')
      queryClient.invalidateQueries({ queryKey: ['inbox-threads'] })
      queryClient.invalidateQueries({ queryKey: ['inbox-thread', vars.id] })
      queryClient.invalidateQueries({ queryKey: ['inbox-thread-messages', vars.id] })
      queryClient.invalidateQueries({ queryKey: ['inbox-thread-counts'] })
    },
    onError: () => toast.error('خطا در تغییر برچسب‌ها'),
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, status, kind }: { id: string; status: string; kind: ConversationKind }) =>
      api.post(kind === 'thread' ? `/api/inbox/threads/${id}/status` : `/api/inbox/${id}/status`, {
        status,
      }),
    onSuccess: (_data, vars) => {
      toast.success(STATUS_LABEL[vars.status] ? `وضعیت: ${STATUS_LABEL[vars.status]}` : 'به‌روزشد')
      queryClient.invalidateQueries({ queryKey: ['inbox'] })
      queryClient.invalidateQueries({ queryKey: ['inbox-threads'] })
      queryClient.invalidateQueries({ queryKey: ['inbox-thread', vars.id] })
    },
    onError: () => toast.error('خطا در تغییر وضعیت'),
  })

  const readStateMutation = useMutation({
    mutationFn: ({ id, isRead, kind }: { id: string; isRead: boolean; kind: ConversationKind }) =>
      api.post<{ ok: boolean }>(
        kind === 'thread'
          ? `/api/inbox/threads/${id}/${isRead ? 'read' : 'unread'}`
          : `/api/inbox/${id}/${isRead ? 'read' : 'unread'}`,
        {}
      ),
    onMutate: async ({ id, isRead }) => {
      await queryClient.cancelQueries({ queryKey: ['inbox'] })
      await queryClient.cancelQueries({ queryKey: ['inbox-threads'] })
      const previousLegacy = queryClient.getQueriesData<
        InfiniteData<PaginatedResponse<InboxMessage>>
      >({ queryKey: ['inbox'] })
      const previousThreads = queryClient.getQueriesData<
        InfiniteData<PaginatedResponse<InboxThreadSummary>>
      >({ queryKey: ['inbox-threads'] })

      queryClient.setQueriesData<InfiniteData<PaginatedResponse<InboxMessage>>>(
        { queryKey: ['inbox'] },
        (current) =>
          updateInfiniteItems(current, (message) =>
            message.id === id ? { ...message, isRead } : message
          )
      )
      queryClient.setQueriesData<InfiniteData<PaginatedResponse<InboxThreadSummary>>>(
        { queryKey: ['inbox-threads'] },
        (current) =>
          updateInfiniteItems(current, (thread) =>
            thread.id === id
              ? { ...thread, unreadCount: isRead ? 0 : Math.max(thread.unreadCount, 1) }
              : thread
          )
      )

      return { previousLegacy, previousThreads }
    },
    onError: (_err, _vars, context) => {
      context?.previousLegacy.forEach(([key, data]) => queryClient.setQueryData(key, data))
      context?.previousThreads.forEach(([key, data]) => queryClient.setQueryData(key, data))
      toast.error('خطا در تغییر وضعیت خواندن')
    },
    onSettled: (_data, _err, vars) => {
      queryClient.invalidateQueries({ queryKey: ['inbox'] })
      queryClient.invalidateQueries({ queryKey: ['inbox-threads'] })
      queryClient.invalidateQueries({ queryKey: ['inbox-thread-counts'] })
      if (vars) queryClient.invalidateQueries({ queryKey: ['inbox-thread', vars.id] })
    },
  })

  // ── Handlers ───────────────────────────────────────────────────────
  const handleSelectMessage = (id: string) => {
    const kind: ConversationKind = threads.some((thread) => thread.id === id)
      ? 'thread'
      : 'message'
    setSelectedId(id)
    setSelectedKindHint(kind)
    setInboxSelectionUrl(id, kind)
    const message = conversationMessages.find((m) => m.id === id)
    if (message && !message.isRead) {
      readStateMutation.mutate({
        id,
        isRead: true,
        kind,
      })
    }
  }

  const clearSelection = () => {
    setSelectedId(null)
    setSelectedKindHint(null)
    setReplyText('')
    setInboxSelectionUrl(null, null)
  }

  const selectThreadById = (id: string) => {
    setSelectedId(id)
    setSelectedKindHint('thread')
    setInboxSelectionUrl(id, 'thread')
  }

  const addTag = () => {
    if (!selectedThread) return
    const tag = tagDraft.trim()
    if (!tag || selectedThread.tags.includes(tag)) return
    tagsMutation.mutate({ id: selectedThread.id, tags: [...selectedThread.tags, tag].slice(0, 8) })
  }

  const removeTag = (tag: string) => {
    if (!selectedThread) return
    tagsMutation.mutate({
      id: selectedThread.id,
      tags: selectedThread.tags.filter((current) => current !== tag),
    })
  }

  // ── Keyboard shortcuts (agent speed) ────────────────────────────────
  // j/k or ↓/↑ move through the list, r focuses the composer, e resolves,
  // / focuses search. Suppressed while typing in any field. The keydown
  // listener binds once; per-render state and handlers are read through a
  // ref synced in an every-render effect (refs must not be written during
  // render — react-compiler rule).
  const searchInputRef = useRef<HTMLInputElement>(null)
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const shortcutStateRef = useRef<{
    list: InboxMessage[]
    current: string | null
    select: (id: string) => void
    resolve: (id: string) => void
  }>({ list: [], current: null, select: () => {}, resolve: () => {} })
  useEffect(() => {
    shortcutStateRef.current = {
      list: filtered,
      current: selectedId,
      select: handleSelectMessage,
      resolve: (id) => {
        const msg = filtered.find((m) => m.id === id)
        if (msg && msg.status !== 'resolved') {
          statusMutation.mutate({
            id,
            status: 'resolved',
            kind: threads.some((thread) => thread.id === id) ? 'thread' : 'message',
          })
        }
      },
    }
  })
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const typing =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return

      const { list, current, select, resolve } = shortcutStateRef.current
      const index = list.findIndex((m) => m.id === current)

      if (e.key === 'j' || e.key === 'ArrowDown') {
        const next = list[Math.min(index + 1, list.length - 1)]
        if (next) select(next.id)
        e.preventDefault()
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        const prev = list[Math.max(index - 1, 0)]
        if (prev) select(prev.id)
        e.preventDefault()
      } else if (e.key === 'r' && current) {
        composerRef.current?.focus()
        e.preventDefault()
      } else if (e.key === 'e' && current) {
        resolve(current)
        e.preventDefault()
      } else if (e.key === '/') {
        searchInputRef.current?.focus()
        e.preventDefault()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const handleReply = () => {
    if (composerBlocked) {
      toast.error(
        claimedByOther
          ? `${selectedThread?.lockedByName ?? 'هم‌تیمی شما'} در حال پاسخ به این گفتگو است`
          : 'پنجره پاسخ این گفتگو بسته شده است'
      )
      return
    }
    if (!replyText.trim()) {
      toast.error('متن پاسخ خالی است.')
      return
    }
    if (!selected) return
    if (!selectedKind) return
    replyMutation.mutate({ id: selected.id, reply: replyText, kind: selectedKind })
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
              {toPersianDigits(String(unreadCount))} ناخوانده
            </span>
          )
        }
      >
        صندوق ورودی یکپارچه
      </SectionTitle>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: List */}
        <div
          className={cn(
            'lg:col-span-4 n-card p-0 overflow-hidden flex-col lg:h-[calc(100dvh-10rem)] lg:max-h-[52rem] lg:min-h-[32rem]',
            selected ? 'hidden lg:flex' : 'flex'
          )}
        >
          <div className="px-3 pt-3 pb-0 border-b border-border overflow-x-auto thin-scrollbar">
            <AnimatedTabs
              value={filter}
              onValueChange={(v) => setFilter(v as typeof filter)}
              tabs={[
                { value: 'all', label: 'همه', count: queueCounts?.counts.all },
                { value: 'unread', label: 'ناخوانده', count: unreadCount },
                { value: 'mine', label: 'من', count: queueCounts?.counts.mine },
                { value: 'unassigned', label: 'بدون ارجاع', count: queueCounts?.counts.unassigned },
                { value: 'urgent', label: 'فوری', count: queueCounts?.counts.urgent },
                { value: 'overdue', label: 'تأخیر SLA' },
                { value: 'resolved', label: 'حل‌شده', count: queueCounts?.counts.resolved },
                { value: 'comment', label: 'کامنت', count: queueCounts?.counts.comment },
                { value: 'dm', label: 'پیام مستقیم', count: queueCounts?.counts.dm },
              ]}
            />
          </div>

          {/* Full-text search — server-side over titles + message bodies */}
          <div className="px-3 py-2 border-b border-border">
            <div className="relative">
              <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 size-3.5 text-ink-tertiary" />
              <input
                ref={searchInputRef}
                dir="rtl"
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setSearchInput('')
                    ;(e.target as HTMLInputElement).blur()
                  }
                }}
                placeholder="جستجو در گفتگوها… ( / )"
                aria-label="جستجو در گفتگوها"
                className="n-control n-focus-ring w-full h-9 ps-8 pe-3 text-sm text-ink-primary placeholder:text-ink-tertiary"
              />
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto thin-scrollbar">
            <LoadingState
              animated={false}
              isLoading={isConversationLoading}
              isError={isConversationError}
              onRetry={refetchConversations}
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
                <>
                  {filtered.map((m) => (
                    <MessageListItem
                      key={m.id}
                      message={m}
                      active={m.id === selectedId}
                      onClick={() => handleSelectMessage(m.id)}
                      currentMembershipId={myMembershipId}
                    />
                  ))}
                  {(hasNextThreads || hasNextLegacy) && (
                    <div className="p-3">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        disabled={isFetchingNextThreads || isFetchingNextLegacy}
                        onClick={() => {
                          if (hasNextThreads) void fetchNextThreads()
                          if (hasNextLegacy) void fetchNextLegacy()
                        }}
                      >
                        {isFetchingNextThreads || isFetchingNextLegacy ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <ChevronLeft className="size-3.5 -rotate-90" />
                        )}
                        گفتگوهای بیشتر
                      </Button>
                    </div>
                  )}
                </>
              )}
            </LoadingState>
          </div>
        </div>

        {/* Center: Thread */}
        <div
          className={cn(
            'lg:col-span-8 xl:col-span-6 n-card n-gradient-border p-0 overflow-hidden flex-col min-h-0 lg:h-[calc(100dvh-10rem)] lg:max-h-[52rem] lg:min-h-[32rem]',
            selected ? 'flex' : 'hidden lg:flex'
          )}
        >
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
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0 lg:hidden"
                    onClick={clearSelection}
                    aria-label="بازگشت به فهرست گفتگوها"
                    title="بازگشت به فهرست گفتگوها"
                  >
                    <ChevronRight className="size-4" />
                  </Button>
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
                  {selectedKind === 'thread' && selected.priority && (
                    <span
                      className={cn(
                        'text-2xs font-semibold px-2 py-0.5 rounded-md border',
                        PRIORITY_COLOR[selected.priority] ?? PRIORITY_COLOR.normal
                      )}
                    >
                      {PRIORITY_LABEL[selected.priority] ?? selected.priority}
                    </span>
                  )}
                  {selectedKind === 'thread' && selected.lockedByName && (
                    <span className="text-2xs font-semibold px-2 py-0.5 rounded-md border text-accent bg-accent/10 border-accent/20">
                      {claimedByMe ? 'در اختیار شما' : `${selected.lockedByName} در حال پاسخ`}
                    </span>
                  )}
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
                  {selected.slaStartedAt && !selected.firstResponseAt && selected.status !== 'resolved' && (
                    <SlaTimer slaStartedAt={selected.slaStartedAt} />
                  )}
                  <button
                    onClick={() =>
                      readStateMutation.mutate({
                        id: selected.id,
                        isRead: !selected.isRead,
                        kind: selectedKind ?? 'message',
                      })
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
                  {selectedKind === 'thread' && !lockActive && (
                    <button
                      onClick={() => claimMutation.mutate({ id: selected.id })}
                      disabled={claimMutation.isPending}
                      className="n-focus-ring inline-flex items-center gap-1 text-2xs font-semibold px-2 py-0.5 rounded-md border text-accent bg-accent/10 border-accent/20 hover:bg-accent/20 transition-colors"
                    >
                      <UserCheck className="size-3" />
                      دریافت گفتگو
                    </button>
                  )}
                  {selected.status !== 'resolved' && (
                    <button
                      onClick={() =>
                        statusMutation.mutate({
                          id: selected.id,
                          status: 'resolved',
                          kind: selectedKind ?? 'message',
                        })
                      }
                      disabled={statusMutation.isPending}
                      className="n-focus-ring text-2xs font-semibold px-2 py-0.5 rounded-md border text-success bg-success-soft border-success/20 hover:bg-success/20 transition-colors"
                    >
                      حل شد ✓
                    </button>
                  )}
                  {selected.status === 'resolved' && (
                    <button
                      onClick={() =>
                        statusMutation.mutate({
                          id: selected.id,
                          status: 'new',
                          kind: selectedKind ?? 'message',
                        })
                      }
                      disabled={statusMutation.isPending}
                      className="n-focus-ring text-2xs font-semibold px-2 py-0.5 rounded-md border text-ink-secondary bg-surface border-border hover:bg-surface-hover transition-colors"
                    >
                      بازگشایی
                    </button>
                  )}
                  {selected.status === 'new' && (
                    <button
                      onClick={() =>
                        statusMutation.mutate({
                          id: selected.id,
                          status: 'in_progress',
                          kind: selectedKind ?? 'message',
                        })
                      }
                      disabled={statusMutation.isPending}
                      className="n-focus-ring text-2xs font-semibold px-2 py-0.5 rounded-md border text-accent bg-accent/10 border-accent/20 hover:bg-accent/20 transition-colors"
                    >
                      شروع بررسی
                    </button>
                  )}
                </div>

                {/* Assign dropdown */}
                {((members?.length ?? 0) > 0 || selectedKind === 'thread') && (
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    {(members?.length ?? 0) > 0 && (
                      <>
                        <span className="text-2xs text-ink-tertiary">ارجاع به:</span>
                        <Select
                          value={selected.assigneeId ?? 'none'}
                          onValueChange={(v) =>
                            assignMutation.mutate({
                              id: selected.id,
                              assigneeId: v === 'none' ? null : v,
                              kind: selectedKind ?? 'message',
                            })
                          }
                        >
                          <SelectTrigger className="h-7 w-full sm:w-40 text-xs">
                            <SelectValue placeholder="بدون ارجاع" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">بدون ارجاع</SelectItem>
                            {members?.map((m) => (
                              <SelectItem key={m.id} value={m.id}>
                                {m.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </>
                    )}
                    {selectedKind === 'thread' && (
                      <>
                        <span className="text-2xs text-ink-tertiary">اولویت:</span>
                        <Select
                          value={selected.priority ?? 'normal'}
                          onValueChange={(priority) =>
                            priorityMutation.mutate({ id: selected.id, priority })
                          }
                        >
                          <SelectTrigger className="h-7 w-full sm:w-32 text-xs">
                            <SelectValue placeholder="اولویت" />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(PRIORITY_LABEL).map(([value, label]) => (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </>
                    )}
                  </div>
                )}
                {selectedKind === 'thread' && selectedThread && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 text-2xs text-ink-tertiary">
                      <Tag className="size-3" />
                      برچسب‌ها:
                    </span>
                    {selectedThread.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex min-h-7 items-center gap-1 rounded-md border border-border bg-surface px-2 text-2xs font-semibold text-ink-secondary"
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() => removeTag(tag)}
                          disabled={tagsMutation.isPending}
                          className="n-focus-ring rounded text-ink-tertiary hover:text-danger"
                          aria-label={`حذف برچسب ${tag}`}
                          title={`حذف برچسب ${tag}`}
                        >
                          <X className="size-3" />
                        </button>
                      </span>
                    ))}
                    {selectedThread.tags.length < 8 && (
                      <div className="flex items-center gap-1">
                        <Input
                          value={tagDraft}
                          onChange={(event) => setTagDraft(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault()
                              addTag()
                            }
                          }}
                          className="h-7 w-28 text-xs"
                          placeholder="برچسب جدید"
                          aria-label="برچسب جدید"
                          maxLength={24}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="size-7"
                          onClick={addTag}
                          disabled={!tagDraft.trim() || tagsMutation.isPending}
                          aria-label="افزودن برچسب"
                          title="افزودن برچسب"
                        >
                          {tagsMutation.isPending ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            <Plus className="size-3" />
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
                {/* Customer context — sender history across the workspace */}
                {selectedKind === 'thread' && threadContext && (
                  <div className="mt-2 flex items-center gap-2 flex-wrap text-2xs text-ink-tertiary">
                    <span className="inline-flex items-center gap-1">
                      <UserCheck className="size-3" />
                      {threadContext.customer.firstSeenAt
                        ? `مشتری از ${relativeTime(new Date(threadContext.customer.firstSeenAt))}`
                        : 'مشتری جدید'}
                    </span>
                    <span>•</span>
                    <span className="num-tabular">
                      {toPersianDigits(String(threadContext.customer.threadCount))} گفتگو
                    </span>
                    {threadContext.priorThreads.slice(0, 3).map((prior) => (
                      <button
                        key={prior.id}
                        onClick={() => selectThreadById(prior.id)}
                        className="n-focus-ring inline-flex max-w-44 items-center gap-1 truncate rounded-full border border-border bg-surface px-2 py-0.5 font-semibold text-ink-secondary hover:bg-surface-hover"
                        title={prior.preview}
                      >
                        {MESSAGE_TYPE_LABEL[prior.messageType] ?? prior.messageType}:{' '}
                        <span className="truncate">{prior.preview || '—'}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Thread body */}
              <div className="flex-1 overflow-y-auto thin-scrollbar p-4 space-y-3">
                {selectedThread ? (
                  isThreadDetailLoading ? (
                    <div className="flex h-full min-h-48 items-center justify-center text-sm text-ink-tertiary">
                      <Loader2 className="me-2 size-4 animate-spin" />
                      در حال بارگذاری گفتگو
                    </div>
                  ) : timelineMessages.length ? (
                    <>
                      {hasOlderMessages && (
                        <div className="flex justify-center pb-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => void fetchOlderMessages()}
                            disabled={isFetchingOlderMessages}
                          >
                            {isFetchingOlderMessages ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <Clock className="size-3.5" />
                            )}
                            پیام‌های قدیمی‌تر
                          </Button>
                        </div>
                      )}
                      {timelineMessages.map((message) => {
                        const outbound = message.direction === 'outbound'
                        return (
                          <div
                            key={message.id}
                            className={cn('flex', outbound ? 'justify-end' : 'justify-start')}
                          >
                            <div
                              className={cn(
                                'max-w-[82%] rounded-2xl px-4 py-2.5',
                                outbound
                                  ? 'rounded-tl-sm bg-accent-soft border border-accent/20'
                                  : 'rounded-tr-sm bg-surface-hover'
                              )}
                            >
                              <div className="mb-1 flex items-center gap-2 text-2xs text-ink-tertiary">
                                <span className="font-semibold">
                                  {outbound ? 'شما' : message.senderName}
                                </span>
                                <span>{relativeTime(new Date(message.createdAt))}</span>
                              </div>
                              <p className="text-sm text-ink-primary whitespace-pre-wrap" dir="auto">
                                {message.body}
                              </p>
                              <AttachmentChips attachments={message.attachments} />
                            </div>
                          </div>
                        )
                      })}
                    </>
                  ) : (
                    <div className="flex justify-start">
                      <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-surface-hover px-4 py-2.5">
                        <p className="text-sm text-ink-primary whitespace-pre-wrap" dir="auto">
                          {selected.message}
                        </p>
                      </div>
                    </div>
                  )
                ) : (
                  <>
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
                  </>
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
                {replyWindowExpiresAt && (
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <ReplyWindowChip expiresAt={replyWindowExpiresAt} />
                    {replyWindowClosed && (
                      <span className="text-2xs text-ink-tertiary">
                        طبق سیاست متا، پاسخ دایرکت فقط تا ۲۴ ساعت پس از آخرین پیام مشتری ممکن است
                      </span>
                    )}
                  </div>
                )}
                {claimedByOther && (
                  <div className="mb-2 flex items-center gap-2 rounded-md border border-warning/30 bg-warning-soft px-3 py-2 text-xs text-warning">
                    <UserCheck className="size-4 shrink-0" />
                    <span>
                      {selectedThread?.lockedByName ?? 'هم‌تیمی شما'} در حال پاسخ به این گفتگو است.
                      برای جلوگیری از پاسخ تکراری، ارسال موقتاً غیرفعال شده است.
                    </span>
                  </div>
                )}
                {/* Quick replies — one tap inserts the rendered template */}
                {!composerBlocked && !replyText && (savedReplies ?? []).length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {(savedReplies ?? []).slice(0, 3).map((r) => (
                      <button
                        key={r.id}
                        onClick={() => insertSnippet(r)}
                        className="n-focus-ring inline-flex max-w-56 items-center gap-1 truncate rounded-full border border-border bg-surface px-2.5 py-1 text-2xs font-semibold text-ink-secondary hover:bg-surface-hover min-h-[32px]"
                        title={r.body}
                      >
                        <BookOpen className="size-3 shrink-0" />
                        <span className="truncate">{r.title}</span>
                      </button>
                    ))}
                  </div>
                )}
                <Textarea
                  ref={composerRef}
                  dir="rtl"
                  rows={3}
                  placeholder={
                    claimedByOther
                      ? `${selectedThread?.lockedByName ?? 'هم‌تیمی شما'} در حال پاسخ است`
                      : replyWindowClosed
                      ? 'پنجره پاسخ بسته شده است'
                      : 'پاسخ خود را بنویسید… (/ برای قالب‌های ذخیره‌شده)'
                  }
                  disabled={composerBlocked}
                  value={replyText}
                  onChange={(e) => {
                    setReplyText(e.target.value)
                    if (e.target.value.trim() && selectedThread) claimOnType(selectedThread.id)
                    if (e.target.value.startsWith('/')) setShowSnippets(true)
                    else setShowSnippets(false)
                  }}
                  className="resize-none bg-background mb-2"
                />
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
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
                  <div className="flex flex-wrap items-center gap-2">
                    {savedReplies && savedReplies.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="min-h-[44px] sm:min-h-0"
                        onClick={() => setShowSnippets((v) => !v)}
                        disabled={composerBlocked}
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
                      disabled={isGeneratingReply || composerBlocked}
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
                      disabled={replyMutation.isPending || !replyText.trim() || composerBlocked}
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
        <div className="hidden xl:block xl:col-span-2 n-card p-4 h-fit">
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

/**
 * Meta 24h DM messaging-window countdown. Green/neutral while open, warning
 * under 2 hours, danger when closed. Re-renders every 30s so the countdown
 * stays honest without a per-second timer.
 */
function ReplyWindowChip({ expiresAt }: { expiresAt: string | Date }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])

  const remainingMs = new Date(expiresAt).getTime() - now
  if (Number.isNaN(remainingMs)) return null

  if (remainingMs <= 0) {
    return (
      <span className="inline-flex items-center gap-1 text-2xs font-semibold px-2 py-0.5 rounded-full border text-danger border-danger/30 bg-danger-tint">
        <Clock className="size-3" />
        پنجره پاسخ بسته شد
      </span>
    )
  }

  const totalMin = Math.floor(remainingMs / 60_000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  const label = toPersianDigits(`${h}:${String(m).padStart(2, '0')}`)
  const urgent = remainingMs < 2 * 60 * 60 * 1000

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-2xs font-semibold px-2 py-0.5 rounded-full border num-tabular',
        urgent
          ? 'text-warning border-warning/30 bg-warning-tint'
          : 'text-ink-tertiary border-border bg-surface'
      )}
    >
      <Clock className="size-3" />
      پنجره پاسخ: {label}
    </span>
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

function AttachmentChips({ attachments = [] }: { attachments?: InboxThreadAttachment[] }) {
  if (attachments.length === 0) return null

  // Visual attachments (images with a fetchable URL) render inline like
  // native Instagram; everything else stays a compact labeled chip.
  const images = attachments.filter((a) => a.type === 'image' && a.url)
  const rest = attachments.filter((a) => !(a.type === 'image' && a.url))

  return (
    <div className="mt-2 space-y-1.5">
      {images.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {images.map((attachment, index) => (
            <a
              key={`img:${attachment.providerId ?? attachment.url ?? index}`}
              href={attachment.url ?? undefined}
              target="_blank"
              rel="noreferrer"
              className="n-focus-ring block overflow-hidden rounded-lg border border-border"
              aria-label={attachment.title || 'پیوست تصویری'}
            >
              <img
                src={attachment.url ?? ''}
                alt={attachment.title || 'پیوست تصویری'}
                loading="lazy"
                className="size-32 max-w-full object-cover"
              />
            </a>
          ))}
        </div>
      )}
      {rest.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {rest.map((attachment, index) => {
            const label = attachment.title || attachment.type || 'Attachment'
            const key = `${attachment.type}:${attachment.providerId ?? attachment.url ?? index}`
            const className =
              'inline-flex max-w-full items-center gap-1.5 rounded border border-border bg-background/80 px-2 py-1 text-2xs font-semibold text-ink-secondary'
            const content = (
              <>
                <Paperclip className="size-3 shrink-0 text-ink-tertiary" />
                <span className="max-w-36 truncate">{label}</span>
              </>
            )

            return attachment.url ? (
              <a key={key} href={attachment.url} target="_blank" rel="noreferrer" className={className}>
                {content}
              </a>
            ) : (
              <span key={key} className={className}>
                {content}
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}

function MessageListItem({
  message,
  active,
  onClick,
  currentMembershipId,
}: {
  message: InboxMessage
  active: boolean
  onClick: () => void
  currentMembershipId?: string | null
}) {
  const TypeIcon = MESSAGE_TYPE_ICON[message.messageType] ?? MessageSquare
  const overdue = useSlaOverdue(message.firstResponseAt ? null : message.slaStartedAt)
  // Presence: a teammate holds an unexpired claim lock on this thread.
  const lockedByTeammate = Boolean(
    message.lockedByName &&
      message.lockExpiresAt &&
      new Date(message.lockExpiresAt).getTime() > Date.now() &&
      message.lockedById !== currentMembershipId
  )
  return (
    <button
      onClick={onClick}
      aria-current={active ? 'true' : undefined}
      aria-label={`${message.senderName}، ${message.isRead ? 'خوانده‌شده' : 'ناخوانده'}، ${STATUS_LABEL[message.status] ?? message.status}`}
      className={cn(
        'n-focus-ring w-full text-start flex items-start gap-3 p-3 border-b border-s-4 border-border border-s-transparent transition-colors',
        active
          ? 'bg-accent-tint border-s-accent shadow-[inset_0_0_0_1px_var(--color-accent)]'
          : message.isRead
            ? 'bg-background hover:bg-surface-subtle'
            : 'bg-surface-subtle border-s-info hover:bg-surface-hover',
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
          {message.attachments && message.attachments.length > 0 && (
            <span className="inline-flex items-center gap-1 text-2xs text-ink-tertiary shrink-0">
              <Paperclip className="size-3" />
              {message.attachments.length}
            </span>
          )}
          {lockedByTeammate && (
            <span className="inline-flex items-center gap-1 text-2xs font-semibold text-accent shrink-0">
              <UserCheck className="size-3" />
              {message.lockedByName} در حال پاسخ
            </span>
          )}
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
            {message.priority && message.priority !== 'normal' && (
              <span
                className={cn(
                  'text-2xs font-semibold px-1.5 py-0.5 rounded border shrink-0',
                  PRIORITY_COLOR[message.priority] ?? PRIORITY_COLOR.normal
                )}
              >
                {PRIORITY_LABEL[message.priority] ?? message.priority}
              </span>
            )}
            {message.tags?.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="text-2xs font-semibold px-1.5 py-0.5 rounded border text-ink-secondary bg-surface border-border shrink-0"
              >
                {tag}
              </span>
            ))}
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
