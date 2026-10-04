import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const MAX_PHOTO_BYTES = 1_000_000

export function instagramPhotoTarget(sourceUrl: string): { url: string; host: string } | null {
  try {
    const source = new URL(sourceUrl)
    const host = source.hostname.toLowerCase()
    if (source.protocol !== 'https:' || source.port || source.username || source.password) return null
    if (!host.endsWith('.cdninstagram.com')) return null

    // The current V2ray tunnel can reach www.instagram.com but direct TLS to
    // cdninstagram.com stalls. Meta serves the signed CDN path when the HTTP
    // Host is the original CDN hostname, while TLS stays on www.instagram.com.
    return { url: `https://www.instagram.com${source.pathname}${source.search}`, host }
  } catch {
    return null
  }
}

export function photoContentType(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  if (bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((byte, i) => bytes[i] === byte)) return 'image/png'
  if (bytes.length >= 12 && Buffer.from(bytes.subarray(0, 4)).toString() === 'RIFF' && Buffer.from(bytes.subarray(8, 12)).toString() === 'WEBP') return 'image/webp'
  return null
}

export async function fetchInstagramPhotoThroughProxy(
  sourceUrl: string,
  proxyUrl: string,
): Promise<{ bytes: Uint8Array; contentType: string }> {
  const target = instagramPhotoTarget(sourceUrl)
  if (!target) throw new Error('Unsupported Instagram photo host')

  const proxy = new URL(proxyUrl)
  if (proxy.protocol !== 'http:') throw new Error('Instagram image proxy must be HTTP')

  const { stdout } = await execFileAsync('curl', [
    '--silent', '--show-error', '--fail',
    '--connect-timeout', '5', '--max-time', '20',
    '--max-filesize', String(MAX_PHOTO_BYTES),
    '--proto', '=https',
    '--proxy', proxy.toString(),
    '--header', `Host: ${target.host}`,
    target.url,
  ], {
    encoding: 'buffer',
    maxBuffer: MAX_PHOTO_BYTES + 4096,
    timeout: 22_000,
    windowsHide: true,
  })

  const bytes = new Uint8Array(stdout)
  if (bytes.length === 0 || bytes.length > MAX_PHOTO_BYTES) throw new Error('Invalid Instagram photo size')
  const contentType = photoContentType(bytes)
  if (!contentType) throw new Error('Invalid Instagram photo format')
  return { bytes, contentType }
}
