"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { CaptionAssistant } from "@/components/ai/caption-assistant";
import { NashrinoEditor } from "@/components/editor/nashrino-editor";
import {
  PenLine,
  Image as ImageIcon,
  Send,
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronRight,
  Hash,
  FileText,
  Layers,
  Sparkles,
  UploadCloud,
  X,
  Plus,
} from "lucide-react";

import { api } from "@/lib/api";
import { toPersianDigits, formatJalaliTime } from "@/lib/jalali";
import { announce } from "@/lib/aria-live";
import { SectionTitle, PlatformIcon, PlatformBadge, Skeleton, LoadingState, EmptyState } from "@/components/dashboard/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface Campaign {
  id: string;
  name: string;
}
interface MediaItem {
  id: string;
  name: string;
  thumbnail: string;
  fileType: string;
  fileSize: number;
}
interface Platform {
  id: string;
  name: string;
  type: string;
  state: string;
  stateColor: string;
  username: string;
}

/** Shape of an item in the ["content"] query cache. Kept in sync with content-view. */
interface ContentItem {
  id: string;
  title: string;
  body: string | null;
  hashtags: string | null;
  status: string;
  authorName: string | null;
  thumbnail: string | null;
  campaign: string;
  platforms: string[];
  scheduledAt: string | null;
  publishedAt: string | null;
  updatedAt: string;
}

interface PublishPayload {
  title: string;
  caption: string;
  hashtags: string;
  note: string;
  campaignId?: string;
  campaignName: string;
  mediaIds: string[];
  platformTypes: string[];
  platformCaptions: Record<string, string>;
  scheduleMode: "now" | "schedule" | "queue";
  scheduleDate?: string;
  scheduleTime?: string;
  thumbnail: string | null;
}

const STEPS = [
  { id: 0, label: "محتوا", icon: PenLine },
  { id: 1, label: "رسانه", icon: ImageIcon },
  { id: 2, label: "پلتفرم", icon: Layers },
  { id: 3, label: "زمان‌بندی", icon: CalendarClock },
] as const;

const IG_LIMIT = 2200;

