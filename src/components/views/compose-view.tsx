'use client'

import { useState, useEffect, useCallback, useRef, useMemo, useTransition } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { useShouldAnimate, ease, duration } from '@/lib/motion'
import { toast } from 'sonner'
import { AIAssistantSheet } from '@/components/ai/ai-assistant-sheet'
import { NashrinoEditor } from '@/components/editor/nashrino-editor'
import { PlatformPreviewTabs } from '@/components/editor/platform-preview-tabs'
import { IgGridPreview } from '@/components/editor/ig-grid-preview'
import { MediaUploader } from '@/components/editor/media-uploader'
import {
  PenLine,
  Image as ImageIcon,
  Send,
  CalendarClock,
  Check,
  Hash,
  FileText,
  Layers,
  Sparkles,
  Eye,
  AlertTriangle,
  Zap,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'

import { api } from '@/lib/api'
import { CommentDmRulesPanel } from '@/components/automation/comment-dm-rules'
import { detectCommentKeyword } from '@/modules/automation/comment-dm-shared'
import { toPersianDigits, formatJalali, formatJalaliTime, getUpcomingHolidays } from '@/lib/jalali'
import { announce } from '@/lib/aria-live'
import {
  SectionTitle,
  PlatformIcon,
  ProviderSupportBadge,
} from '@/components/dashboard/shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { JalaliDatePicker } from '@/components/ui/jalali-picker'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import {
  PROVIDER_CAPABILITIES,
  getCapabilities,
  validateAgainstCapabilities,
} from '@/lib/provider-capabilities'

interface Campaign {
  id: string
  name: string
}
interface MediaItem {
  id: string
  name: string
  thumbnail: string
  fileType: string
  fileSize: number
}
interface Platform {
  id: string
  name: string
  type: string
  state: string
  stateColor: string
  username: string
}

/** Shape of an item in the ["content"] query cache. Kept in sync with content-view. */
interface ContentItem {
  id: string
  title: string
  body: string | null
  hashtags: string | null
  status: string
  authorName: string | null
  thumbnail: string | null
  campaign: string
  platforms: string[]
  scheduledAt: string | null
  publishedAt: string | null
  updatedAt: string
}

interface PublishPayload {
  title: string
  caption: string
  hashtags: string
  note: string
  campaignId?: string
  campaignName: string
  mediaIds: string[]
  // BUG-08: explicit channel UUIDs instead of platform type strings
  channelIds: string[]
  platformCaptions: Record<string, string>
  scheduleMode: 'now' | 'schedule' | 'queue'
  // BUG-01: single ISO timestamp (no more split scheduleDate + scheduleTime)
  scheduledAt?: string | null
  thumbnail: string | null
  mode?: 'publish' | 'review' | 'draft'
}

// Issue #117: limits now come from the provider capability registry (single source of truth)
const IG_LIMIT = PROVIDER_CAPABILITIES.instagram.maxCaptionLength

