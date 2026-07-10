export type NormalizedInstagramInboxEvent = {
  providerAccountId: string
  providerThreadId: string
  providerMessageId: string
  providerUserId: string | null
  senderName: string
  body: string
  messageType: 'comment' | 'dm' | 'mention'
  createdAt: Date
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

function summarizeAttachments(message: UnknownRecord): string {
  const attachments = Array.isArray(message.attachments) ? message.attachments : []
  if (attachments.length === 0) return ''
  return '[Instagram attachment]'
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
  const body = stringValue(value.text) ?? stringValue(value.message) ?? ''
  if (!body) return null

  const isMention = field.includes('mention')
  return {
    providerAccountId,
    providerThreadId: `${isMention ? 'mention' : 'comment'}:${providerMessageId}`,
    providerMessageId,
    providerUserId,
    senderName,
    body,
    messageType: isMention ? 'mention' : 'comment',
    createdAt: dateFromProvider(value.timestamp ?? value.created_time ?? entryTime),
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
  const providerMessageId =
    stringValue(message?.mid) ??
    stringValue(postback?.mid) ??
    stringValue(event.mid) ??
    `${providerAccountId}:${providerUserId ?? 'unknown'}:${String(event.timestamp ?? Date.now())}`
  const body =
    stringValue(message?.text) ??
    stringValue(postback?.title) ??
    (message ? summarizeAttachments(message) : '')
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