export function ComposeView() {
  const [activeStep, setActiveStep] = useState(0);
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [note, setNote] = useState("");
  const [campaignId, setCampaignId] = useState<string>("");
  const [selectedMedia, setSelectedMedia] = useState<MediaItem[]>([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [platformCaptions, setPlatformCaptions] = useState<Record<string, string>>({});
  const [scheduleMode, setScheduleMode] = useState<"now" | "schedule" | "queue">("now");
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("12:00");

  const { data: campaigns } = useQuery<Campaign[]>({
    queryKey: ["campaigns"],
    queryFn: () => api.get<Campaign[]>("/api/campaigns"),
  });
  const { data: media, isLoading: mediaIsLoading } = useQuery<MediaItem[]>({
    queryKey: ["media"],
    queryFn: () => api.get<MediaItem[]>("/api/media"),
  });
  const { data: platforms } = useQuery<Platform[]>({
    queryKey: ["platforms"],
    queryFn: () => api.get<Platform[]>("/api/platforms"),
  });

  const toggleMedia = (m: MediaItem) => {
    setSelectedMedia((cur) =>
      cur.some((x) => x.id === m.id) ? cur.filter((x) => x.id !== m.id) : [...cur, m]
    );
  };

  const togglePlatform = (type: string) => {
    setSelectedPlatforms((cur) =>
      cur.includes(type) ? cur.filter((x) => x !== type) : [...cur, type]
    );
  };

  const queryClient = useQueryClient();

  const canPublish =
    title.trim().length > 0 && selectedPlatforms.length > 0 && selectedMedia.length > 0;

  // Optimistic publish: append the new content to the ["content"] cache before the
  // API resolves so it appears in the content library in <100ms (Linear feel).
  const publishMutation = useMutation<
    { message: string; jobs: { id: string; platform: string }[]; contentId: string },
    Error,
    PublishPayload
  >({
    mutationFn: (payload) =>
      api.post<{ message: string; jobs: { id: string; platform: string }[]; contentId: string }>(
        "/api/publish",
        payload
      ),
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: ["content"] });
      const previous = queryClient.getQueryData<ContentItem[]>(["content"]);
      const optimistic: ContentItem = {
        id: `optimistic-${Date.now()}`,
        title: payload.title,
        body: payload.caption || null,
        hashtags: payload.hashtags || null,
        status:
          payload.scheduleMode === "now"
            ? "published"
            : payload.scheduleMode === "schedule"
              ? "scheduled"
              : "draft",
        authorName: null,
        thumbnail: payload.thumbnail,
        campaign: payload.campaignName,
        platforms: payload.platformTypes,
        scheduledAt:
          payload.scheduleMode === "schedule" && payload.scheduleDate
            ? new Date(`${payload.scheduleDate}T${payload.scheduleTime ?? "12:00"}:00`).toISOString()
            : null,
        publishedAt:
          payload.scheduleMode === "now" ? new Date().toISOString() : null,
        updatedAt: new Date().toISOString(),
      };
      queryClient.setQueryData<ContentItem[]>(["content"], (old) => [
        optimistic,
        ...(old ?? []),
      ]);
      return { previous };
    },
    onError: (err, _payload, context) => {
      if (context?.previous) queryClient.setQueryData(["content"], context.previous);
      toast.error(err.message || "انتشار محتوا ناموفق بود. تغییرات برگردانده شد.");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["content"] });
      queryClient.invalidateQueries({ queryKey: ["publish-jobs"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-pulse"] });
    },
  });

  const submit = (action: "draft" | "review" | "publish") => {
    if (action === "publish" && !canPublish) {
      toast.error("برای انتشار، عنوان، حداقل یک رسانه و یک پلتفرم لازم است.");
      return;
    }

    if (action === "draft") {
      toast.success("پیش‌نویس ذخیره شد.");
      return;
    }
    if (action === "review") {
      toast.success("محتوا برای تأیید ارسال شد.");
      return;
    }

    // action === "publish" — fire the optimistic mutation
    const campaignName =
      campaigns?.find((c) => c.id === campaignId)?.name ?? "بدون کمپین";
    const payload: PublishPayload = {
      title,
      caption,
      hashtags,
      note,
      campaignId: campaignId || undefined,
      campaignName,
      mediaIds: selectedMedia.map((m) => m.id),
      platformTypes: selectedPlatforms,
      platformCaptions,
      scheduleMode,
      scheduleDate: scheduleMode === "schedule" ? scheduleDate : undefined,
      scheduleTime: scheduleMode === "schedule" ? scheduleTime : undefined,
      thumbnail: selectedMedia[0]?.thumbnail ?? null,
    };

    const toastId = toast.loading("در حال ایجاد محتوا و ارسال به صف انتشار…");
    announce("در حال انتشار...");
    publishMutation.mutate(payload, {
      onSuccess: (res) => {
        toast.success(res.message, { id: toastId });
        announce("محتوا با موفقیت منتشر شد");
        // Reset form
        setTitle("");
        setCaption("");
        setHashtags("");
        setNote("");
        setCampaignId("");
        setSelectedMedia([]);
        setSelectedPlatforms([]);
        setPlatformCaptions({});
        setScheduleMode("now");
        setActiveStep(0);
      },
      onError: (err) => {
        toast.error(err.message || "خطا در انتشار محتوا", { id: toastId });
        announce("خطا در انتشار", "assertive");
      },
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="space-y-5"
    >
      <SectionTitle icon={PenLine} badge={<span className="text-[11px] text-ink-tertiary">پیش‌نویس خودکار ذخیره می‌شود</span>}>
        ساخت محتوای جدید
      </SectionTitle>

      {/* Step rail */}
      <div className="n-card p-4">
        <div className="flex items-center gap-2 overflow-x-auto thin-scrollbar no-scrollbar">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const done = i < activeStep;
            const active = i === activeStep;
            return (
              <button
                key={s.id}
                onClick={() => setActiveStep(i)}
                className={cn(
                  "n-focus-ring flex items-center gap-2 px-3 py-2 rounded-xl border transition-all shrink-0",
                  active
                    ? "bg-accent-soft border-accent/30 text-accent"
                    : done
                      ? "bg-success-soft/60 border-success/20 text-success"
                      : "bg-surface-subtle border-border text-ink-secondary"
                )}
              >
                <span
                  className={cn(
                    "flex size-6 items-center justify-center rounded-full text-[11px] font-[700]",
                    active ? "bg-accent text-white" : done ? "bg-success text-white" : "bg-border"
                  )}
                >
                  {done ? <Check className="size-3.5" /> : toPersianDigits(i + 1)}
                </span>
                <Icon className="size-4" />
                <span className="text-[12px] font-[700]">{s.label}</span>
                {i < STEPS.length - 1 && <ChevronLeft className="size-3 text-ink-tertiary ms-1" />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Main step panel */}
        <div className="lg:col-span-2 n-card p-5 min-h-[420px]">
          {activeStep === 0 && (
            <StepContent
              title={title}
              setTitle={setTitle}
              caption={caption}
              setCaption={setCaption}
              hashtags={hashtags}
              setHashtags={setHashtags}
              note={note}
              setNote={setNote}
              campaignId={campaignId}
              setCampaignId={setCampaignId}
              campaigns={campaigns ?? []}
            />
          )}
          {activeStep === 1 && (
            <StepMedia
              media={media ?? []}
              isLoading={mediaIsLoading}
              selected={selectedMedia}
              toggle={toggleMedia}
            />
          )}
          {activeStep === 2 && (
            <StepPlatform
              platforms={platforms ?? []}
              selected={selectedPlatforms}
              toggle={togglePlatform}
              captions={platformCaptions}
              setCaptions={setPlatformCaptions}
            />
          )}
          {activeStep === 3 && (
            <StepSchedule
              mode={scheduleMode}
              setMode={setScheduleMode}
              date={scheduleDate}
              setDate={setScheduleDate}
              time={scheduleTime}
              setTime={setScheduleTime}
            />
          )}

          {/* Step navigation */}
          <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
            <Button
              variant="ghost"
              size="sm"
              className="n-focus-ring"
              onClick={() => setActiveStep((s) => Math.max(0, s - 1))}
              disabled={activeStep === 0}
            >
              <ChevronRight className="size-4" />
              مرحله قبل
            </Button>
            <span className="text-[11px] text-ink-tertiary num-tabular">
              مرحله {toPersianDigits(activeStep + 1)} از {toPersianDigits(STEPS.length)}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="n-focus-ring"
              onClick={() => setActiveStep((s) => Math.min(STEPS.length - 1, s + 1))}
              disabled={activeStep === STEPS.length - 1}
            >
              مرحله بعد
              <ChevronLeft className="size-4" />
            </Button>
          </div>
        </div>

        {/* Live preview */}
        <div className="n-card n-gradient-border p-5 h-fit sticky top-4">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="size-4 text-accent" />
            <h3 className="text-sm font-[600] text-ink-primary">پیش‌نمایش زنده</h3>
          </div>
          <div className="n-card-compact p-4">
            <div className="flex items-center gap-2 mb-3">
              {selectedPlatforms.length === 0 ? (
                <span className="text-[11px] text-ink-tertiary">پلتفرمی انتخاب نشده</span>
              ) : (
                selectedPlatforms.map((p, i) => <PlatformBadge key={`${p}-${i}`} platform={p} />)
              )}
            </div>
            {selectedMedia[0] ? (
              <div className="relative aspect-square w-full rounded-xl overflow-hidden mb-3 bg-border">
                <img src={selectedMedia[0].thumbnail} alt="" className="w-full h-full object-cover" />
                {selectedMedia.length > 1 && (
                  <span className="absolute top-2 left-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-full num-tabular">
                    +{toPersianDigits(selectedMedia.length - 1)}
                  </span>
                )}
              </div>
            ) : (
              <div className="aspect-square w-full rounded-xl bg-border flex items-center justify-center mb-3">
                <ImageIcon className="size-8 text-ink-tertiary opacity-40" />
              </div>
            )}
            <p className="text-[13px] font-[600] text-ink-primary line-clamp-1">
              {title || "عنوان محتوا اینجا نمایش داده می‌شود"}
            </p>
            <p className="text-[12px] text-ink-secondary mt-1 line-clamp-3 whitespace-pre-wrap">
              {caption || "متن کپشن…"}
            </p>
            {hashtags && (
              <p className="text-[11px] text-accent mt-2 line-clamp-1">{hashtags}</p>
            )}
            <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-[10px] text-ink-tertiary">
              <span>
                {campaigns?.find((c) => c.id === campaignId)?.name ?? "بدون کمپین"}
              </span>
              <span>
                {scheduleMode === "now"
                  ? "اکنون"
                  : scheduleMode === "schedule"
                    ? scheduleDate
                      ? `${scheduleDate} - ${scheduleTime}`
                      : "زمان‌بندی نشده"
                    : "در صف انتشار"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom action bar */}
      <div className="n-card p-4 sticky bottom-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-[11px] text-ink-tertiary num-tabular">
            {selectedPlatforms.length > 0 && (
              <span className="inline-flex items-center gap-1.5">
                {toPersianDigits(selectedPlatforms.length)} پلتفرم
                <span className="mx-1">•</span>
              </span>
            )}
            {toPersianDigits(selectedMedia.length)} رسانه
            <span className="mx-1">•</span>
            {toPersianDigits(caption.length)} / {toPersianDigits(IG_LIMIT)} کاراکتر
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="sm" className="n-focus-ring" onClick={() => submit("draft")}>
              <FileText className="size-4" />
              ذخیره پیش‌نویس
            </Button>
            <Button variant="outline" size="sm" className="n-focus-ring" onClick={() => submit("review")}>
              <Send className="size-4" />
              ارسال برای تأیید
            </Button>
            <Button
              size="sm"
              className="n-focus-ring bg-gradient-to-l from-violet-500 to-fuchsia-500 text-white hover:opacity-90"
              onClick={() => submit("publish")}
              disabled={publishMutation.isPending || !canPublish}
            >
              <Send className="size-4" />
              {publishMutation.isPending ? "در حال ارسال…" : "انتشار"}
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ── Step 1: Content ── */
function StepContent(props: {
  title: string;
  setTitle: (v: string) => void;
  caption: string;
  setCaption: (v: string) => void;
  hashtags: string;
  setHashtags: (v: string) => void;
  note: string;
  setNote: (v: string) => void;
  campaignId: string;
  setCampaignId: (v: string) => void;
  campaigns: Campaign[];
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
          onHashtags={(tags) => props.setHashtags(tags.join(" "))}
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
  );
}

/* ── Step 2: Media ── */
function StepMedia({
  media,
  isLoading,
  selected,
  toggle,
}: {
  media: MediaItem[];
  isLoading: boolean;
  selected: MediaItem[];
  toggle: (m: MediaItem) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border-2 border-dashed border-border p-6 text-center bg-surface-subtle">
        <UploadCloud className="size-8 text-ink-tertiary mx-auto mb-2" />
        <p className="text-[13px] font-[600] text-ink-primary">رسانه را اینجا بکشید یا کلیک کنید</p>
        <p className="text-[11px] text-ink-tertiary mt-1">پشتیبانی از JPG، PNG، MP4 (حداکثر ۵۰ مگابایت)</p>
        <Button variant="outline" size="sm" className="mt-3 n-focus-ring" onClick={() => toast.info("آپلود فایل به‌زودی فعال خواهد شد.")}>
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
                const isSel = selected.some((x) => x.id === m.id);
                return (
                  <button
                    key={m.id}
                    onClick={() => toggle(m)}
                    className={cn(
                      "n-focus-ring relative aspect-square rounded-xl overflow-hidden border-2 transition-all",
                      isSel ? "border-accent ring-2 ring-accent/30" : "border-transparent hover:border-border"
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
                );
              })}
            </div>
          )}
        </LoadingState>
      </div>
    </div>
  );
}

/* ── Step 3: Platforms ── */
function StepPlatform({
  platforms,
  selected,
  toggle,
  captions,
  setCaptions,
}: {
  platforms: Platform[];
  selected: string[];
  toggle: (type: string) => void;
  captions: Record<string, string>;
  setCaptions: (updater: (cur: Record<string, string>) => Record<string, string>) => void;
}) {
  // Ensure all 4 platform types are shown even if not connected
  const allTypes = ["instagram", "telegram", "linkedin", "rubika"];
  const merged = allTypes.map((t) => platforms.find((p) => p.type === t) ?? null);

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-ink-tertiary">انتخاب کنید محتوا در کدام پلتفرم‌ها منتشر شود.</p>
      {merged.map((p) => {
        const type = p?.type ?? "";
        const isSelected = selected.includes(type);
        return (
          <div
            key={type}
            className={cn(
              "rounded-2xl border p-4 transition-all",
              isSelected ? "border-accent/30 bg-accent-soft" : "border-border bg-surface-subtle"
            )}
          >
            <div className="flex items-center gap-3">
              <Checkbox checked={isSelected} onCheckedChange={() => toggle(type)} />
              <PlatformIcon platform={type} className="size-8" />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-[600] text-ink-primary">{p?.name ?? type}</p>
                <p className="text-[11px] text-ink-tertiary">
                  @{p?.username || "—"}
                </p>
              </div>
              {p && (
                <span className={cn("text-[10px] font-[600] px-2 py-0.5 rounded-full border", p.stateColor)}>
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
                  value={captions[type] ?? ""}
                  onChange={(e) => setCaptions((cur) => ({ ...cur, [type]: e.target.value }))}
                  className="resize-none text-[12px]"
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Step 4: Schedule ── */
function StepSchedule({
  mode,
  setMode,
  date,
  setDate,
  time,
  setTime,
}: {
  mode: "now" | "schedule" | "queue";
  setMode: (m: "now" | "schedule" | "queue") => void;
  date: string;
  setDate: (v: string) => void;
  time: string;
  setTime: (v: string) => void;
}) {
  const options = [
    { id: "now" as const, label: "اکنون", desc: "بلافاصله پس از انتشار، ارسال شود", icon: Send },
    { id: "schedule" as const, label: "زمان‌بندی", desc: "تاریخ و ساعت دقیق را مشخص کنید", icon: CalendarClock },
    { id: "queue" as const, label: "افزودن به صف", desc: "طبق اولویت صف انتشار منتشر شود", icon: Layers },
  ];
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {options.map((opt) => {
          const Icon = opt.icon;
          const active = mode === opt.id;
          return (
            <button
              key={opt.id}
              onClick={() => setMode(opt.id)}
              className={cn(
                "n-focus-ring rounded-2xl border p-4 text-right transition-all",
                active
                  ? "border-accent/30 bg-accent-soft"
                  : "border-border bg-surface-subtle hover:bg-surface-hover"
              )}
            >
              <Icon className={cn("size-5 mb-2", active ? "text-accent" : "text-ink-tertiary")} />
              <p className="text-[13px] font-[600] text-ink-primary">{opt.label}</p>
              <p className="text-[11px] text-ink-tertiary mt-0.5">{opt.desc}</p>
            </button>
          );
        })}
      </div>

      {mode === "schedule" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
          <div>
            <Label className="text-[12px] text-ink-secondary mb-1.5 block">تاریخ (شمسی)</Label>
            <Input
              dir="ltr"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              placeholder="1403/09/14"
              className="text-left"
            />
            <p className="text-[10px] text-ink-tertiary mt-1">به‌فرمت سال/ماه/روز شمسی</p>
          </div>
          <div>
            <Label className="text-[12px] text-ink-secondary mb-1.5 block">ساعت</Label>
            <Input
              dir="ltr"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="text-left"
            />
            <p className="text-[10px] text-ink-tertiary mt-1">پیش‌نمایش: {time ? formatJalaliTime(new Date(`1970-01-01T${time}:00`)) : "—"}</p>
          </div>
        </div>
      )}

      {mode === "queue" && (
        <div className="n-card-compact p-4 mt-2">
          <p className="text-[12px] text-ink-secondary">
            محتوا به انتهای صف انتشار افزوده می‌شود. اولویت طبق تنظیمات کمپین و ساعات اوج مخاطب تعیین می‌گردد.
          </p>
        </div>
      )}
    </div>
  );
}
