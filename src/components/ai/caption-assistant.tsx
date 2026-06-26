"use client";

import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Send, Loader2, Check, X, Hash } from "lucide-react";
import { toast } from "sonner";

type Platform = "instagram" | "telegram" | "linkedin" | "rubika" | "bale" | "eitaa";
type Tone = "formal" | "friendly" | "playful" | "professional";

const TONES: { id: Tone; label: string; emoji: string }[] = [
  { id: "friendly", label: "دوستانه", emoji: "😊" },
  { id: "formal", label: "رسمی", emoji: "🎩" },
  { id: "playful", label: "شاد", emoji: "🎉" },
  { id: "professional", label: "حرفه‌ای", emoji: "💼" },
];

interface CaptionAssistantProps {
  platform: Platform;
  topic: string;
  onInsert: (text: string) => void;
  onHashtags?: (hashtags: string[]) => void;
}

/**
 * CaptionAssistant — Persian AI caption generator with streaming UI.
 *
 * Per R3 research: streaming text display (ChatGPT-style), accept/edit/reject
 * pattern, and hashtag suggestion button.
 *
 * Usage: mount inside the Compose editor. When the user types a topic and
 * clicks "تولید با هوش مصنوعی", the AI streams a Persian caption that the
 * user can accept (insert into editor), reject, or regenerate.
 */
