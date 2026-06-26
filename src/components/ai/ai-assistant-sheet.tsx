"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Send, Loader2, Check, X, Hash, RefreshCw, Save, Copy, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { toPersianDigits } from "@/lib/jalali";
import { api } from "@/lib/api";
import {
  CREATOR_ROLES, CONTENT_GOALS, CAPTION_LENGTHS,
  type Tone, type CreatorRole, type ContentGoal, type CaptionLength, type HashtagSuggestion,
} from "@/lib/ai/types";

type Platform = "instagram" | "telegram" | "linkedin" | "rubika" | "bale" | "eitaa";

interface AIAssistantSheetProps {
  open: boolean;
  onClose: () => void;
  platform: Platform;
  topic: string;
  onInsert: (text: string) => void;
  onHashtags?: (hashtags: string[]) => void;
}

const TONES: { id: Tone; label: string; emoji: string; sample: string }[] = [
  { id: "friendly", label: "صمیمی", emoji: "😊", sample: "امروز یه چیز جالب پیدا کردم، باهات در میون می‌ذارم…" },
  { id: "formal", label: "رسمی", emoji: "🎩", sample: "بدیهی است دستاوردهای اخیر در حوزهٔ فناوری…" },
  { id: "professional", label: "حرفه‌ای", emoji: "💼", sample: "در ادامه گزارشی کوتاه از مهم‌ترین نکات ارائه می‌شود…" },
  { id: "storytelling", label: "داستانی", emoji: "📖", sample: "پنج سال پیش وقتی اولین گوشی هوشمندمو خریدم…" },
  { id: "sales", label: "فروش", emoji: "🛒", sample: "فقط تا پایان هفته فرصت داری…" },
  { id: "educational", label: "آموزشی", emoji: "💡", sample: "آیا می‌دونستی چرا صفحهٔ AMOLED انرژی کمتری مصرف می‌کنه؟" },
  { id: "poetic", label: "ادبی", emoji: "🌙", sample: "چون هنگام شب، صفحهٔ گوشی‌ام روشن شد…" },
];

/**
 * AIAssistantSheet — slide-out popup sheet (Buffer/Later style).
 *
 * Opens as a right-side panel with a backdrop overlay.
 * Contains: topic input, role/goal/tone/length selectors, streaming caption,
 * hashtags, regenerate, save draft, copy, insert.
 */