export function ComposeView() {
  const shouldAnimate = useShouldAnimate()
  const [title, setTitle] = useState('')
  const [caption, setCaption] = useState('')
  const [hashtags, setHashtags] = useState('')
  const [note, setNote] = useState('')
  const [campaignId, setCampaignId] = useState<string>('')
  const [selectedMedia, setSelectedMedia] = useState<MediaItem[]>([])
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([])
  const [platformCaptions, setPlatformCaptions] = useState<Record<string, string>>({})
  const [scheduleMode, setScheduleMode] = useState<'now' | 'schedule' | 'queue'>('now')
  const [scheduledAt, setScheduledAt] = useState<Date | null>(null)
  const [showDmSection, setShowDmSection] = useState(false)
  // After publish, holds the first returned publicationId so the DM panel can scope rules to it
  const [publishedPublicationId, setPublishedPublicationId] = useState<string | null>(null)

  // Issue #127: useTransition for non-urgent state updates (caption/hashtags/note
  // typing) so the main thread stays responsive → INP <200ms. Urgent updates
  // (title, platform selection) stay synchronous for immediate feedback.
  const [, startTransition] = useTransition()

  // MISS-04: debounced autosave state
  type SaveState = 'idle' | 'saving' | 'saved' | 'error' | 'conflict'
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Issue #152: draft versioning & conflict resolution state
  const draftVersion = useRef<number | null>(null)
  const [showConflictModal, setShowConflictModal] = useState(false)
  const [pendingLocalDraft, setPendingLocalDraft] = useState<Record<string, unknown> | null>(null)
  const [pendingServerDraft, setPendingServerDraft] = useState<Record<string, unknown> | null>(null)

  const applyDraft = useCallback((draft: Record<string, unknown>) => {
    const c = draft.content as Record<string, unknown> | undefined
    if (c?.title) setTitle(c.title as string)
    if (c?.caption) setCaption(c.caption as string)
    if (c?.hashtags) setHashtags(c.hashtags as string)
    if (c?.note) setNote(c.note as string)
    if (c?.campaignId) setCampaignId(c.campaignId as string)
    if (c?.scheduleMode) setScheduleMode(c.scheduleMode as 'now' | 'schedule' | 'queue')
    if ((draft.channelIds as string[] | undefined)?.length) setSelectedPlatforms(draft.channelIds as string[])
    if (draft.scheduledAt) {
      const d = new Date(draft.scheduledAt as string)
      if (!isNaN(d.getTime())) setScheduledAt(d)
    }
    if (typeof draft.version === 'number') {
      draftVersion.current = draft.version
    }
  }, [])

  const handleSelectDraft = (type: 'local' | 'server') => {
    const draft = type === 'local' ? pendingLocalDraft : pendingServerDraft
    if (draft) {
      applyDraft(draft)
    }
    setShowConflictModal(false)
    if (type === 'server') {
      localStorage.removeItem('nashrino_unsaved_draft')
    }
  }

  // AI sheet state
  const [aiSheetOpen, setAiSheetOpen] = useState(false)

  // ⌘J shortcut to open AI sheet
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
        e.preventDefault()
        setAiSheetOpen(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Issue #152: restore saved draft on composer entry with local storage conflict detection
  const draftRestored = useRef(false)
  useEffect(() => {
    if (draftRestored.current) return
    draftRestored.current = true

    // 1. Read local storage draft
    type DraftData = { content?: { title?: string; caption?: string }; channelIds?: string[] }
    let localDraft: DraftData | null = null
    try {
      const rawLocal = localStorage.getItem('nashrino_unsaved_draft')
      if (rawLocal) {
        localDraft = JSON.parse(rawLocal)
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Failed to parse local draft', e)
    }

    // 2. Fetch server draft
    fetch('/api/compose-draft')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const serverDraftRaw = data?.draft
        const serverDraft: DraftData | null = typeof serverDraftRaw === 'string' ? JSON.parse(serverDraftRaw) : serverDraftRaw

        const hasServer = serverDraft && (serverDraft.content?.title || serverDraft.content?.caption || serverDraft.channelIds?.length)
        const hasLocal = localDraft && (localDraft.content?.title || localDraft.content?.caption || localDraft.channelIds?.length)

        if (hasServer && hasLocal && localDraft) {
          // Check for meaningful differences to prompt a conflict resolution
          const titleDiff = (serverDraft.content?.title || '') !== (localDraft.content?.title || '')
          const captionDiff = (serverDraft.content?.caption || '') !== (localDraft.content?.caption || '')
          const platformsDiff = JSON.stringify(serverDraft.channelIds || []) !== JSON.stringify(localDraft.channelIds || [])

          if (titleDiff || captionDiff || platformsDiff) {
            setPendingLocalDraft(localDraft)
            setPendingServerDraft(serverDraft)
            setShowConflictModal(true)
            return
          }
        }

        if (hasServer) {
          applyDraft(serverDraft)
        } else if (hasLocal && localDraft) {
          applyDraft(localDraft)
        }

        if (hasServer || hasLocal) {
          setSaveState('saved')
          setTimeout(() => setSaveState('idle'), 3000)
        }
      })
      .catch(() => {
        if (localDraft) {
          applyDraft(localDraft)
          setSaveState('saved')
          setTimeout(() => setSaveState('idle'), 3000)
        }
      })
  }, [applyDraft])

  // Save unsaved changes to localStorage on any edit
  useEffect(() => {
    if (!title && !caption && selectedPlatforms.length === 0) {
      localStorage.removeItem('nashrino_unsaved_draft')
      return
    }

    localStorage.setItem(
      'nashrino_unsaved_draft',
      JSON.stringify({
        content: { title, caption, hashtags, note, campaignId, scheduleMode },
        channelIds: selectedPlatforms,
        scheduledAt: scheduledAt?.toISOString() ?? null,
        version: draftVersion.current,
        updatedAt: new Date().toISOString(),
      })
    )
  }, [title, caption, hashtags, note, campaignId, scheduleMode, selectedPlatforms, scheduledAt])

  // MISS-04: debounce autosave — fires 3s after last keystroke if form has content
  useEffect(() => {
    if (!title && !caption && selectedPlatforms.length === 0) return
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    autosaveTimer.current = setTimeout(async () => {
      setSaveState('saving')
      try {
        const res = await fetch('/api/compose-draft', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: { title, caption, hashtags, note, campaignId, scheduleMode },
            channelIds: selectedPlatforms,
            scheduledAt: scheduleMode === 'schedule' ? (scheduledAt?.toISOString() ?? null) : null,
            version: draftVersion.current,
          }),
        })

        if (res.status === 409) {
          setSaveState('conflict')
          toast.error('پیش‌نویس توسط پنجره دیگری ویرایش شده است. لطفا صفحه را بازنشانی کنید.')
          return
        }

        if (!res.ok) {
          setSaveState('error')
          return
        }

        const resJson = await res.json()
        if (resJson.version) {
          draftVersion.current = resJson.version
        }

        setSaveState('saved')
        setTimeout(() => setSaveState('idle'), 3000)
      } catch {
        setSaveState('error')
      }
    }, 3000)
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    }
  }, [title, caption, hashtags, note, campaignId, scheduleMode, scheduledAt, selectedPlatforms])

  const { data: campaigns } = useQuery<Campaign[]>({
    queryKey: ['campaigns'],
    queryFn: () => api.getPaginated<Campaign>('/api/campaigns'),
  })
  const { data: media } = useQuery<MediaItem[]>({
    queryKey: ['media'],
    queryFn: () => api.getPaginated<MediaItem>('/api/media'),
  })
  const { data: platforms } = useQuery<Platform[]>({
    queryKey: ['platforms'],
    queryFn: () => api.getPaginated<Platform>('/api/platforms'),
  })

  // Issue #213: workspace brand kit — we only need bannedWords here for the
  // pre-publish check. The full workspace object is fetched once and cached
  // under the ['workspace'] query key used by the settings view too.
  const { data: workspace } = useQuery<{ bannedWords?: string | null }>({
    queryKey: ['workspace'],
    queryFn: () => api.get<{ bannedWords?: string | null }>('/api/workspace'),
    staleTime: 60_000,
  })

  const toggleMedia = (m: MediaItem) => {
    setSelectedMedia((cur) =>
      cur.some((x) => x.id === m.id) ? cur.filter((x) => x.id !== m.id) : [...cur, m]
    )
  }

  // BUG-08: toggle by channel ID, not platform type
  const togglePlatform = (id: string) => {
    setSelectedPlatforms((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))
  }

  // Derive types from selected IDs for preview components that expect type strings
  const selectedPlatformTypes = [
    ...new Set(
      (platforms ?? []).filter((p) => selectedPlatforms.includes(p.id)).map((p) => p.type)
    ),
  ]

  const queryClient = useQueryClient()

  // Issue #117: capability-based validation — derived from the provider registry.
  // Computes violations per selected platform so the UI can warn BEFORE submit.
  const capabilityViolations = useMemo(() => {
    const selected = (platforms ?? []).filter((p) => selectedPlatforms.includes(p.id))
    const all: { platform: string; platformName: string; issues: ReturnType<typeof validateAgainstCapabilities> }[] = []
    for (const p of selected) {
      const issues = validateAgainstCapabilities(p.type, {
        body: caption,
        hashtags,
        mediaCount: selectedMedia.length,
      })
      if (issues.length > 0) {
        all.push({ platform: p.type, platformName: p.name, issues })
      }
    }
    return all
  }, [platforms, selectedPlatforms, caption, hashtags, selectedMedia])

  // Whether any selected platform requires media (e.g. Instagram) — drives UI hints
  const anyRequiresMedia = useMemo(
    () =>
      (platforms ?? [])
        .filter((p) => selectedPlatforms.includes(p.id))
        .some((p) => getCapabilities(p.type).requiresMedia),
    [platforms, selectedPlatforms]
  )

  // The most restrictive caption limit across selected platforms (for the live counter)
  const activeCaptionLimit = useMemo(() => {
    const selected = (platforms ?? []).filter((p) => selectedPlatforms.includes(p.id))
    if (selected.length === 0) return IG_LIMIT
    const isMediaPost = selectedMedia.length > 0
    return Math.min(
      ...selected.map((p) => {
        const cap = getCapabilities(p.type)
        return isMediaPost ? cap.maxCaptionLength : cap.maxTextLength
      })
    )
  }, [platforms, selectedPlatforms, selectedMedia])

  const hasCapabilityViolations = capabilityViolations.length > 0

  const detectedKeyword = useMemo(() => detectCommentKeyword(caption), [caption])
  const hasIgSelected = (platforms ?? []).some((p) => selectedPlatforms.includes(p.id) && p.type === 'instagram')
  const selectedIgPlatformId = (platforms ?? []).find(
    (p) => selectedPlatforms.includes(p.id) && p.type === 'instagram'
  )?.id

  // Issue #213: banned-words detection — split the workspace's comma-separated
  // list (Persian or ASCII comma), trim, drop empties, then find any that
  // appear in the current caption. The result drives (1) a live inline warning
  // under the editor and (2) a confirmation dialog before publish.
  const bannedWordsList = useMemo(() => {
    const raw = (workspace?.bannedWords ?? '').trim()
    if (!raw) return [] as string[]
    return raw
      .split(/[,،]/)
      .map((w) => w.trim())
      .filter((w) => w.length > 0)
  }, [workspace?.bannedWords])

  const detectedBannedWords = useMemo(() => {
    if (bannedWordsList.length === 0 || !caption) return [] as string[]
    const lower = caption.toLowerCase()
    return bannedWordsList.filter((w) => lower.includes(w.toLowerCase()))
  }, [bannedWordsList, caption])

  // Confirmation dialog state — set when the user clicks "انتشار" with banned
  // words present. The pending payload is stashed so we can resume publish
  // without recomputing.
  const [showBannedWordsDialog, setShowBannedWordsDialog] = useState(false)
  const [pendingPublishPayload, setPendingPublishPayload] = useState<PublishPayload | null>(null)

  // Issue #152: canPublish no longer requires media globally.
  // Text-only publication is allowed when ALL selected channels support text
  // (capability registry says supportsText=true). Media is required only when
  // any selected channel requires it (e.g. Instagram).
  const anyChannelRequiresMedia = useMemo(
    () =>
      (platforms ?? [])
        .filter((p) => selectedPlatforms.includes(p.id))
        .some((p) => getCapabilities(p.type).requiresMedia),
    [platforms, selectedPlatforms]
  )

  const canPublish =
    title.trim().length > 0 &&
    selectedPlatforms.length > 0 &&
    (!anyChannelRequiresMedia || selectedMedia.length > 0) &&
    !hasCapabilityViolations

  // Optimistic publish: append the new content to the ["content"] cache before the
  // API resolves so it appears in the content library in <100ms (Linear feel).
  const publishMutation = useMutation<
    { message: string; jobs: { id: string; platform: string }[]; contentId: string },
    Error,
    PublishPayload
  >({
    mutationFn: (payload) =>
      api.post<{ message: string; jobs: { id: string; platform: string }[]; contentId: string }>(
        '/api/publish',
        payload
      ),
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: ['content'] })
      const previous = queryClient.getQueryData<ContentItem[]>(['content'])
      const optimistic: ContentItem = {
        id: `optimistic-${Date.now()}`,
        title: payload.title,
        body: payload.caption || null,
        hashtags: payload.hashtags || null,
        // BUG-14: "now" mode queues the job — it is NOT published yet
        status:
          payload.mode === 'draft' ? 'draft' : payload.mode === 'review' ? 'review' : 'scheduled',
        authorName: null,
        thumbnail: payload.thumbnail,
        campaign: payload.campaignName,
        // BUG-08: channelIds are UUIDs now; server returns type info on refresh
        platforms: payload.channelIds,
        scheduledAt:
          payload.scheduleMode === 'schedule' && payload.scheduledAt ? payload.scheduledAt : null,
        publishedAt: null,
        updatedAt: new Date().toISOString(),
      }
      queryClient.setQueryData<ContentItem[]>(['content'], (old) => [optimistic, ...(old ?? [])])
      return { previous }
    },
    onError: (err, _payload, context: unknown) => {
      const ctx = context as { previous?: ContentItem[] } | undefined
      if (ctx?.previous) queryClient.setQueryData(['content'], ctx.previous)
      toast.error(err.message || 'انتشار محتوا ناموفق بود. تغییرات برگردانده شد.')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['content'] })
      queryClient.invalidateQueries({ queryKey: ['publish-jobs'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-pulse'] })
    },
  })

  const submit = (action: 'draft' | 'review' | 'publish') => {
    if (action === 'publish' && !canPublish) {
      // Issue #117: show capability-specific violation messages if present
      if (hasCapabilityViolations) {
        const first = capabilityViolations[0]
        toast.error(`${first.platformName}: ${first.issues[0].message}`)
      } else if (selectedPlatforms.length === 0) {
        toast.error('حداقل یک پلتفرم انتخاب کنید.')
      } else if (anyChannelRequiresMedia && selectedMedia.length === 0) {
        // Issue #152: only require media when a selected channel needs it
        toast.error('یکی از پلتفرم‌های انتخابی به رسانه نیاز دارد.')
      } else {
        toast.error('برای انتشار، عنوان و حداقل یک پلتفرم لازم است.')
      }
      return
    }

    // Issue #152: validate schedule mode requires a future timestamp
    if (action === 'publish' && scheduleMode === 'schedule') {
      if (!scheduledAt) {
        toast.error('برای زمان‌بندی، باید تاریخ و ساعت آینده را انتخاب کنید.')
        return
      }
      if (scheduledAt.getTime() <= Date.now()) {
        toast.error('زمان‌بندی باید در آینده باشد.')
        return
      }
    }

    if (action === 'draft') {
      // BUG-07: actually save the draft via API instead of showing a fake toast
      const campaignName = campaigns?.find((c) => c.id === campaignId)?.name ?? 'بدون کمپین'
      const draftPayload: PublishPayload = {
        title: title || 'پیش‌نویس بدون عنوان',
        caption,
        hashtags,
        note,
        campaignId: campaignId || undefined,
        campaignName,
        mediaIds: selectedMedia.map((m) => m.id),
        channelIds: selectedPlatforms,
        platformCaptions,
        scheduleMode,
        scheduledAt: scheduleMode === 'schedule' ? (scheduledAt?.toISOString() ?? null) : null,
        thumbnail: selectedMedia[0]?.thumbnail ?? null,
        mode: 'draft',
      }
      const toastId = toast.loading('در حال ذخیره پیش‌نویس…')
      publishMutation.mutate(draftPayload, {
        onSuccess: () => toast.success('پیش‌نویس ذخیره شد', { id: toastId }),
        onError: (err) => toast.error(err.message || 'خطا در ذخیره پیش‌نویس', { id: toastId }),
      })
      return
    }
    if (action === 'review') {
      // Submit for review — creates content with status="review" (no publish jobs)
      const campaignName = campaigns?.find((c) => c.id === campaignId)?.name ?? 'بدون کمپین'
      const payload: PublishPayload = {
        title,
        caption,
        hashtags,
        note,
        campaignId: campaignId || undefined,
        campaignName,
        mediaIds: selectedMedia.map((m) => m.id),
        channelIds: selectedPlatforms,
        platformCaptions,
        scheduleMode,
        scheduledAt: scheduleMode === 'schedule' ? (scheduledAt?.toISOString() ?? null) : null,
        thumbnail: selectedMedia[0]?.thumbnail ?? null,
        mode: 'review',
      }

      const toastId = toast.loading('در حال ارسال برای بررسی…')
      publishMutation.mutate(payload, {
        onSuccess: () => {
          toast.success('محتوا برای تأیید ارسال شد', { id: toastId })
          setTitle('')
          setCaption('')
          setHashtags('')
          setNote('')
          setCampaignId('')
          setSelectedMedia([])
          setSelectedPlatforms([])
          setPlatformCaptions({})
          setScheduleMode('now')
          setScheduledAt(null)
        },
        onError: (err) => {
          toast.error(err.message || 'خطا در ارسال', { id: toastId })
        },
      })
      return
    }

    // action === "publish" — fire the optimistic mutation
    const campaignName = campaigns?.find((c) => c.id === campaignId)?.name ?? 'بدون کمپین'
    const payload: PublishPayload = {
      title,
      caption,
      hashtags,
      note,
      campaignId: campaignId || undefined,
      campaignName,
      mediaIds: selectedMedia.map((m) => m.id),
      channelIds: selectedPlatforms,
      platformCaptions,
      scheduleMode,
      scheduledAt: scheduleMode === 'schedule' ? (scheduledAt?.toISOString() ?? null) : null,
      thumbnail: selectedMedia[0]?.thumbnail ?? null,
      mode: 'publish',
    }

    // Issue #213: if the caption contains any workspace-banned word, surface
    // a confirmation dialog before the optimistic publish fires. This is a
    // soft warning — the user can override and publish anyway.
    if (detectedBannedWords.length > 0) {
      setPendingPublishPayload(payload)
      setShowBannedWordsDialog(true)
      return
    }

    firePublish(payload, toast.loading('در حال ایجاد محتوا و ارسال به صف انتشار…'))
  }

  // Issue #213: split the publish side-effect out of submit() so the banned-
  // words confirmation dialog can resume it after the user acknowledges.
  const firePublish = (payload: PublishPayload, toastId: string | number) => {
    announce('در حال ارسال به صف انتشار...')
    publishMutation.mutate(payload, {
      onSuccess: (res) => {
        toast.success(res.message, { id: toastId })
        announce('محتوا به صف انتشار ارسال شد — در انتظار انتشار توسط ارائه‌دهنده')
        // Capture first publicationId so comment→DM panel can scope rules to this post
        if ((res as unknown as { publicationIds?: string[] }).publicationIds?.[0]) {
          setPublishedPublicationId((res as unknown as { publicationIds: string[] }).publicationIds[0])
          setShowDmSection(true)
        }
        // Reset form (keep DM panel open)
        setTitle('')
        setCaption('')
        setHashtags('')
        setNote('')
        setCampaignId('')
        setSelectedMedia([])
        setSelectedPlatforms([])
        setPlatformCaptions({})
        setScheduleMode('now')
        setScheduledAt(null)
      },
      onError: (err) => {
        toast.error(err.message || 'خطا در انتشار محتوا', { id: toastId })
        announce('خطا در انتشار', 'assertive')
      },
    })
  }

  return (
    <>
      {showConflictModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface rounded-2xl max-w-md w-full p-6 border border-border shadow-2xl space-y-4 text-start" dir="rtl">
            <div className="flex items-center gap-3 text-warning">
              <AlertTriangle className="size-6" />
              <h3 className="text-lg font-bold text-ink-primary">تغییرات همزمان یافت شد</h3>
            </div>
            <p className="text-sm text-ink-secondary leading-relaxed">
              ما تغییرات ذخیره نشده‌ای از جلسه قبلی شما پیدا کردیم که با پیش‌نویس سرور متفاوت است. مایلید کدام یک را استفاده کنید؟
            </p>
            <div className="flex justify-start gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleSelectDraft('server')}
              >
                استفاده از پیش‌نویس سرور
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => handleSelectDraft('local')}
              >
                بازیابی تغییرات محلی
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Issue #213: banned-words confirmation dialog — soft warning shown when
          the user clicks "انتشار" and the caption contains a workspace-banned
          phrase. The user can edit (default) or override and publish anyway. */}
      {showBannedWordsDialog && pendingPublishPayload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div
            className="bg-surface rounded-2xl max-w-md w-full p-6 border border-border shadow-2xl space-y-4 text-start"
            dir="rtl"
            role="alertdialog"
            aria-labelledby="banned-words-title"
            aria-describedby="banned-words-desc"
          >
            <div className="flex items-center gap-3 text-warning">
              <AlertTriangle className="size-6" />
              <h3 id="banned-words-title" className="text-lg font-bold text-ink-primary">
                کلمات ممنوعه در کپشن
              </h3>
            </div>
            <p id="banned-words-desc" className="text-sm text-ink-secondary leading-relaxed">
              کپشن شما شامل کلماتی است که در «کیت برند» به‌عنوان ممنوعه مشخص کرده‌اید. آیا
              می‌خواهید کپشن را ویرایش کنید یا با وجود این کلمات منتشر کنید؟
            </p>
            <div className="bg-warning-tint border border-warning-soft rounded-lg p-3">
              <p className="text-2xs font-semibold text-warning mb-1">کلمات یافت‌شده:</p>
              <div className="flex flex-wrap gap-1.5">
                {detectedBannedWords.map((w) => (
                  <span
                    key={w}
                    className="text-xs bg-surface border border-warning-soft text-warning rounded-full px-2 py-0.5"
                  >
                    {w}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowBannedWordsDialog(false)
                  setPendingPublishPayload(null)
                }}
              >
                ویرایش کپشن
              </Button>
              <Button
                variant="default"
                size="sm"
                className="bg-warning text-white hover:bg-warning/90"
                onClick={() => {
                  const payload = pendingPublishPayload
                  setShowBannedWordsDialog(false)
                  setPendingPublishPayload(null)
                  if (payload) {
                    firePublish(payload, toast.loading('در حال ایجاد محتوا و ارسال به صف انتشار…'))
                  }
                }}
              >
                انتشار با وجود هشدار
              </Button>
            </div>
          </div>
        </div>
      )}

      <motion.div
        initial={false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: duration.slow, ease: ease.enter }}
        className="space-y-4"
      >
        <SectionTitle
          icon={PenLine}
          badge={
            <span
              className={cn(
                'text-xs',
                saveState === 'saved'
                  ? 'text-success'
                  : saveState === 'error'
                    ? 'text-danger'
                    : saveState === 'conflict'
                      ? 'text-warning font-semibold'
                      : 'text-ink-tertiary'
              )}
            >
              {saveState === 'saving'
                ? 'در حال ذخیره…'
                : saveState === 'saved'
                  ? '✓ ذخیره شد'
                  : saveState === 'error'
                    ? '⚠ خطا در ذخیره'
                    : saveState === 'conflict'
                      ? '⚠️ تداخل همزمانی'
                      : 'ذخیره خودکار'}
            </span>
          }
        >
        ساخت محتوای جدید
      </SectionTitle>

      {/* ── Platform selector (FIRST — determines preview + limits) ── */}
      <div className="n-card p-3">
        <div className="flex items-center gap-2 mb-2">
          <Layers className="size-4 text-ink-tertiary" />
          <span className="text-sm font-semibold text-ink-secondary">انتخاب پلتفرم‌ها</span>
          <span className="text-2xs text-ink-tertiary ms-auto">
            {selectedPlatforms.length > 0
              ? `${toPersianDigits(selectedPlatforms.length)} کانال انتخاب شده`
              : 'حداقل یک کانال انتخاب کنید'}
          </span>
        </div>
        {/* BUG-08: show actual connected channel instances (with IDs), not hardcoded types */}
        <div className="flex items-center gap-2 flex-wrap">
          {(platforms ?? []).length === 0 ? (
            <p className="text-xs text-ink-tertiary">هیچ کانالی متصل نیست</p>
          ) : (
            (platforms ?? []).map((p) => {
              const isSelected = selectedPlatforms.includes(p.id)
              return (
                <button
                  key={p.id}
                  onClick={() => togglePlatform(p.id)}
                  disabled={p.state === 'disconnected'}
                  className={cn(
                    'n-focus-ring flex items-center gap-2 rounded-lg border px-3 py-3 sm:py-2 text-sm font-semibold transition-all',
                    isSelected
                      ? 'border-accent/30 bg-accent-soft text-accent'
                      : p.state === 'disconnected'
                        ? 'border-border bg-surface-subtle text-ink-tertiary opacity-50 cursor-not-allowed'
                        : 'border-border bg-surface-subtle text-ink-secondary hover:bg-surface-hover'
                  )}
                  aria-pressed={isSelected}
                >
                  <PlatformIcon platform={p.type} className="size-4" />
                  <span>{p.name}</span>
                  <ProviderSupportBadge level={getCapabilities(p.type).supportLevel} />
                  {isSelected && <Check className="size-3.5" strokeWidth={2.5} />}
                </button>
              )
            })
          )}
        </div>

        {/* Issue #117: live capability violation warnings — block submit before queuing */}
        {hasCapabilityViolations && (
          <div
            role="alert"
            aria-live="polite"
            className="mt-2 rounded-lg border border-warning-soft bg-warning-tint p-2.5 text-xs text-warning"
          >
            <div className="flex items-center gap-1.5 mb-1 font-semibold">
              <AlertTriangle className="size-3.5" />
              <span>هشدارهای تطبیق با پلتفرم</span>
            </div>
            <ul className="space-y-0.5 ms-5 list-disc">
              {capabilityViolations.flatMap((pv) =>
                pv.issues.map((iss, i) => (
                  <li key={`${pv.platform}-${i}`}>
                    <span className="font-semibold">{pv.platformName}:</span> {iss.message}
                  </li>
                ))
              )}
            </ul>
          </div>
        )}

        {/* Issue #117: media-required hint (Instagram) when no media selected */}
        {anyRequiresMedia && selectedMedia.length === 0 && !hasCapabilityViolations && (
          <div className="mt-2 rounded-lg border border-border bg-surface-subtle p-2.5 text-xs text-ink-tertiary">
            <span className="font-semibold">توجه:</span> یکی از پلتفرم‌های انتخابی (اینستاگرام) به حداقل یک رسانه نیاز دارد.
          </div>
        )}
      </div>

      {/* ── Main: Editor (left) + Preview (right) ── */}
      <div className="grid grid-cols-1 md:grid-cols-[3fr_2fr] lg:grid-cols-5 gap-4">
        {/* Editor panel */}
        <div className="lg:col-span-3 space-y-4">
          <div className="n-card p-5 space-y-4">
            {/* Title */}
            <div>
              <Label className="text-sm text-ink-secondary mb-1.5 block">عنوان محتوا</Label>
              <Input
                dir="rtl"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="مثال: معرفی محصول جدید"
                className="h-10"
              />
            </div>

            {/* AI trigger button — opens popup sheet */}
            <div className="flex items-center gap-2">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={{ duration: duration.quick, ease: ease.snap }}
                onClick={() => setAiSheetOpen(true)}
                className="n-focus-ring inline-flex h-8 min-h-[44px] sm:min-h-0 items-center gap-1.5 rounded-lg bg-accent-soft border border-accent/20 px-3 text-xs font-semibold text-accent transition-colors hover:bg-accent/10"
              >
                <motion.span
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ duration: duration.deliberate, repeat: shouldAnimate ? Infinity : 0, repeatDelay: 3, ease: ease.standard }}
                >
                  <Sparkles className="size-3.5" strokeWidth={2.5} />
                </motion.span>
                دستیار هوش مصنوعی
                <kbd className="ms-1 rounded border border-accent/20 bg-surface px-1 text-2xs font-semibold">
                  ⌘J
                </kbd>
              </motion.button>
            </div>

            {/* Rich-text editor */}
            <div>
              <Label className="text-sm text-ink-secondary mb-1.5 block">کپشن</Label>
              <NashrinoEditor
                content={caption}
                onChange={(_html, text) => startTransition(() => setCaption(text))}
                placeholder="متن کامل کپشن… (پشتیبانی از متن غنی)"
                maxLength={IG_LIMIT}
              />
            </div>

            {/* Issue #213: live banned-words warning under the editor. Soft hint
                that surfaces the workspace's content policy violation before the
                user even clicks publish. */}
            {detectedBannedWords.length > 0 && (
              <div
                role="status"
                aria-live="polite"
                className="rounded-lg border border-warning-soft bg-warning-tint p-2.5 text-xs text-warning"
              >
                <div className="flex items-center gap-1.5 mb-1 font-semibold">
                  <AlertTriangle className="size-3.5" />
                  <span>کلمات ممنوعه برند در کپشن</span>
                </div>
                <p className="text-2xs mb-1.5 text-warning/80">
                  این کلمات در «کیت برند» ممنوع شده‌اند. پیش از انتشار هشداری دریافت خواهید کرد.
                </p>
                <div className="flex flex-wrap gap-1">
                  {detectedBannedWords.map((w) => (
                    <span
                      key={w}
                      className="text-2xs bg-surface border border-warning-soft rounded-full px-1.5 py-0.5"
                    >
                      {w}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Hashtags */}
            <div>
              <Label className="text-sm text-ink-secondary mb-1.5 block">
                <span className="inline-flex items-center gap-1">
                  <Hash className="size-3.5" /> هشتگ‌ها
                </span>
              </Label>
              <Input
                dir="rtl"
                value={hashtags}
                onChange={(e) => setHashtags(e.target.value)}
                placeholder="#برند_من #محصول_جدید"
              />
            </div>

            {/* Media uploader (drag-drop + library grid) */}
            <div>
              <Label className="text-sm text-ink-secondary mb-1.5 block">
                <span className="inline-flex items-center gap-1">
                  <ImageIcon className="size-3.5" /> رسانه‌ها
                </span>
                <span className="text-2xs text-ink-tertiary ms-2">
                  {toPersianDigits(selectedMedia.length)} انتخاب شده
                </span>
              </Label>
              <MediaUploader
                onUploaded={() => {}}
                selectedMedia={selectedMedia.map((m) => ({
                  id: m.id,
                  name: m.name,
                  thumbnail: m.thumbnail,
                }))}
                onToggle={(m) => toggleMedia(m as MediaItem)}
                existingMedia={(media ?? []).map((m) => ({
                  id: m.id,
                  name: m.name,
                  thumbnail: m.thumbnail,
                }))}
              />
            </div>

            {/* Campaign + Internal note */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-sm text-ink-secondary mb-1.5 block">کمپین</Label>
                <Select value={campaignId} onValueChange={setCampaignId}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="بدون کمپین" />
                  </SelectTrigger>
                  <SelectContent>
                    {(campaigns ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm text-ink-secondary mb-1.5 block">یادداشت داخلی</Label>
                <Input
                  dir="rtl"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="یادداشت خصوصی تیم…"
                  className="h-9"
                />
              </div>
            </div>
          </div>

          {/* Comment→DM automation (shown for IG posts, or after publish) — optional, visually de-emphasized */}
          {(hasIgSelected || publishedPublicationId) && (
            <div className="rounded-xl border border-dashed border-border bg-surface-subtle/50 p-4 space-y-3">
              <button
                onClick={() => setShowDmSection((v) => !v)}
                className="n-focus-ring w-full flex items-center justify-between gap-2 text-sm font-semibold text-ink-secondary"
              >
                <span className="flex items-center gap-2">
                  <Zap className="size-4 text-ink-tertiary" />
                  دایرکت خودکار از کامنت
                  {detectedKeyword && !showDmSection && (
                    <span className="text-2xs font-normal text-accent border border-accent/30 rounded-full px-2 py-0.5">
                      کلمه «{detectedKeyword}» در کپشن پیدا شد
                    </span>
                  )}
                </span>
                {showDmSection ? <ChevronUp className="size-4 text-ink-tertiary" /> : <ChevronDown className="size-4 text-ink-tertiary" />}
              </button>

              {!showDmSection && (
                <p className="text-xs text-ink-secondary">
                  {detectedKeyword
                    ? <>کلمه <strong>«{detectedKeyword}»</strong> در کپشن پیدا شد. می‌خواهید اگر کسی این کلمه را کامنت کند، پیام آماده‌ای در دایرکت برایش بفرستید؟</>
                    : <>اگر مخاطب زیر پست شما کلمه‌ای مثل «قیمت» را کامنت کند، پیام آماده را در دایرکت دریافت می‌کند.</>}
                </p>
              )}

              {showDmSection && (
                <CommentDmRulesPanel
                  platforms={platforms ?? []}
                  publicationId={publishedPublicationId}
                  suggestedKeyword={detectedKeyword}
                />
              )}
            </div>
          )}

          {/* Schedule options (inline, not a separate step) */}
          <div className="n-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <CalendarClock className="size-4 text-ink-tertiary" />
              <span className="text-sm font-semibold text-ink-secondary">زمان‌بندی انتشار</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {[
                { id: 'now' as const, label: 'اکنون' },
                { id: 'schedule' as const, label: 'زمان‌بندی' },
                { id: 'queue' as const, label: 'صف انتشار' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setScheduleMode(opt.id)}
                  className={cn(
                    'n-focus-ring rounded-lg border px-3 py-2.5 sm:py-1.5 text-xs font-semibold transition-colors',
                    scheduleMode === opt.id
                      ? 'border-accent/30 bg-accent-soft text-accent'
                      : 'border-border bg-surface-subtle text-ink-secondary hover:bg-surface-hover'
                  )}
                >
                  {opt.label}
                </button>
              ))}
              {scheduleMode === 'schedule' && (
                <div className="flex items-center gap-2 w-full sm:w-auto sm:ms-2 sm:min-w-[220px]">
                  <JalaliDatePicker
                    value={scheduledAt}
                    onChange={setScheduledAt}
                    showTime
                    placeholder="انتخاب تاریخ و ساعت"
                    size="sm"
                    variant="soft"
                    className="flex-1"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right panel: preview only (AI is now a popup sheet) */}
        <div className="lg:col-span-2">
          <div className="lg:sticky lg:top-4 space-y-3">
            <div className="flex items-center gap-2 px-1">
              <Eye className="size-4 text-accent" />
              <h3 className="text-sm font-semibold text-ink-primary">پیش‌نمایش زنده</h3>
              <span className="text-2xs text-ink-tertiary ms-auto">
                {selectedPlatforms.length > 0
                  ? `${toPersianDigits(selectedPlatforms.length)} کانال`
                  : 'کانالی انتخاب نشده'}
              </span>
            </div>
            <PlatformPreviewTabs
              caption={caption}
              title={title}
              hashtags={hashtags}
              media={selectedMedia.map((m) => ({ thumbnail: m.thumbnail, name: m.name }))}
              selectedPlatforms={selectedPlatformTypes}
            />
            {selectedPlatformTypes.includes('instagram') && (
              <IgGridPreview
                caption={caption}
                mediaUrl={selectedMedia[0]?.thumbnail}
                mediaCount={selectedMedia.length}
                platformId={selectedIgPlatformId}
              />
            )}

            {/* Issue #222: Upcoming holidays hint (fixed + lunar, real day distance) */}
            {(() => {
              const upcoming = getUpcomingHolidays(new Date(), 14).slice(0, 2)
              if (!upcoming.length) return null
              return (
                <div className="flex items-center gap-2 text-2xs text-ink-tertiary px-2">
                  <Sparkles className="size-3 text-accent" />
                  <span>مناسبت‌های پیش‌رو: {upcoming.map(h => `${h.name} (${toPersianDigits(h.daysAway)} روز دیگر)`).join('، ')}</span>
                </div>
              )
            })()}

            {/* Schedule info (always visible below tabs) */}
            <div className="n-card-compact flex items-center justify-between p-2.5 text-2xs text-ink-tertiary">
              <span>{campaigns?.find((c) => c.id === campaignId)?.name ?? 'بدون کمپین'}</span>
              <span>
                {scheduleMode === 'now'
                  ? 'اکنون'
                  : scheduleMode === 'schedule'
                    ? scheduledAt
                      ? `${formatJalali(scheduledAt, true)} • ${formatJalaliTime(scheduledAt)}`
                      : 'زمان‌بندی نشده'
                    : 'در صف انتشار'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom action bar ── */}
      <div className="n-card p-4 sticky bottom-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-ink-tertiary num-tabular flex items-center gap-2">
            {selectedPlatforms.length > 0 && (
              <>
                <span className="inline-flex items-center gap-1.5">
                  {toPersianDigits(selectedPlatforms.length)} پلتفرم
                </span>
                <span>•</span>
              </>
            )}
            <span>{toPersianDigits(selectedMedia.length)} رسانه</span>
            <span>•</span>
            <span
              className={cn(
                caption.length > activeCaptionLimit
                  ? 'text-danger font-semibold'
                  : caption.length > activeCaptionLimit * 0.9
                    ? 'text-warning'
                    : ''
              )}
            >
              {toPersianDigits(caption.length)} / {toPersianDigits(activeCaptionLimit)} کاراکتر
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="n-focus-ring"
              onClick={() => submit('draft')}
            >
              <FileText className="size-4" />
              ذخیره پیش‌نویس
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="n-focus-ring"
              onClick={() => submit('review')}
            >
              <Send className="size-4" />
              ارسال برای تأیید
            </Button>
            <Button
              size="default"
              className="n-focus-ring bg-accent text-white hover:bg-accent-hover shadow-lg shadow-accent/20 px-5 font-bold"
              onClick={() => submit('publish')}
              disabled={publishMutation.isPending || !canPublish}
            >
              <Send className="size-4" />
              {publishMutation.isPending ? 'در حال ارسال…' : 'انتشار'}
            </Button>
          </div>
        </div>
      </div>

      {/* AI Assistant popup sheet */}
      <AIAssistantSheet
        open={aiSheetOpen}
        onClose={() => setAiSheetOpen(false)}
        platform={(selectedPlatforms[0] as 'instagram' | 'telegram' | 'linkedin' | 'rubika' | 'bale' | 'eitaa') || 'instagram'}
        topic={title}
        onInsert={(text) => setCaption(text)}
        onHashtags={(tags) => setHashtags(tags.join(' '))}
      />
    </motion.div>
  </>
)
}

/* (Legacy StepContent, StepMedia, StepPlatform, StepSchedule removed — replaced by inline UI in ComposeView) */
