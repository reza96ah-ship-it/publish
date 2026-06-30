import { describe, it, expect } from 'vitest'
import ffmpegPath from '@ffmpeg-installer/ffmpeg'
import ffmpeg from 'fluent-ffmpeg'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { probeVideo } from '@/lib/video-probe'

ffmpeg.setFfmpegPath(ffmpegPath.path)

/**
 * Issue #146 follow-up: real end-to-end test against the prebuilt ffmpeg/ffprobe
 * binaries. Generates a tiny synthetic 2s MP4 with ffmpeg's "testsrc" pattern
 * (no fixture file needed) and verifies probeVideo() extracts a sane duration,
 * a codec name, and a non-empty JPEG thumbnail.
 */
async function makeTestVideo(): Promise<Buffer> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'nashrino-video-test-'))
  const outPath = path.join(tmpDir, 'test.mp4')
  await new Promise<void>((resolve, reject) => {
    ffmpeg()
      .input('testsrc=duration=2:size=64x64:rate=10')
      .inputFormat('lavfi')
      .outputOptions(['-pix_fmt yuv420p'])
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .save(outPath)
  })
  const buf = await fs.readFile(outPath)
  await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
  return buf
}

describe('Issue #146 follow-up — video-probe (ffprobe/ffmpeg)', () => {
  it('extracts duration, codec, and a thumbnail from a real mp4', async () => {
    const video = await makeTestVideo()
    const result = await probeVideo(video, 'mp4')

    expect(result.durationMs).not.toBeNull()
    expect(result.durationMs).toBeGreaterThan(1500) // ~2000ms, allow encoder slack
    expect(result.durationMs).toBeLessThan(3000)

    expect(result.codec).toBe('h264')

    expect(result.thumbnail).not.toBeNull()
    expect(result.thumbnail!.length).toBeGreaterThan(0)
    // JPEG magic bytes: FF D8 FF
    expect(result.thumbnail![0]).toBe(0xff)
    expect(result.thumbnail![1]).toBe(0xd8)
    expect(result.thumbnail![2]).toBe(0xff)
  }, 30_000)
})
