import { describe, it, expect, beforeAll } from 'vitest'
import { execFile } from 'child_process'
import { promisify } from 'util'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { probeVideo } from '@/lib/video-probe'

const execFileAsync = promisify(execFile)

/**
 * Issue #146 follow-up: real end-to-end test against the system ffmpeg/ffprobe
 * binaries (installed via apt in CI/Docker — see .github/workflows/ci.yml and
 * Dockerfile). Generates a tiny synthetic 2s MP4 with ffmpeg's "testsrc" pattern
 * (no fixture file needed) and verifies probeVideo() extracts a sane duration,
 * a codec name, and a non-empty JPEG thumbnail.
 *
 * Skips (rather than fails) when ffmpeg isn't on PATH, so this suite doesn't
 * block local development on machines without ffmpeg installed — probeVideo()
 * itself is designed to degrade gracefully (non-fatal null fields) in that case.
 */
let ffmpegAvailable = true

beforeAll(async () => {
  try {
    await execFileAsync(process.env.FFMPEG_BIN || 'ffmpeg', ['-version'])
  } catch {
    ffmpegAvailable = false
    console.warn('[video-probe.test] ffmpeg not found on PATH — skipping real-binary assertions')
  }
})

async function makeTestVideo(): Promise<Buffer> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'nashrino-video-test-'))
  const outPath = path.join(tmpDir, 'test.mp4')
  await execFileAsync(process.env.FFMPEG_BIN || 'ffmpeg', [
    '-y',
    '-f', 'lavfi',
    '-i', 'testsrc=duration=2:size=64x64:rate=10',
    '-pix_fmt', 'yuv420p',
    outPath,
  ])
  const buf = await fs.readFile(outPath)
  await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
  return buf
}

describe('Issue #146 follow-up — video-probe (system ffprobe/ffmpeg)', () => {
  it('extracts duration, codec, and a thumbnail from a real mp4', async () => {
    if (!ffmpegAvailable) {
      console.warn('[video-probe.test] skipped: ffmpeg not installed in this environment')
      return
    }

    const video = await makeTestVideo()
    const result = await probeVideo(video, 'mp4')

    expect(result.durationMs).not.toBeNull()
    expect(result.durationMs).toBeGreaterThan(1500) // ~2000ms, allow encoder slack
    expect(result.durationMs).toBeLessThan(3000)

    expect(result.codec).toBe('h264')

    expect(result.thumbnail).not.toBeNull()
    expect(result.thumbnail?.length ?? 0).toBeGreaterThan(0)
    // JPEG magic bytes: FF D8 FF
    const thumb = result.thumbnail as Buffer
    expect(thumb[0]).toBe(0xff)
    expect(thumb[1]).toBe(0xd8)
    expect(thumb[2]).toBe(0xff)
  }, 30_000)

  it('returns null fields (non-fatal) when the binary is missing', async () => {
    const result = await probeVideo(Buffer.from('not a real video'), 'mp4', )
    if (ffmpegAvailable) {
      // Real ffmpeg/ffprobe will run but fail to parse garbage bytes — still non-fatal.
      expect(result.durationMs === null || typeof result.durationMs === 'number').toBe(true)
    } else {
      expect(result.durationMs).toBeNull()
      expect(result.codec).toBeNull()
      expect(result.thumbnail).toBeNull()
    }
  })
})
