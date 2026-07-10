import { createHmac, timingSafeEqual } from 'crypto'

export const INSTAGRAM_WEBHOOK_VERIFY_TOKEN_ENV = 'INSTAGRAM_WEBHOOK_VERIFY_TOKEN'
export const INSTAGRAM_APP_SECRET_ENV = 'INSTAGRAM_APP_SECRET'

type EnvLike = Record<string, string | undefined>

type ChallengeResult =
  | { ok: true; challenge: string }
  | { ok: false; status: 400 | 403 | 503; error: string }

type SignatureResult = { ok: true } | { ok: false; status: 401 | 503; error: string }

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8')
  const bufB = Buffer.from(b, 'utf8')
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

export function verifyInstagramWebhookChallenge(
  params: URLSearchParams,
  env: EnvLike = process.env
): ChallengeResult {
  const mode = params.get('hub.mode')
  const token = params.get('hub.verify_token')
  const challenge = params.get('hub.challenge')
  const expectedToken = env[INSTAGRAM_WEBHOOK_VERIFY_TOKEN_ENV]

  if (mode !== 'subscribe' || !token || !challenge) {
    return { ok: false, status: 400, error: 'invalid_instagram_webhook_challenge' }
  }
  if (!expectedToken) {
    return { ok: false, status: 503, error: 'instagram_webhook_verify_token_missing' }
  }
  if (!safeEqual(token, expectedToken)) {
    return { ok: false, status: 403, error: 'instagram_webhook_verify_token_mismatch' }
  }

  return { ok: true, challenge }
}

export function signInstagramWebhookBody(rawBody: string, appSecret: string): string {
  const digest = createHmac('sha256', appSecret).update(rawBody, 'utf8').digest('hex')
  return `sha256=${digest}`
}

export function verifyInstagramWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  env: EnvLike = process.env
): SignatureResult {
  const appSecret = env[INSTAGRAM_APP_SECRET_ENV]
  if (!appSecret) {
    return { ok: false, status: 503, error: 'instagram_app_secret_missing' }
  }
  if (!signatureHeader?.startsWith('sha256=')) {
    return { ok: false, status: 401, error: 'instagram_signature_missing' }
  }

  const expected = signInstagramWebhookBody(rawBody, appSecret)
  if (!safeEqual(signatureHeader, expected)) {
    return { ok: false, status: 401, error: 'instagram_signature_invalid' }
  }

  return { ok: true }
}

export function summarizeInstagramWebhookPayload(payload: unknown) {
  const parsed = payload as { object?: unknown; entry?: unknown }
  return {
    object: typeof parsed.object === 'string' ? parsed.object : null,
    entryCount: Array.isArray(parsed.entry) ? parsed.entry.length : 0,
  }
}
