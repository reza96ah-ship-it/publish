"use client";

import { useState, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { UploadCloud, Loader2, Check, X, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { toPersianDigits } from "@/lib/jalali";

interface MediaUploaderProps {
  onUploaded: (media: UploadedMedia) => void;
  selectedMedia: SelectedMedia[];
  onToggle: (media: SelectedMedia) => void;
  existingMedia: ExistingMedia[];
}

interface UploadedMedia {
  id: string;
  name: string;
  url: string;
  thumbnail: string;
  width: number | null;
  height: number | null;
}

interface SelectedMedia {
  id: string;
  name: string;
  thumbnail: string;
}

interface ExistingMedia {
  id: string;
  name: string;
  thumbnail: string;
}

/**
 * MediaUploader — drag-drop + click-to-upload + media library grid.
 *
 * Features:
 * - Drag & drop image upload (JPEG, PNG, WebP, GIF)
 * - Click to browse files
 * - Upload progress indicator
 * - Sharp thumbnail generation (server-side)
 * - Media library grid (existing + newly uploaded)
 * - Select/deselect media for the post
 * - Max 10 images per post (IG carousel limit)
 */
export function MediaUploader({ onUploaded, selectedMedia, onToggle, existingMedia }: MediaUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedMedia[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const handleUpload = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (fileArray.length === 0) {
      toast.error("فقط فایل تصویری قابل آپلود است");
      return;
    }

    setIsUploading(true);

    for (const file of fileArray) {
      try {
        // P9.1: Presigned URL flow — bypasses Next.js body limit
        // Step 1: Get presigned URL from server
        const presignRes = await fetch("/api/media/presign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size,
          }),
        });

        if (!presignRes.ok) {
          const err = await presignRes.json().catch(() => ({ error: "خطا در آماده‌سازی آپلود" }));
          toast.error(err.error || `آپلود ناموفق: ${file.name}`);
          continue;
        }

        const { uploadUrl, key, mediaId } = await presignRes.json();

        // Step 2: Upload directly to S3 (or local-upload in dev)
        const uploadRes = await fetch(uploadUrl, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type },
        });

        if (!uploadRes.ok) {
          toast.error(`آپلود ناموفق: ${file.name}`);
          continue;
        }

        // Step 3: Confirm upload + validate magic bytes
        const confirmRes = await fetch("/api/media/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mediaId, key }),
        });

        if (!confirmRes.ok) {
          const err = await confirmRes.json().catch(() => ({ error: "اعتبارسنجی ناموفق" }));
          toast.error(err.error || `فایل نامعتبر: ${file.name}`);
          continue;
        }

        const data = await confirmRes.json();
        const media = data.media;
        setUploadedFiles((prev) => [...prev, media]);
        onUploaded(media);
        toast.success(`${file.name} آپلود شد ✓`);
      } catch (err) {
        toast.error(`خطا در آپلود: ${file.name}`);
      }
    }

    // Refresh media library query
    queryClient.invalidateQueries({ queryKey: ["media"] });

    setIsUploading(false);
  }, [onUploaded, queryClient]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    handleUpload(e.dataTransfer.files);
  }, [handleUpload]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleUpload(e.target.files);
      // Reset input so the same file can be selected again
      e.target.value = "";
    }
  }, [handleUpload]);

  // Combine existing + newly uploaded media (deduped by id)
  const allMedia = [...existingMedia, ...uploadedFiles.filter(
    (u) => !existingMedia.some((e) => e.id === u.id)
  ).map((u) => ({ id: u.id, name: u.name, thumbnail: u.thumbnail }))];

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "relative rounded-xl border-2 border-dashed p-6 text-center cursor-pointer transition-all",
          isDragging
            ? "border-accent bg-accent-soft"
            : "border-border bg-surface-subtle hover:border-border-strong hover:bg-surface-hover",
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          aria-label="آپلود فایل تصویری"
        />

        {isUploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="size-8 text-accent animate-spin" strokeWidth={2} />
            <p className="text-[12px] text-ink-secondary">در حال آپلود…</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className={cn(
              "flex size-10 items-center justify-center rounded-full transition-colors",
              isDragging ? "bg-accent text-white" : "bg-surface-hover text-ink-tertiary",
            )}>
              <UploadCloud className="size-5" strokeWidth={2} />
            </div>
            <div>
              <p className="text-[12px] font-[600] text-ink-secondary">
                {isDragging ? "فایل را اینجا رها کنید" : "تصویر را اینجا بکشید یا کلیک کنید"}
              </p>
              <p className="text-[10px] text-ink-tertiary mt-0.5">
                JPEG, PNG, WebP, GIF — حداکثر ۱۰ مگابایت
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Selected media count */}
      {selectedMedia.length > 0 && (
        <div className="flex items-center gap-2 text-[11px] text-ink-tertiary">
          <Check className="size-3.5 text-success" strokeWidth={2.5} />
          <span>{toPersianDigits(selectedMedia.length)} رسانه انتخاب شده</span>
        </div>
      )}

      {/* Media grid (existing + uploaded) */}
      {allMedia.length > 0 && (
        <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 max-h-[200px] overflow-y-auto thin-scrollbar p-1">
          {allMedia.map((m) => {
            const isSelected = selectedMedia.some((s) => s.id === m.id);
            return (
              <button
                key={m.id}
                onClick={() => onToggle({
                  id: m.id,
                  name: m.name,
                  thumbnail: m.thumbnail,
                })}
                className={cn(
                  "relative aspect-square rounded-lg overflow-hidden border-2 transition-all group",
                  isSelected
                    ? "border-accent ring-2 ring-accent/20"
                    : "border-transparent hover:border-border",
                )}
              >
                <img
                  src={m.thumbnail}
                  alt={m.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                {isSelected && (
                  <div className="absolute inset-0 bg-accent/20 flex items-center justify-center">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="flex size-5 items-center justify-center rounded-full bg-accent"
                    >
                      <Check className="size-3 text-white" strokeWidth={3} />
                    </motion.div>
                  </div>
                )}
                {/* Hover overlay with name */}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <p className="text-[8px] text-white truncate">{m.name}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {allMedia.length === 0 && !isUploading && (
        <div className="flex items-center justify-center py-4 text-[11px] text-ink-tertiary">
          <ImageIcon className="size-4 ms-1 opacity-50" />
          <span className="ms-1">هنوز رسانه‌ای آپلود نشده است</span>
        </div>
      )}
    </div>
  );
}