export function AIAssistantSheet({ open, onClose, platform, topic: initialTopic, onInsert, onHashtags }: AIAssistantSheetProps) {
  const [topic, setTopic] = useState(initialTopic);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [streamedText, setStreamedText] = useState("");
  const [hasResult, setHasResult] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [isGeneratingHashtags, setIsGeneratingHashtags] = useState(false);
  const [hashtags, setHashtags] = useState<HashtagSuggestion[]>([]);
  const [appendedHashtags, setAppendedHashtags] = useState<Set<string>>(new Set());
  const [isSavingDraft, setIsSavingDraft] = useState(false);

  // Controls
  const [selectedTone, setSelectedTone] = useState<Tone>("friendly");
  const [selectedRole, setSelectedRole] = useState<CreatorRole>("store");
  const [selectedGoal, setSelectedGoal] = useState<ContentGoal>("sell");
  const [selectedLength, setSelectedLength] = useState<CaptionLength>("standard");
  const [variation, setVariation] = useState(0);

  const abortRef = useRef<AbortController | null>(null);
  const queryClient = useQueryClient();

  // Sync topic when prop changes
  useEffect(() => {
    if (initialTopic && initialTopic.trim().length >= 3) {
      setTopic(initialTopic);
    }
  }, [initialTopic]);

  // Reset variation when config changes
  const configSig = `${topic}::${selectedRole}::${selectedGoal}::${selectedLength}::${selectedTone}::${platform}`;
  const prevSigRef = useRef(configSig);
  useEffect(() => {
    if (prevSigRef.current !== configSig) {
      prevSigRef.current = configSig;
      setVariation(0);
    }
  }, [configSig]);

  // Esc to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const streamCaptionFn = useCallback(async (variationOverride: number) => {
    if (!topic.trim() || topic.trim().length < 3) {
      toast.error("ابتدا موضوع را بنویسید (حداقل ۳ کاراکتر)");
      return;
    }

    setIsStreaming(true);
    setIsThinking(true);
    setStreamedText("");
    setHasResult(false);
    setStreamError(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/ai/caption", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic, platform,
          tone: selectedTone, role: selectedRole, goal: selectedGoal, length: selectedLength,
          variation: variationOverride,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "خطای ناشناخته" }));
        toast.error(err.error || "خطا در تولید کپشن");
        setIsStreaming(false);
        setIsThinking(false);
        return;
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            if (line.startsWith(":")) continue;
            if (line.startsWith("data: ")) {
              const jsonStr = line.slice(6).trim();
              if (jsonStr === "[DONE]") {
                setIsStreaming(false);
                setIsThinking(false);
                setHasResult(true);
                break;
              }
              try {
                const json = JSON.parse(jsonStr);
                if (json.status === "thinking") setIsThinking(true);
                else if (json.status === "streaming") setIsThinking(false);
                else if (json.content) {
                  fullText += json.content;
                  setStreamedText(fullText);
                  setIsThinking(false);
                }
                if (json.error) {
                  toast.error(json.error);
                  setStreamError(json.error);
                  setIsStreaming(false);
                  setIsThinking(false);
                  return;
                }
              } catch { /* skip */ }
            }
          }
        }
      }

      if (!fullText) {
        toast.error("کپشن خالی تولید شد. دوباره تلاش کنید.");
        setIsStreaming(false);
        setIsThinking(false);
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        toast.error("خطا در ارتباط با سرور هوش مصنوعی");
      }
      setIsStreaming(false);
      setIsThinking(false);
      setHasResult(!!streamedText);
    }
  }, [topic, platform, selectedTone, selectedRole, selectedGoal, selectedLength, streamedText]);

  const handleGenerate = () => { setVariation(0); streamCaptionFn(0); };
  const handleRegenerate = () => { const v = variation + 1; setVariation(v); streamCaptionFn(v); };
  const cancelStream = () => { abortRef.current?.abort(); setIsStreaming(false); setIsThinking(false); setHasResult(!!streamedText); };
  const acceptCaption = () => { onInsert(streamedText); toast.success("کپشن در ادیتور قرار گرفت"); onClose(); };
  const copyCaption = () => { navigator.clipboard.writeText(streamedText); toast.success("کپی شد"); };

  const fetchHashtags = useCallback(async () => {
    if (!topic.trim()) { toast.error("ابتدا موضوع را بنویسید"); return; }
    setIsGeneratingHashtags(true);
    try {
      const res = await api.post<{ hashtags: HashtagSuggestion[] }>("/api/ai/hashtags", {
        topic, platform, role: selectedRole, goal: selectedGoal,
      });
      if (res.hashtags?.length) {
        setHashtags(res.hashtags);
        onHashtags?.(res.hashtags.map((h) => h.tag));
        toast.success(`${toPersianDigits(res.hashtags.length)} هشتگ پیشنهادی آماده شد`);
      }
    } catch { toast.error("خطا در تولید هشتگ"); }
    finally { setIsGeneratingHashtags(false); }
  }, [topic, platform, selectedRole, selectedGoal, onHashtags]);

  const appendHashtag = (tag: string) => {
    if (appendedHashtags.has(tag)) return;
    setAppendedHashtags((prev) => new Set(prev).add(tag));
    onHashtags?.([...appendedHashtags, tag]);
    toast.success(`${tag} اضافه شد`);
  };

  const insertAllHashtags = () => {
    const tags = hashtags.map((h) => h.tag);
    onHashtags?.(tags);
    setAppendedHashtags(new Set(tags));
    toast.success("همه هشتگ‌ها اضافه شدند");
  };

  const saveDraft = async () => {
    if (!streamedText.trim()) return;
    setIsSavingDraft(true);
    try {
      await api.post("/api/ai/drafts", {
        title: topic.trim().slice(0, 60), body: streamedText,
        hashtags: hashtags.map((h) => h.tag).join(" "),
        platform, tone: selectedTone, role: selectedRole, goal: selectedGoal, length: selectedLength,
      });
      toast.success("پیش‌نویس ذخیره شد", { description: "در کتابخانه محتوا قابل مشاهده است." });
      queryClient.invalidateQueries({ queryKey: ["content"] });
    } catch { toast.error("خطا در ذخیره پیش‌نویس"); }
    finally { setIsSavingDraft(false); }
  };

  const canGenerate = topic.trim().length >= 3 && !isStreaming;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[80] bg-black/30 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Sheet — slides in from right (RTL: from left visually but right in DOM) */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 350, damping: 32, mass: 0.8 }}
            className="fixed inset-y-0 right-0 z-[81] w-full max-w-[440px] bg-surface border-l border-border shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 h-14 border-b border-border shrink-0">
              <div className="flex items-center gap-2">
                <motion.div
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 2, repeat: Infinity, repeatDelay: 3, ease: "easeInOut" }}
                >
                  <Sparkles className="size-5 text-accent" strokeWidth={2} />
                </motion.div>
                <div>
                  <h2 className="text-[14px] font-[700] text-ink-primary">دستیار هوش مصنوعی</h2>
                  {variation > 0 && (
                    <span className="text-[10px] text-accent font-[600]">(نسخهٔ {toPersianDigits(variation + 1)})</span>
                  )}
                </div>
              </div>
              <button
                onClick={onClose}
                className="n-focus-ring rounded-lg p-2 text-ink-tertiary hover:bg-surface-hover hover:text-ink-primary transition-colors"
                aria-label="بستن"
              >
                <X className="size-5" strokeWidth={2} />
              </button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto thin-scrollbar p-4 space-y-4">
              {/* Topic input */}
              <div>
                <label className="text-[11px] font-[600] text-ink-tertiary mb-1.5 block">درباره چی بنویسم؟</label>
                <textarea
                  dir="rtl"
                  rows={2}
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="مثال: معرفی قهوه فوری نشرینو با سه طعم"
                  className="n-control w-full p-3 text-[13px] resize-none"
                  autoFocus
                />
              </div>

              {/* Role selector */}
              <div>
                <div className="text-[10px] font-[600] text-ink-tertiary mb-1.5">شما کی هستید؟</div>
                <div className="grid grid-cols-4 gap-1">
                  {CREATOR_ROLES.map((r) => (
                    <button key={r.id} onClick={() => setSelectedRole(r.id)} disabled={isStreaming}
                      className={`n-focus-ring flex flex-col items-center gap-0.5 rounded-md px-1 py-1.5 text-[9.5px] font-[600] transition-colors disabled:opacity-50 ${selectedRole === r.id ? "bg-accent text-white" : "border border-border bg-surface text-ink-secondary hover:bg-surface-hover"}`}
                      aria-pressed={selectedRole === r.id}>
                      <span className="text-sm">{r.emoji}</span>
                      <span>{r.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Goal selector */}
              <div>
                <div className="text-[10px] font-[600] text-ink-tertiary mb-1.5">می‌خوای چی بشه؟</div>
                <div className="grid grid-cols-3 gap-1">
                  {CONTENT_GOALS.map((g) => (
                    <button key={g.id} onClick={() => setSelectedGoal(g.id)} disabled={isStreaming}
                      className={`n-focus-ring flex items-center justify-center gap-1 rounded-md px-2 py-1.5 text-[10px] font-[600] transition-colors disabled:opacity-50 ${selectedGoal === g.id ? "bg-accent text-white" : "border border-border bg-surface text-ink-secondary hover:bg-surface-hover"}`}
                      aria-pressed={selectedGoal === g.id}>
                      <span>{g.emoji}</span><span>{g.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Tone selector */}
              <div>
                <div className="text-[10px] font-[600] text-ink-tertiary mb-1.5">لحن حرف</div>
                <div className="flex items-center gap-1 flex-wrap">
                  {TONES.map((t) => (
                    <button key={t.id} onClick={() => setSelectedTone(t.id)} disabled={isStreaming}
                      title={t.sample}
                      className={`n-focus-ring inline-flex h-7 items-center gap-1 rounded-md px-2.5 text-[11px] font-[600] transition-colors disabled:opacity-50 ${selectedTone === t.id ? "bg-accent text-white" : "border border-border bg-surface text-ink-secondary hover:bg-surface-hover"}`}
                      aria-pressed={selectedTone === t.id}>
                      <span>{t.emoji}</span><span>{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Length selector */}
              <div>
                <div className="text-[10px] font-[600] text-ink-tertiary mb-1.5">چقدر طولانی؟</div>
                <div className="grid grid-cols-3 gap-1">
                  {CAPTION_LENGTHS.map((l) => (
                    <button key={l.id} onClick={() => setSelectedLength(l.id)} disabled={isStreaming}
                      className={`n-focus-ring flex items-center justify-center gap-1 rounded-md px-2 py-1.5 text-[10px] font-[600] transition-colors disabled:opacity-50 ${selectedLength === l.id ? "bg-accent text-white" : "border border-border bg-surface text-ink-secondary hover:bg-surface-hover"}`}
                      aria-pressed={selectedLength === l.id}>
                      <span>{l.emoji}</span><span>{l.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Generate button */}
              <div className="flex items-center gap-2">
                <motion.button
                  whileHover={{ scale: canGenerate ? 1.02 : 1 }}
                  whileTap={{ scale: canGenerate ? 0.98 : 1 }}
                  onClick={handleGenerate}
                  disabled={!canGenerate}
                  className="n-focus-ring flex-1 inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-accent text-[13px] font-[600] text-white transition-colors hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isStreaming ? <Loader2 className="size-4 animate-spin" strokeWidth={2.5} /> : <Sparkles className="size-4" strokeWidth={2.5} />}
                  {isStreaming ? "در حال نوشتن..." : "بنویس برام"}
                </motion.button>
                <button onClick={fetchHashtags} disabled={!canGenerate || isGeneratingHashtags}
                  className="n-focus-ring inline-flex h-10 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-[12px] font-[600] text-ink-secondary hover:bg-surface-hover disabled:opacity-50">
                  {isGeneratingHashtags ? <Loader2 className="size-4 animate-spin" /> : <Hash className="size-4" />}
                  هشتگ بزن
                </button>
                {isStreaming && (
                  <button onClick={cancelStream} className="n-focus-ring inline-flex h-10 items-center justify-center rounded-lg border border-border bg-surface px-3 text-ink-tertiary hover:bg-surface-hover">
                    <X className="size-4" />
                  </button>
                )}
              </div>

              {/* Thinking indicator */}
              <AnimatePresence>
                {isThinking && (
                  <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="flex items-center gap-2 text-[12px] text-accent bg-accent-soft rounded-lg px-3 py-2">
                    <Loader2 className="size-3.5 animate-spin" />
                    <span>در حال تفکر و تدوین کپشن…</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Streaming / result */}
              <AnimatePresence mode="wait">
                {(streamedText || isStreaming) && !isThinking && (
                  <motion.div
                    key="caption-result"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.2 }}
                    className="n-card-compact p-3 bg-surface-subtle"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-[600] text-ink-tertiary uppercase tracking-wider">
                        {isStreaming ? "در حال تولید..." : `کپشن (${toPersianDigits(streamedText.length)} کاراکتر)`}
                      </span>
                      {isStreaming && <span className="inline-flex items-center gap-1 text-[10px] text-accent"><span className="size-1.5 rounded-full bg-accent animate-pulse" />زنده</span>}
                    </div>
                    <p className="text-[13px] text-ink-primary leading-relaxed whitespace-pre-wrap">
                      {streamedText}
                      {isStreaming && <span className="inline-block w-0.5 h-4 bg-accent ms-0.5 animate-pulse align-middle" />}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Action buttons after result */}
              <AnimatePresence>
                {hasResult && !isStreaming && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2 flex-wrap"
                  >
                    <button onClick={acceptCaption} className="n-focus-ring inline-flex h-9 items-center gap-1.5 rounded-lg bg-success px-3 text-[12px] font-[600] text-white hover:bg-success/90">
                      <Check className="size-3.5" strokeWidth={2.5} />درج در کپشن
                    </button>
                    <button onClick={handleRegenerate} className="n-focus-ring inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-[12px] font-[600] text-ink-secondary hover:bg-surface-hover">
                      <RefreshCw className="size-3.5" strokeWidth={2.5} />بازنویسی
                    </button>
                    <button onClick={copyCaption} className="n-focus-ring inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-[12px] font-[600] text-ink-secondary hover:bg-surface-hover">
                      <Copy className="size-3.5" strokeWidth={2.5} />کپی
                    </button>
                    <button onClick={saveDraft} disabled={isSavingDraft} className="n-focus-ring inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-[12px] font-[600] text-ink-secondary hover:bg-surface-hover disabled:opacity-50">
                      {isSavingDraft ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" strokeWidth={2.5} />}ذخیره
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Hashtags */}
              {hashtags.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="n-card-compact p-3 bg-surface-subtle"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-[600] text-ink-tertiary uppercase tracking-wider">هشتگ‌های پیشنهادی</span>
                    <button onClick={insertAllHashtags} className="text-[10px] text-accent font-[600] hover:underline">درج همه</button>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {hashtags.map((h, i) => (
                      <button key={i} onClick={() => appendHashtag(h.tag)} title={h.reason || undefined}
                        className={`inline-flex items-center text-[10px] font-[600] px-2 py-1 rounded-md border transition-colors ${appendedHashtags.has(h.tag) ? "bg-accent text-white border-accent" : "bg-surface border-border text-ink-secondary hover:bg-surface-hover"}`}>
                        {h.tag}
                        {appendedHashtags.has(h.tag) && <Check className="size-2.5 ms-1" strokeWidth={3} />}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </div>

            {/* Footer hint */}
            <div className="px-4 py-2 border-t border-border shrink-0">
              <p className="text-[10px] text-ink-tertiary text-center">
                کپشن‌ها با هوش مصنوعی تولید می‌شوند — قبل از انتشار بررسی کنید
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
