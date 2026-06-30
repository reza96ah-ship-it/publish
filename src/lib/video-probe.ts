/**
 * Video duration/codec extraction + thumbnail frame generation. (Issue #146 follow-up)
 *
 * Uses ffprobe/ffmpeg from @ffprobe-installer/ffprobe + @ffmpeg-installer/ffmpeg —
 * these npm packages ship a prebuilt static binary per platform, so the worker
 * doesn't depend on a system-installed ffmpeg (works the same in CI/prod/dev).
 *
 * Used by /api/media/confirm for video uploads: extracts duration (ms) + codec
 * name via ffprobe, and a real JPEG thumbnail frame (seeked to ~1s) via ffmpeg.
 * Both are best-effort — a probe/thumbnail failure does not reject the upload,
 * it just leaves durationMs/codec/thumbnail null (caller decides what to do).
 */

import ffmpegPath from '@ffmpeg-installer/ffmpeg'
import ffprobePath from '@ffprobe-installer/ffprobe'
import ffmpeg from 'fluent-ffmpeg'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'

ffmpeg.setFfmpegPath(ffmpegPath.path)
ffmpeg.setFfprobePath(ffprobePath.path)

export interface VideoProbeResult {
  durationMs: number | null
  codec: string | null
  /** JPEG thumbnail bytes extracted from ~1s into the video, or null on failure. */
  thumbnail: Buffer | null
}

function extFor(detectedType: 'mp4' | 'mov' | 'webm'): string {
  if (detectedType === 'mov') return '.mov'
  if (detectedType === 'webm') return '.webm'
  return '.mp4'
}

/**
 * Probe a video buffer for duration/codec and generate a thumbnail frame.
 * Writes the buffer to a temp file because ffprobe/ffmpeg need a seekable
 * file (or a real stream) rather than an in-memory buffer.
 */
export async function probeVideo(
  buffer: Buffer,
  detectedType: 'mp4' | 'mov' | 'webm'
): Promise<VideoProbeResult> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'nashrino-video-'))
  const inputPath = path.join(tmpDir, `input${extFor(detectedType)}`)
  const thumbName = 'thumb.jpg'
  const thumbPath = path.join(tmpDir, thumbName)

  try {
    await fs.writeFile(inputPath, buffer)

    let durationMs: number | null = null
    let codec: string | null = null

    try {
      const metadata = await new Promise<ffmpeg.FfprobeData>((resolve, reject) => {
        ffmpeg.ffprobe(inputPath, (err: Error | null, data: ffmpeg.FfprobeData) =>
          err ? reject(err) : resolve(data)
        )
      })

      const durationSec = metadata?.format?.duration
      durationMs =
        typeof durationSec === 'number' && Number.isFinite(durationSec)
          ? Math.round(durationSec * 1000)
          : null

      const videoStream = (metadata?.streams ?? []).find(
        (s: ffmpeg.FfprobeStream) => s.codec_type === 'video'
      )
      codec = videoStream?.codec_name ?? null
    } catch (err) {
      console.error('[video-probe] ffprobe failed (non-fatal):', err)
    }

    let thumbnail: Buffer | null = null
    try {
      // Seek to 1s, or to 0 if the video is shorter than that.
      const seekSeconds = durationMs && durationMs > 1000 ? 1 : 0
      await new Promise<void>((resolve, reject) => {
        ffmpeg(inputPath)
          .on('end', () => resolve())
          .on('error', (err: Error) => reject(err))
          .screenshots({
            timestamps: [seekSeconds],
            filename: thumbName,
            folder: tmpDir,
            size: '400x?',
          })
      })
      thumbnail = await fs.readFile(thumbPath)
    } catch (err) {
      console.error('[video-probe] thumbnail extraction failed (non-fatal):', err)
    }

    return { durationMs, codec, thumbnail }
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
  }
}
