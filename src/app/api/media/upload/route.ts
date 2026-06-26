/**
 * POST /api/media/upload — real media upload with sharp processing.
 *
 * Accepts multipart/form-data with a `file` field.
 * Processes the image with sharp:
 *   - Generates a thumbnail (400x400, cropped)
 *   - Gets original dimensions
 *   - Saves both to /public/uploads/
 * Creates a Media record in the database.
 *
 * Supported: JPEG, PNG, WebP, GIF (static)
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireWorkspaceApi } from "@/lib/auth-guards";
import { validateParams, mediaUploadQuerySchema } from "@/lib/validations";
import sharp from "sharp";
import { randomUUID } from "crypto";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export async function POST(req: NextRequest) {
  const guard = await requireWorkspaceApi();
  if (guard.error) return guard.error;
  const workspaceId = guard.workspace.id;

  // Validate ?fileName= query string (max 200 chars, optional)
  const query = Object.fromEntries(req.nextUrl.searchParams.entries());
  const queryCheck = validateParams(mediaUploadQuerySchema, query);
  if (!queryCheck.success) {
    return NextResponse.json({ error: queryCheck.error }, { status: 400 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "فایلی ارسال نشده است" }, { status: 400 });
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `فرمت پشتیبانی نمی‌شود: ${file.type}. فقط JPEG, PNG, WebP, GIF` },
        { status: 400 },
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `حجم فایل نباید از ۱۰ مگابایت بیشتر باشد` },
        { status: 400 },
      );
    }

    // Ensure upload directory exists
    if (!existsSync(UPLOAD_DIR)) {
      await mkdir(UPLOAD_DIR, { recursive: true });
    }

    // Generate unique filename
    const fileId = randomUUID();
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const originalName = `${fileId}.${ext}`;
    const thumbName = `${fileId}_thumb.webp`;
    const originalPath = path.join(UPLOAD_DIR, originalName);
    const thumbPath = path.join(UPLOAD_DIR, thumbName);

    // Read file buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Save original file
    await writeFile(originalPath, buffer);

    // Process with sharp: generate thumbnail + get dimensions
    let width: number | null = null;
    let height: number | null = null;

    try {
      const metadata = await sharp(buffer).metadata();
      width = metadata.width ?? null;
      height = metadata.height ?? null;

      // Generate thumbnail (400x400, cover crop, WebP for smaller size)
      await sharp(buffer)
        .resize(400, 400, { fit: "cover", position: "center" })
        .webp({ quality: 80 })
        .toFile(thumbPath);
    } catch (sharpErr) {
      // If sharp fails (e.g., GIF animation), just use the original as thumbnail
      console.error("[media:upload] sharp error:", sharpErr);
    }

    // Public URLs
    const baseUrl = "/uploads";
    const fileUrl = `${baseUrl}/${originalName}`;
    const thumbUrl = `${baseUrl}/${thumbName}`;

    // Create Media record in DB
    const media = await db.media.create({
      data: {
        workspaceId,
        name: file.name,
        fileType: file.type,
        fileSize: file.size,
        url: fileUrl,
        thumbnailUrl: existsSync(thumbPath) ? thumbUrl : fileUrl,
        folder: "عمومی",
        width,
        height,
        tags: "",
      },
    });

    return NextResponse.json({
      id: media.id,
      name: media.name,
      fileType: media.fileType,
      fileSize: media.fileSize,
      url: media.url,
      thumbnail: media.thumbnailUrl ?? media.url,
      folder: media.folder,
      tags: [],
      width: media.width,
      height: media.height,
      createdAt: media.createdAt,
    }, { status: 201 });
  } catch (err: any) {
    console.error("[media:upload] error:", err);
    return NextResponse.json(
      { error: "خطا در آپلود فایل" },
      { status: 500 },
    );
  }
}