export function CaptionAssistant({ platform, topic, onInsert, onHashtags }: CaptionAssistantProps) {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamedText, setStreamedText] = useState("");
  const [hasResult, setHasResult] = useState(false);
  const [isGeneratingHashtags, setIsGeneratingHashtags] = useState(false);
  const [selectedTone, setSelectedTone] = useState<Tone>("friendly");
  const abortRef = useRef<AbortController | null>(null);

  const generateCaption = useCallback(async () => {
    if (!topic.trim() || topic.trim().length < 3) {
      toast.error("ابتدا موضوع را بنویسید (حداقل ۳ کاراکتر)");
      return;
    }

    setIsStreaming(true);
    setStreamedText("");
    setHasResult(false);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/ai/caption", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, platform, tone: selectedTone }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "خطای ناشناخته" }));
        toast.error(err.error || "خطا در تولید کپشن");
        setIsStreaming(false);
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
            if (line.startsWith("data: ")) {
              const jsonStr = line.slice(6).trim();
              if (jsonStr === "[DONE]") {
                setIsStreaming(false);
                setHasResult(true);
                break;
              }
              try {
                const json = JSON.parse(jsonStr);
                if (json.content) {
                  fullText += json.content;
                  setStreamedText(fullText);
                }
                if (json.error) {
                  toast.error(json.error);
                  setIsStreaming(false);
                  return;
                }
              } catch {
                // Skip malformed JSON
              }
            }
          }
        }
      }

      if (!fullText) {
        toast.error("کپشن خالی تولید شد. دوباره تلاش کنید.");
        setIsStreaming(false);
      }
    } catch (err: any) {
      if (err.name === "AbortError") {
        // User cancelled — keep partial text
      } else {
        toast.error("خطا در ارتباط با سرور هوش مصنوعی");
      }
      setIsStreaming(false);
      setHasResult(!!streamedText);
    }
  }, [topic, platform, selectedTone, streamedText]);

  const cancelStream = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
    setHasResult(!!streamedText);
  }, [streamedText]);

  const acceptCaption = useCallback(() => {
    onInsert(streamedText);
    toast.success("کپشن در ادیتور قرار گرفت");
    setStreamedText("");
    setHasResult(false);
  }, [streamedText, onInsert]);

  const rejectCaption = useCallback(() => {
    setStreamedText("");
    setHasResult(false);
  }, []);

  const generateHashtags = useCallback(async () => {
    if (!topic.trim()) {
      toast.error("ابتدا موضوع را بنویسید");
      return;
    }
    setIsGeneratingHashtags(true);
    try {
      const res = await fetch("/api/ai/hashtags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, platform }),
      });
      const data = await res.json();
      if (data.error) {
        toast.error(data.error);
      } else if (data.hashtags?.length) {
        onHashtags?.(data.hashtags);
        toast.success(`${data.hashtags.length} هشتگ پیشنهادی آماده شد`);
      }
    } catch {
      toast.error("خطا در تولید هشتگ");
    } finally {
      setIsGeneratingHashtags(false);
    }
  }, [topic, platform, onHashtags]);

  const canGenerate = topic.trim().length >= 3 && !isStreaming;

  return (
    <div className="n-card-compact p-3">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="size-4 text-accent" strokeWidth={2} />
        <span className="text-[12px] font-[600] text-ink-primary">دستیار هوش مصنوعی</span>
      </div>

      {/* Tone selector */}
      <div className="mb-2.5">
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className="text-[10.5px] font-[600] text-ink-tertiary">لحن کپشن:</span>
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {TONES.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelectedTone(t.id)}
              disabled={isStreaming}
              className={
                "n-focus-ring inline-flex h-7 items-center gap-1 rounded-md px-2.5 text-[11px] font-[600] transition-colors disabled:opacity-50 disabled:cursor-not-allowed " +
                (selectedTone === t.id
                  ? "bg-accent text-white"
                  : "border border-border bg-surface text-ink-secondary hover:bg-surface-hover hover:text-ink-primary")
              }
              aria-pressed={selectedTone === t.id}
            >
              <span>{t.emoji}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={generateCaption}
          disabled={!canGenerate}
          className="n-focus-ring inline-flex h-8 items-center gap-1.5 rounded-lg bg-accent px-3 text-[11.5px] font-[600] text-white transition-colors hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isStreaming ? (
            <Loader2 className="size-3.5 animate-spin" strokeWidth={2.5} />
          ) : (
            <Sparkles className="size-3.5" strokeWidth={2.5} />
          )}
          {isStreaming ? "در حال نوشتن..." : "تولید کپشن"}
        </button>

        <button
          onClick={generateHashtags}
          disabled={!canGenerate || isGeneratingHashtags}
          className="n-focus-ring inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-[11.5px] font-[600] text-ink-secondary transition-colors hover:bg-surface-hover hover:text-ink-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isGeneratingHashtags ? (
            <Loader2 className="size-3.5 animate-spin" strokeWidth={2.5} />
          ) : (
            <Hash className="size-3.5" strokeWidth={2.5} />
          )}
          هشتگ‌های پیشنهادی
        </button>

        {isStreaming && (
          <button
            onClick={cancelStream}
            className="n-focus-ring inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-[11.5px] font-[600] text-ink-tertiary transition-colors hover:bg-surface-hover"
          >
            <X className="size-3.5" strokeWidth={2.5} />
            توقف
          </button>
        )}
      </div>

      {/* Streaming / result display */}
      <AnimatePresence mode="wait">
        {(streamedText || isStreaming) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: [0, 0, 0.2, 1] }}
            className="mt-3 overflow-hidden"
          >
            <div className="n-card-compact p-3 bg-surface-subtle">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-[600] text-ink-tertiary uppercase tracking-wider">
                  {isStreaming ? "در حال تولید..." : "کپشن پیشنهادی"}
                </span>
                {isStreaming && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-accent">
                    <span className="size-1.5 rounded-full bg-accent animate-pulse" />
                    زنده
                  </span>
                )}
              </div>
              <p className="text-[12.5px] text-ink-primary leading-relaxed whitespace-pre-wrap">
                {streamedText}
                {isStreaming && (
                  <span className="inline-block w-0.5 h-4 bg-accent ms-0.5 animate-pulse align-middle" />
                )}
              </p>
            </div>

            {/* Accept / Reject actions */}
            {hasResult && !isStreaming && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 mt-2"
              >
                <button
                  onClick={acceptCaption}
                  className="n-focus-ring inline-flex h-8 items-center gap-1.5 rounded-lg bg-success px-3 text-[11.5px] font-[600] text-white transition-colors hover:bg-success/90"
                >
                  <Check className="size-3.5" strokeWidth={2.5} />
                  قبول و درج
                </button>
                <button
                  onClick={rejectCaption}
                  className="n-focus-ring inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-[11.5px] font-[600] text-ink-tertiary transition-colors hover:bg-surface-hover"
                >
                  <X className="size-3.5" strokeWidth={2.5} />
                  رد
                </button>
                <button
                  onClick={generateCaption}
                  className="n-focus-ring inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-[11.5px] font-[600] text-ink-secondary transition-colors hover:bg-surface-hover"
                >
                  <Send className="size-3.5" strokeWidth={2.5} />
                  دوباره
                </button>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
