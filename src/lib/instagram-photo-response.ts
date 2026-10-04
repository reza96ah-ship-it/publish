import { NextResponse } from 'next/server'
import { fetchInstagramPhotoThroughProxy, instagramPhotoTarget } from '@/lib/zernio-photo'

export async function photoResponse(picture: string, proxyUrl: string): Promise<NextResponse> {
  const { bytes, contentType } = await fetchInstagramPhotoThroughProxy(picture, proxyUrl)
  const body = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(body).set(bytes)
  return new NextResponse(body, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'private, max-age=900',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

export function storedAuthorPicture(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null
  const picture = (payload as Record<string, unknown>).authorPicture
  return typeof picture === 'string' && instagramPhotoTarget(picture) ? picture : null
}
