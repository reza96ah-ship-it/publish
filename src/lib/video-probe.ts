/**
 * Video duration/codec extraction + thumbnail frame generation. (Issue #146 follow-up)
 *
 * Shells out to a system-installed `ffprobe`/`ffmpeg` (binary name/path configurable
 * via FFPROBE_BIN/FFMPEG_BIN, default "ffprobe"/"ffmpeg" resolved from PATH).
 *
 * A prebuilt-binary npm package (e.g. @ffprobe-installer/ffprobe) was tried first and
 * rejected: its Windows platform package is GPL-3.0-licensed (fails this repo's
 * blocking license-checker CI gate), and the installer's dynamic `require()` of a
 * platform-specific subpackage cannot be statically bundled by Next.js's route
 * compiler ("Module not found" at build time). Shelling out to a system binary avoids
 * both problems — the binary is installed via the OS package manager (apt, in
 * Dockerfile and CI), never bundled into the JS output.
 *
 * Used by /api/media/confirm for video uploads: extracts duration (ms) + codec
 * name via ffprobe, and a real JPEG thumbnail frame (seeked to ~1s) via ffmpeg.
 * Both are best-effort — a probe/thumbnail failure (including ffmpeg/ffprobe not
 * being installed) does not reject the upload, it just leaves durationMs/codec/
 * thumbnail null (caller decides what to do).
 */

import { execFile } from 'child_process'
import { promisify } from 'util'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'

const execFileAsync = promisify(execFile)

const FFPROBE_BIN = process.env.FFPROBE_BIN || 'ffprobe'
const FFMPEG_BIN = process.env.FFMPEG_BIN || 'ffmpeg'
const PROBE_TIMEOUT_MS = 15_000

export interface VideoProbeResult {
  durationMs: number | null
  codec: string | null
  /** JPEG thumbnail bytes extracted from ~1s into the video, or null on failure. */
  thumbnail: Buffer | null
}

interface FfprobeStream {
  codec_type?: string
  codec_name?: string
}

interface FfprobeOutput {
  format?: { duration?: string }
  streams?: FfprobeStream[]
}

function extFor(detectedType: 'mp4' | 'mov' | 'webm'): string {
  if (detectedType === 'mov') return '.mov'
  if (detectedType === 'webm') return '.webm'
  return '.mp4'
}

async function runFfprobe(inputPath: string): Promise<{ durationMs: number | null; codec: string | null }> {
  const { stdout } = await execFileAsync(
    FFPROBE_BIN,
    ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', inputPath],
    { timeout: PROBE_TIMEOUT_MS, maxBuffer: 10 * 1024 * 1024 }
  )

  const data = JSON.parse(stdout) as FfprobeOutput

  const durationSec = data.format?.duration ? parseFloat(data.format.duration) : NaN
  const durationMs = Number.isFinite(durationSec) ? Math.round(durationSec * 1000) : null

  const videoStream = (data.streams ?? []).find((s) => s.codec_type === 'video')
  const codec = videoStream?.codec_name ?? null

  return { durationMs, codec }
}

async function runFfmpegThumbnail(
  inputPath: string,
  thumbPath: string,
  seekSeconds: number
): Promise<void> {
  await execFileAsync(
    FFMPEG_BIN,
    [
      '-y',
      '-ss', String(seekSeconds),
      '-i', inputPath,
      '-frames:v', '1',
      '-vf', 'scale=400:-1',
      '-q:v', '4',
      thumbPath,
    ],
    { timeout: PROBE_TIMEOUT_MS }
  )
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
  const thumbPath = path.join(tmpDir, 'thumb.jpg')

  try {
    await fs.writeFile(inputPath, buffer)

    let durationMs: number | null = null
    let codec: string | null = null

    try {
      const probed = await runFfprobe(inputPath)
      durationMs = probed.durationMs
      codec = probed.codec
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[video-probe] ffprobe failed (non-fatal):', err)
    }

    let thumbnail: Buffer | null = null
    try {
      // Seek to 1s, or to 0 if the video is shorter than that.
      const seekSeconds = durationMs && durationMs > 1000 ? 1 : 0
      await runFfmpegThumbnail(inputPath, thumbPath, seekSeconds)
      thumbnail = await fs.readFile(thumbPath)
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[video-probe] thumbnail extraction failed (non-fatal):', err)
    }

    return { durationMs, codec, thumbnail }
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
  }
}
