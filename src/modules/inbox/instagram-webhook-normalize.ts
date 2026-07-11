import { INSTAGRAM_INBOX_API_LIMITS } from '../../../shared/instagram-graph'

export type NormalizedInstagramAttachment = {
  type: string
  title: string
  url: string | null
  providerId: string | null
}

export type NormalizedInstagramInboxEvent = {
  providerAccountId: string
  providerThreadId: string
  providerMessageId: string
  providerUserId: string | null
  senderName: string
  body: string
  messageType: 'comment' | 'dm' | 'mention'
  createdAt: Date
  attachments: NormalizedInstagramAttachment[]
  providerLimits: {
    privateReplyWindowDays: number
    conversationMessageReadLimit: number
    commentListLimit: number
  }
  payload: unknown
}

type UnknownRecord = Record<string, unknown>

function asRecord(value: unknown): UnknownRecord | null {
  return value && typeof value === 'object' ? (value as UnknownRecord) : null
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

function numberValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function normalizedType(value: unknown, fallback = 'attachment'): string {
  const text = stringValue(value)?.toLowerCase().replace(/[^a-z0-9:_-]+/g, '_')
  return text || fallback
}

function titleForAttachmentType(type: string): string {
  const normalized = normalizedType(type)
  const labels: Record<string, string> = {
    audio: 'Audio',
    file: 'File',
    ig_post: 'Instagram post',
    image: 'Image',
    location: 'Location',
    media: 'Media',
    mention_media: 'Mentioned media',
    postback: 'Postback',
    reel: 'Reel',
    share: 'Shared post',
    sticker: 'Sticker',
    story: 'Story',
    video: 'Video',
  }
  return labels[normalized] ?? 'Attachment'
}

function dateFromProvider(value: unknown): Date {
  const numeric = numberValue(value)
  if (numeric !== null) {
    return new Date(numeric > 10_000_000_000 ? numeric : numeric * 1000)
  }

  const text = stringValue(value)
  if (text) {
    const parsed = new Date(text)
    if (!Number.isNaN(parsed.getTime())) return parsed
  }

  return new Date()
}

function normalizeAttachmentRecord(
  value: unknown,
  fallbackType = 'attachment'
): NormalizedInstagramAttachment | null {
  const record = asRecord(value)
  if (!record) return null

  const payload = asRecord(record.payload)
  const type = normalizedType(record.type ?? payload?.type, fallbackType)
  const url =
    stringValue(payload?.url) ??
    stringValue(payload?.media_url) ??
    stringValue(payload?.thumbnail_url) ??
    stringValue(record.url) ??
    stringValue(record.media_url) ??
    null
  const providerId =
    stringValue(payload?.id) ??
    stringValue(payload?.sticker_id) ??
    stringValue(record.id) ??
    stringValue(record.media_id) ??
    null
  const title = stringValue(record.title) ?? titleForAttachmentType(type)

  return { type, title, url, providerId }
}

function normalizeCommentAttachments(value: UnknownRecord, field: string): NormalizedInstagramAttachment[] {
  const attachments: NormalizedInstagramAttachment[] = []
  const media = asRecord(value.media) ?? asRecord(value.media_object)
  if (media) {
    const mediaType =
      field.includes('mention') && !stringValue(media.media_type)
        ? 'mention_media'
        : normalizedType(media.media_type ?? media.type, 'media')
    attachments.push({
      type: mediaType,
      title: titleForAttachmentType(mediaType),
      url:
        stringValue(media.permalink) ??
        stringValue(media.media_url) ??
        stringValue(media.thumbnail_url) ??
        null,
      providerId: stringValue(media.id) ?? stringValue(value.media_id) ?? null,
    })
  } else if (stringValue(value.media_id) || stringValue(value.media_url)) {
    const type = field.includes('mention') ? 'mention_media' : 'media'
    attachments.push({
      type,
      title: titleForAttachmentType(type),
      url: stringValue(value.media_url),
      providerId: stringValue(value.media_id),
    })
  }

  return attachments
}

function normalizeMessagingAttachments(message: UnknownRecord | null): NormalizedInstagramAttachment[] {
  const rawAttachments = Array.isArray(message?.attachments) ? message.attachments : []
  return rawAttachments
    .map((attachment) => normalizeAttachmentRecord(attachment))
    .filter((attachment): attachment is NormalizedInstagramAttachment => Boolean(attachment))
}

function normalizePostbackAttachment(postback: UnknownRecord | null): NormalizedInstagramAttachment[] {
  if (!postback) return []
  return [
    {
      type: 'postback',
      title: stringValue(postback.title) ?? 'Postback',
      url: null,
      providerId: stringValue(postback.payload) ?? stringValue(postback.mid) ?? null,
    },
  ]
}

function summarizeAttachments(attachments: NormalizedInstagramAttachment[]): string {
  if (attachments.length === 0) return ''
  if (attachments.length === 1) {
    return `Instagram ${attachments[0]?.title.toLowerCase() ?? 'attachment'} attachment`
  }
  return `Instagram ${attachments[0]?.title.toLowerCase() ?? 'attachment'} + ${
    attachments.length - 1
  } more`
}

function providerLimits() {
  return {
    privateReplyWindowDays: INSTAGRAM_INBOX_API_LIMITS.privateReplyWindowDays,
    conversationMessageReadLimit: INSTAGRAM_INBOX_API_LIMITS.conversationMessageReadLimit,
    commentListLimit: INSTAGRAM_INBOX_API_LIMITS.commentListLimit,
  }
}

function normalizeCommentChange(
  providerAccountId: string,
  entryTime: unknown,
  field: string,
  value: UnknownRecord
): NormalizedInstagramInboxEvent | null {
  const providerMessageId = stringValue(value.id) ?? stringValue(value.comment_id)
  if (!providerMessageId) return null

  const from = asRecord(value.from) ?? asRecord(value.user)
  const providerUserId =
    stringValue(from?.id) ?? stringValue(value.user_id) ?? stringValue(value.sender_id)
  const senderName =
    stringValue(from?.username) ??
    stringValue(value.username) ??
    stringValue(value.sender_name) ??
    'Instagram user'

  const isMention = field.includes('mention')
  const attachments = normalizeCommentAttachments(value, field)
  const body =
    stringValue(value.text) ??
    stringValue(value.message) ??
    stringValue(value.caption) ??
    summarizeAttachments(attachments)
  if (!body) return null

  return {
    providerAccountId,
    providerThreadId: `${isMention ? 'mention' : 'comment'}:${providerMessageId}`,
    providerMessageId,
    providerUserId,
    senderName,
    body,
    messageType: isMention ? 'mention' : 'comment',
    createdAt: dateFromProvider(value.timestamp ?? value.created_time ?? entryTime),
    attachments,
    providerLimits: providerLimits(),
    payload: value,
  }
}

function normalizeMessagingEvent(
  providerAccountId: string,
  event: UnknownRecord
): NormalizedInstagramInboxEvent | null {
  const sender = asRecord(event.sender)
  const message = asRecord(event.message)
  const postback = asRecord(event.postback)
  if (message?.is_echo === true) return null

  const providerUserId = stringValue(sender?.id)
  const attachments = [
    ...normalizeMessagingAttachments(message),
    ...normalizePostbackAttachment(postback),
  ]
  const providerMessageId =
    stringValue(message?.mid) ??
    stringValue(postback?.mid) ??
    stringValue(event.mid) ??
    `${providerAccountId}:${providerUserId ?? 'unknown'}:${String(event.timestamp ?? Date.now())}`
  const body =
    stringValue(message?.text) ??
    stringValue(postback?.title) ??
    stringValue(postback?.payload) ??
    summarizeAttachments(attachments)
  if (!body) return null

  return {
    providerAccountId,
    providerThreadId: `dm:${providerUserId ?? providerMessageId}`,
    providerMessageId,
    providerUserId,
    senderName: providerUserId ?? 'Instagram user',
    body,
    messageType: 'dm',
    createdAt: dateFromProvider(event.timestamp),
    attachments,
    providerLimits: providerLimits(),
    payload: event,
  }
}

export function extractInstagramInboxEvents(payload: unknown): NormalizedInstagramInboxEvent[] {
  const root = asRecord(payload)
  const entries = Array.isArray(root?.entry) ? root.entry : []
  const events: NormalizedInstagramInboxEvent[] = []

  for (const entryValue of entries) {
    const entry = asRecord(entryValue)
    const providerAccountId = stringValue(entry?.id)
    if (!entry || !providerAccountId) continue

    const changes = Array.isArray(entry.changes) ? entry.changes : []
    for (const changeValue of changes) {
      const change = asRecord(changeValue)
      const field = stringValue(change?.field)?.toLowerCase() ?? ''
      const value = asRecord(change?.value)
      if (!value) continue

      if (field.includes('comment') || field.includes('mention')) {
        const normalized = normalizeCommentChange(providerAccountId, entry.time, field, value)
        if (normalized) events.push(normalized)
      }
    }

    const messaging = Array.isArray(entry.messaging) ? entry.messaging : []
    for (const messageValue of messaging) {
      const normalized = normalizeMessagingEvent(providerAccountId, asRecord(messageValue) ?? {})
      if (normalized) events.push(normalized)
    }
  }

  return events
}
