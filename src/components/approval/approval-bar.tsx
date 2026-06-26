"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Check, X, Send, Loader2 } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/api";

type ApprovalStatus = "draft" | "review" | "approved" | "rejected" | "scheduled" | "published" | "failed";

/** StatusBadge — colored pill showing content approval status */
export function ApprovalStatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    draft: { label: "پیش‌نویس", className: "text-ink-secondary bg-surface-hover border-border" },
    review: { label: "در حال بررسی", className: "text-warning bg-warning-soft border-warning/20" },
    approved: { label: "تأیید شده", className: "text-success bg-success-soft border-success/20" },
    rejected: { label: "رد شده", className: "text-danger bg-danger-soft border-danger/20" },
    scheduled: { label: "زمان‌بندی شده", className: "text-info bg-info-soft border-info/20" },
    published: { label: "منتشر شده", className: "text-success bg-success-soft border-success/20" },
    failed: { label: "ناموفق", className: "text-danger bg-danger-soft border-danger/20" },
  };

  const c = config[status] ?? config.draft;

  return (
    <span className={`inline-flex items-center text-[10px] font-[600] px-1.5 py-0.5 rounded-md border ${c.className}`}>
      {c.label}
    </span>
  );
}

/** ApprovalBar — action bar for submit/approve/reject with reason modal */
export function ApprovalBar({ contentId, status, rejectedReason }: { contentId: string; status: string; rejectedReason?: string | null }) {
  const queryClient = useQueryClient();
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const submitMutation = useMutation({
    mutationFn: () => api.post(`/api/content/${contentId}/submit-review`, {}),
    onSuccess: () => {
      toast.success("برای بررسی ارسال شد");
      queryClient.invalidateQueries({ queryKey: ["content"] });
      queryClient.invalidateQueries({ queryKey: ["content", contentId] });
    },
    onError: (err: any) => toast.error(err.message || "خطا در ارسال"),
  });

  const approveMutation = useMutation({
    mutationFn: () => api.post(`/api/content/${contentId}/approve`, {}),
    onSuccess: () => {
      toast.success("محتوا تأیید شد ✓");
      queryClient.invalidateQueries({ queryKey: ["content"] });
      queryClient.invalidateQueries({ queryKey: ["content", contentId] });
    },
    onError: (err: any) => toast.error(err.message || "خطا در تأیید"),
  });

  const rejectMutation = useMutation({
    mutationFn: () => api.post(`/api/content/${contentId}/reject`, { reason: rejectReason }),
    onSuccess: () => {
      toast.success("رد شد");
      setShowRejectModal(false);
      setRejectReason("");
      queryClient.invalidateQueries({ queryKey: ["content"] });
      queryClient.invalidateQueries({ queryKey: ["content", contentId] });
    },
    onError: (err: any) => toast.error(err.message || "خطا در رد"),
  });

  return (
    <div className="n-card-compact p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ApprovalStatusBadge status={status} />
          {status === "rejected" && (
            <span className="text-[11px] text-danger">نیاز به بازبینی</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Draft/Rejected → Submit for review */}
          {(status === "draft" || status === "rejected") && (
            <button
              onClick={() => submitMutation.mutate()}
              disabled={submitMutation.isPending}
              className="n-focus-ring inline-flex h-8 items-center gap-1.5 rounded-lg bg-warning px-3 text-[11.5px] font-[600] text-white transition-colors hover:bg-warning/90 disabled:opacity-50"
            >
              {submitMutation.isPending ? (
                <Loader2 className="size-3.5 animate-spin" strokeWidth={2.5} />
              ) : (
                <Send className="size-3.5" strokeWidth={2.5} />
              )}
              ارسال برای بررسی
            </button>
          )}

          {/* Review → Approve / Reject */}
          {status === "review" && (
            <>
              <button
                onClick={() => approveMutation.mutate()}
                disabled={approveMutation.isPending}
                className="n-focus-ring inline-flex h-8 items-center gap-1.5 rounded-lg bg-success px-3 text-[11.5px] font-[600] text-white transition-colors hover:bg-success/90 disabled:opacity-50"
              >
                {approveMutation.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" strokeWidth={2.5} />
                ) : (
                  <Check className="size-3.5" strokeWidth={2.5} />
                )}
                تأیید
              </button>
              <button
                onClick={() => setShowRejectModal(true)}
                className="n-focus-ring inline-flex h-8 items-center gap-1.5 rounded-lg border border-danger/20 bg-danger-soft px-3 text-[11.5px] font-[600] text-danger transition-colors hover:bg-danger/20"
              >
                <X className="size-3.5" strokeWidth={2.5} />
                رد
              </button>
            </>
          )}

          {/* Approved → ready to publish */}
          {status === "approved" && (
            <span className="text-[11px] text-success font-[600]">آماده انتشار ✓</span>
          )}
        </div>
      </div>

      {/* Rejection reason display */}
      {status === "rejected" && rejectedReason && (
        <div className="mt-2 rounded-lg border border-danger/20 bg-danger-soft px-3 py-2">
          <p className="text-[11px] text-danger">دلیل رد: {rejectedReason}</p>
        </div>
      )}

      {/* Reject reason modal */}
      <AnimatePresence>
        {showRejectModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
            onClick={() => setShowRejectModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className="n-card max-w-sm w-full mx-4 p-5"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-[14px] font-[700] text-ink-primary mb-3">دلیل رد محتوا</h3>
              <textarea
                dir="rtl"
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="مثلاً: لحن مناسب نیست، نیاز به ویرایش..."
                className="n-control w-full p-3 text-[12.5px] resize-none mb-3"
                autoFocus
              />
              <div className="flex items-center gap-2 justify-end">
                <button
                  onClick={() => setShowRejectModal(false)}
                  className="n-focus-ring h-8 rounded-lg border border-border bg-surface px-3 text-[11.5px] font-[600] text-ink-secondary hover:bg-surface-hover"
                >
                  انصراف
                </button>
                <button
                  onClick={() => rejectMutation.mutate()}
                  disabled={!rejectReason.trim() || rejectMutation.isPending}
                  className="n-focus-ring h-8 rounded-lg bg-danger px-3 text-[11.5px] font-[600] text-white hover:bg-danger/90 disabled:opacity-50"
                >
                  {rejectMutation.isPending ? "در حال رد..." : "رد کردن"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
