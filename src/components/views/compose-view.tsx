'use client'

import { useState, useEffect, useCallback, useRef, useMemo, useTransition } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { CaptionAssistant } from '@/components/ai/caption-assistant'
import { AIAssistantSheet } from '@/components/ai/ai-assistant-sheet'
import { NashrinoEditor } from '@/components/editor/nashrino-editor'
import { PlatformPreviewTabs } from '@/components/editor/platform-preview-tabs'
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
  MessageSquare,
  UploadCloud,
  X,
  Plus,
  AlertTriangle,
} from 'lucide-react'

import { api } from '@/lib/api'
import { toPersianDigits, formatJalali, formatJalaliTime } from '@/lib/jalali'
import { announce } from '@/lib/aria-live'
import {
  SectionTitle,
  PlatformIcon,
  PlatformBadge,
  ProviderSupportBadge,
  Skeleton,
  LoadingState,
  EmptyState,
} from '@/components/dashboard/shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
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
  type PlatformKey,
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
  const [title, setTitle] = useState('')
  const [caption, setCaption] = useState('')
  const [hashtags, setHashtags] = useState('')
  const [note, setNote] = useState('')
  const [campaignId, setCampaignId] = useState<string>('')
  const [selectedMedia, setSelectedMedia] = useState<MediaItem[]>([])
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([])
  const [platformCaptions, setPlatformCaptions] = useState<Record<string, string>>({})
  const [scheduleMode, setScheduleMode] = useState<'now' | 'schedule' | 'queue'>('now')
  // Single source of truth — a real Date object from the Jalali picker
  const [scheduledAt, setScheduledAt] = useState<Date | null>(null)

  // Issue #127: useTransition for non-urgent state updates (caption/hashtags/note
  // typing) so the main thread stays responsive → INP <200ms. Urgent updates
  // (title, platform selection) stay synchronous for immediate feedback.
  const [isPending, startTransition] = useTransition()

  // MISS-04: debounced autosave state
  type SaveState = 'idle' | 'saving' | 'saved' | 'error' | 'conflict'
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Issue #152: draft versioning & conflict resolution state
  const draftVersion = useRef<number | null>(null)
  const [showConflictModal, setShowConflictModal] = useState(false)
  const [pendingLocalDraft, setPendingLocalDraft] = useState<any>(null)
  const [pendingServerDraft, setPendingServerDraft] = useState<any>(null)

  const applyDraft = useCallback((draft: any) => {
    const c = draft.content
    if (c?.title) setTitle(c.title)
    if (c?.caption) setCaption(c.caption)
    if (c?.hashtags) setHashtags(c.hashtags)
    if (c?.note) setNote(c.note)
    if (c?.campaignId) setCampaignId(c.campaignId)
    if (c?.scheduleMode) setScheduleMode(c.scheduleMode)
    if (draft.channelIds?.length) setSelectedPlatforms(draft.channelIds)
    if (draft.scheduledAt) {
      const d = new Date(draft.scheduledAt)
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
    let localDraft: any = null
    try {
      const rawLocal = localStorage.getItem('nashrino_unsaved_draft')
      if (rawLocal) {
        localDraft = JSON.parse(rawLocal)
      }
    } catch (e) {
      console.error('Failed to parse local draft', e)
    }

    // 2. Fetch server draft
    fetch('/api/compose-draft')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const serverDraftRaw = data?.draft
        const serverDraft = typeof serverDraftRaw === 'string' ? JSON.parse(serverDraftRaw) : serverDraftRaw

        const hasServer = serverDraft && (serverDraft.content?.title || serverDraft.content?.caption || serverDraft.channelIds?.length)
        const hasLocal = localDraft && (localDraft.content?.title || localDraft.content?.caption || localDraft.channelIds?.length)

        if (hasServer && hasLocal) {
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
        } else if (hasLocal) {
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
    setSaveState('saving')
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    autosaveTimer.current = setTimeout(async () => {
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
  const { data: media, isLoading: mediaIsLoading } = useQuery<MediaItem[]>({
    queryKey: ['media'],
    queryFn: () => api.getPaginated<MediaItem>('/api/media'),
  })
  const { data: platforms } = useQuery<Platform[]>({
    queryKey: ['platforms'],
    queryFn: () => api.getPaginated<Platform>('/api/platforms'),
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
    onError: (err, _payload, context: any) => {
      if (context?.previous) queryClient.setQueryData(['content'], context.previous)
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
        onSuccess: (res) => {
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

    const toastId = toast.loading('در حال ایجاد محتوا و ارسال به صف انتشار…')
    announce('در حال ارسال به صف انتشار...')
    publishMutation.mutate(payload, {
      onSuccess: (res) => {
        toast.success(res.message, { id: toastId })
        // Issue #152: say "queued" not "published" — content is accepted into
        // the publishing queue, NOT yet published to the provider.
        // Actual publication success is announced via realtime when the worker
        // confirms the provider accepted the post.
        announce('محتوا به صف انتشار ارسال شد — در انتظار انتشار توسط ارائه‌دهنده')
        // Reset form
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
          <div className="bg-surface rounded-2xl max-w-md w-full p-6 border border-border shadow-2xl space-y-4 text-right" dir="rtl">
            <div className="flex items-center gap-3 text-amber-500">
              <AlertTriangle className="size-6" />
              <h3 className="text-[15px] font-[700] text-ink-primary">تغییرات همزمان یافت شد</h3>
            </div>
            <p className="text-[13px] text-ink-secondary leading-relaxed">
              ما تغییرات ذخیره نشده‌ای از جلسه قبلی شما پیدا کردیم که با پیش‌نویس سرور متفاوت است. مایلید کدام یک را استفاده کنید؟
            </p>
            <div className="flex justify-end gap-2 pt-2">
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

      <motion.div
        initial={false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="space-y-4"
      >
        <SectionTitle
          icon={PenLine}
          badge={
            <span
              className={cn(
                'text-[11px]',
                saveState === 'saved'
                  ? 'text-emerald-600'
                  : saveState === 'error'
                    ? 'text-red-500'
                    : saveState === 'conflict'
                      ? 'text-amber-600 font-semibold'
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
          <span className="text-[12px] font-[600] text-ink-secondary">انتخاب پلتفرم‌ها</span>
          <span className="text-[10px] text-ink-tertiary ms-auto">
            {selectedPlatforms.length > 0
              ? `${toPersianDigits(selectedPlatforms.length)} کانال انتخاب شده`
              : 'حداقل یک کانال انتخاب کنید'}
          </span>
        </div>
        {/* BUG-08: show actual connected channel instances (with IDs), not hardcoded types */}
        <div className="flex items-center gap-2 flex-wrap">
          {(platforms ?? []).length === 0 ? (
            <p className="text-[11px] text-ink-tertiary">هیچ کانالی متصل نیست</p>
          ) : (
            (platforms ?? []).map((p) => {
              const isSelected = selectedPlatforms.includes(p.id)
              return (
                <button
                  key={p.id}
                  onClick={() => togglePlatform(p.id)}
                  disabled={p.state === 'disconnected'}
                  className={cn(
                    'n-focus-ring flex items-center gap-2 rounded-lg border px-3 py-2 text-[12px] font-[600] transition-all',
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
            className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-[11px] text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200"
          >
            <div className="flex items-center gap-1.5 mb-1 font-[600]">
              <AlertTriangle className="size-3.5" />
              <span>هشدارهای تطبیق با پلتفرم</span>
            </div>
            <ul className="space-y-0.5 ms-5 list-disc">
              {capabilityViolations.flatMap((pv) =>
                pv.issues.map((iss, i) => (
                  <li key={`${pv.platform}-${i}`}>
                    <span className="font-[600]">{pv.platformName}:</span> {iss.message}
                  </li>
                ))
              )}
            </ul>
          </div>
        )}

        {/* Issue #117: media-required hint (Instagram) when no media selected */}
        {anyRequiresMedia && selectedMedia.length === 0 && !hasCapabilityViolations && (
          <div className="mt-2 rounded-lg border border-border bg-surface-subtle p-2.5 text-[11px] text-ink-tertiary">
            <span className="font-[600]">توجه:</span> یکی از پلتفرم‌های انتخابی (اینستاگرام) به حداقل یک رسانه نیاز دارد.
          </div>
        )}
      </div>

      {/* ── Main: Editor (left) + Preview (right) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Editor panel */}
        <div className="lg:col-span-3 space-y-4">
          <div className="n-card p-5 space-y-4">
            {/* Title */}
            <div>
              <Label className="text-[12px] text-ink-secondary mb-1.5 block">عنوان محتوا</Label>
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
                transition={{ duration: 0.15, ease: [0.12, 0, 0.08, 1] }}
                onClick={() => setAiSheetOpen(true)}
                className="n-focus-ring inline-flex h-8 items-center gap-1.5 rounded-lg bg-accent-soft border border-accent/20 px-3 text-[11.5px] font-[600] text-accent transition-colors hover:bg-accent/10"
              >
                <motion.span
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 2, repeat: Infinity, repeatDelay: 3, ease: 'easeInOut' }}
                >
                  <Sparkles className="size-3.5" strokeWidth={2.5} />
                </motion.span>
                دستیار هوش مصنوعی
                <kbd className="ms-1 rounded border border-accent/20 bg-surface px-1 text-[9px] font-[600]">
                  ⌘J
                </kbd>
              </motion.button>
            </div>

            {/* Rich-text editor */}
            <div>
              <Label className="text-[12px] text-ink-secondary mb-1.5 block">کپشن</Label>
              <NashrinoEditor
                content={caption}
                onChange={(_html, text) => startTransition(() => setCaption(text))}
                placeholder="متن کامل کپشن… (پشتیبانی از متن غنی)"
                maxLength={IG_LIMIT}
              />
            </div>

            {/* Hashtags */}
            <div>
              <Label className="text-[12px] text-ink-secondary mb-1.5 block">
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
              <Label className="text-[12px] text-ink-secondary mb-1.5 block">
                <span className="inline-flex items-center gap-1">
                  <ImageIcon className="size-3.5" /> رسانه‌ها
                </span>
                <span className="text-[10px] text-ink-tertiary ms-2">
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
                onToggle={(m) => toggleMedia(m as any)}
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
                <Label className="text-[12px] text-ink-secondary mb-1.5 block">کمپین</Label>
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
                <Label className="text-[12px] text-ink-secondary mb-1.5 block">یادداشت داخلی</Label>
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

          {/* Schedule options (inline, not a separate step) */}
          <div className="n-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <CalendarClock className="size-4 text-ink-tertiary" />
              <span className="text-[12px] font-[600] text-ink-secondary">زمان‌بندی انتشار</span>
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
                    'n-focus-ring rounded-lg border px-3 py-1.5 text-[11.5px] font-[600] transition-colors',
                    scheduleMode === opt.id
                      ? 'border-accent/30 bg-accent-soft text-accent'
                      : 'border-border bg-surface-subtle text-ink-secondary hover:bg-surface-hover'
                  )}
                >
                  {opt.label}
                </button>
              ))}
              {scheduleMode === 'schedule' && (
                <div className="flex items-center gap-2 ms-2 min-w-[220px]">
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
          <div className="sticky top-4 space-y-3">
            <div className="flex items-center gap-2 px-1">
              <Eye className="size-4 text-accent" />
              <h3 className="text-sm font-[600] text-ink-primary">پیش‌نمایش زنده</h3>
              <span className="text-[10px] text-ink-tertiary ms-auto">
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

            {/* Schedule info (always visible below tabs) */}
            <div className="n-card-compact flex items-center justify-between p-2.5 text-[10px] text-ink-tertiary">
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
      <div className="n-card p-4 sticky bottom-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-[11px] text-ink-tertiary num-tabular flex items-center gap-2">
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
                  ? 'text-danger font-[600]'
                  : caption.length > activeCaptionLimit * 0.9
                    ? 'text-amber-600'
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
              size="sm"
              className="n-focus-ring bg-accent text-white hover:bg-accent-hover"
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
        platform={(selectedPlatforms[0] as any) || 'instagram'}
        topic={title}
        onInsert={(text) => setCaption(text)}
        onHashtags={(tags) => setHashtags(tags.join(' '))}
      />
    </motion.div>
  </>
)
}

/* ── Step 1: Content ── */
function StepContent(props: {
  title: string
  setTitle: (v: string) => void
  caption: string
  setCaption: (v: string) => void
  hashtags: string
  setHashtags: (v: string) => void
  note: string
  setNote: (v: string) => void
  campaignId: string
  setCampaignId: (v: string) => void
  campaigns: Campaign[]
}) {
  return (
    <div className="space-y-4">
      <div>
        <Label className="text-[12px] text-ink-secondary mb-1.5 block">عنوان محتوا</Label>
        <Input
          dir="rtl"
          value={props.title}
          onChange={(e) => props.setTitle(e.target.value)}
          placeholder="مثال: معرفی محصول جدید"
          className="h-10"
        />
      </div>

      {/* AI Caption Assistant — Persian streaming caption generation */}
      {props.title.trim().length >= 3 && (
        <CaptionAssistant
          platform="instagram"
          topic={props.title}
          onInsert={(text) => props.setCaption(text)}
          onHashtags={(tags) => props.setHashtags(tags.join(' '))}
        />
      )}

      <div>
        <Label className="text-[12px] text-ink-secondary mb-1.5 block">کپشن</Label>
        <NashrinoEditor
          content={props.caption}
          onChange={(_html, text) => props.setCaption(text)}
          placeholder="متن کامل کپشن… (پشتیبانی از متن غنی)"
          maxLength={IG_LIMIT}
        />
      </div>

      <div>
        <Label className="text-[12px] text-ink-secondary mb-1.5 block">
          <span className="inline-flex items-center gap-1">
            <Hash className="size-3.5" /> هشتگ‌ها
          </span>
        </Label>
        <Input
          dir="rtl"
          value={props.hashtags}
          onChange={(e) => props.setHashtags(e.target.value)}
          placeholder="#برند_من #محصول_جدید"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label className="text-[12px] text-ink-secondary mb-1.5 block">کمپین</Label>
          <Select value={props.campaignId} onValueChange={props.setCampaignId}>
            <SelectTrigger className="w-full h-10">
              <SelectValue placeholder="انتخاب کمپین" />
            </SelectTrigger>
            <SelectContent>
              {props.campaigns.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[12px] text-ink-secondary mb-1.5 block">یادداشت داخلی</Label>
          <Input
            dir="rtl"
            value={props.note}
            onChange={(e) => props.setNote(e.target.value)}
            placeholder="یادداشت برای تیم (اختیاری)"
          />
        </div>
      </div>
    </div>
  )
}

/* ── Step 2: Media ── */
function StepMedia({
  media,
  isLoading,
  selected,
  toggle,
}: {
  media: MediaItem[]
  isLoading: boolean
  selected: MediaItem[]
  toggle: (m: MediaItem) => void
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border-2 border-dashed border-border p-6 text-center bg-surface-subtle">
        <UploadCloud className="size-8 text-ink-tertiary mx-auto mb-2" />
        <p className="text-[13px] font-[600] text-ink-primary">رسانه را اینجا بکشید یا کلیک کنید</p>
        <p className="text-[11px] text-ink-tertiary mt-1">
          پشتیبانی از JPG، PNG، MP4 (حداکثر ۵۰ مگابایت)
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-3 n-focus-ring"
          onClick={() => toast.info('آپلود فایل به‌زودی فعال خواهد شد.')}
        >
          <Plus className="size-4" />
          انتخاب فایل
        </Button>
      </div>

      {selected.length > 0 && (
        <div>
          <p className="text-[11px] text-ink-tertiary mb-2 num-tabular">
            انتخاب‌شده‌ها ({toPersianDigits(selected.length)})
          </p>
          <div className="flex gap-2 flex-wrap">
            {selected.map((m) => (
              <div key={m.id} className="relative">
                <img src={m.thumbnail} alt={m.name} className="size-16 rounded-xl object-cover" />
                <button
                  onClick={() => toggle(m)}
                  className="n-focus-ring absolute -top-1.5 -left-1.5 bg-danger text-white rounded-full p-0.5 ring-2 ring-background"
                  aria-label="حذف"
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="text-[11px] text-ink-tertiary mb-2">رسانه‌های موجود</p>
        <LoadingState
          isLoading={isLoading}
          skeleton={
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 p-1">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square rounded-xl" />
              ))}
            </div>
          }
        >
          {media.length === 0 ? (
            <EmptyState
              size="compact"
              icon={ImageIcon}
              title="رسانه‌ای موجود نیست"
              message="برای انتخاب، ابتدا یک رسانه آپلود کنید."
            />
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 max-h-72 overflow-y-auto thin-scrollbar p-1">
              {media.map((m) => {
                const isSel = selected.some((x) => x.id === m.id)
                return (
                  <button
                    key={m.id}
                    onClick={() => toggle(m)}
                    className={cn(
                      'n-focus-ring relative aspect-square rounded-xl overflow-hidden border-2 transition-all',
                      isSel
                        ? 'border-accent ring-2 ring-accent/30'
                        : 'border-transparent hover:border-border'
                    )}
                  >
                    <img src={m.thumbnail} alt={m.name} className="w-full h-full object-cover" />
                    {isSel && (
                      <span className="absolute top-1 right-1 bg-accent text-white rounded-full p-0.5">
                        <Check className="size-3" />
                      </span>
                    )}
                    <span className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent text-white text-[9px] px-1.5 py-1 truncate text-right">
                      {m.name}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </LoadingState>
      </div>
    </div>
  )
}

/* ── Step 3: Platforms ── */
function StepPlatform({
  platforms,
  selected,
  toggle,
  captions,
  setCaptions,
}: {
  platforms: Platform[]
  selected: string[]
  toggle: (type: string) => void
  captions: Record<string, string>
  setCaptions: (updater: (cur: Record<string, string>) => Record<string, string>) => void
}) {
  // Ensure all 4 platform types are shown even if not connected
  const allTypes = ['instagram', 'telegram', 'linkedin', 'rubika']
  const merged = allTypes.map((t) => platforms.find((p) => p.type === t) ?? null)

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-ink-tertiary">
        انتخاب کنید محتوا در کدام پلتفرم‌ها منتشر شود.
      </p>
      {merged.map((p) => {
        const type = p?.type ?? ''
        const isSelected = selected.includes(type)
        return (
          <div
            key={type}
            className={cn(
              'rounded-2xl border p-4 transition-all',
              isSelected ? 'border-accent/30 bg-accent-soft' : 'border-border bg-surface-subtle'
            )}
          >
            <div className="flex items-center gap-3">
              <Checkbox checked={isSelected} onCheckedChange={() => toggle(type)} />
              <PlatformIcon platform={type} className="size-8" />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-[600] text-ink-primary">{p?.name ?? type}</p>
                <p className="text-[11px] text-ink-tertiary">@{p?.username || '—'}</p>
              </div>
              {p && (
                <span
                  className={cn(
                    'text-[10px] font-[600] px-2 py-0.5 rounded-full border',
                    p.stateColor
                  )}
                >
                  {p.state}
                </span>
              )}
            </div>
            {isSelected && (
              <div className="mt-3 ps-9">
                <Textarea
                  dir="rtl"
                  rows={2}
                  placeholder={`کپشن اختصاصی ${p?.name ?? type} (اختیاری)`}
                  value={captions[type] ?? ''}
                  onChange={(e) => setCaptions((cur) => ({ ...cur, [type]: e.target.value }))}
                  className="resize-none text-[12px]"
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/* (Legacy StepSchedule removed — replaced by inline JalaliDatePicker in schedule section) */
