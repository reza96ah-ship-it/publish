import { db } from '@/lib/db'

export interface SavedReply {
  id: string
  title: string
  body: string
  createdAt: Date
}

export interface AutoTagRule {
  id: string
  keyword: string
  tag: string
  createdAt: Date
}

// ── Saved Replies ─────────────────────────────────────────────────────────────

export async function listSavedReplies(workspaceId: string): Promise<SavedReply[]> {
  return db.savedReply.findMany({
    where: { workspaceId },
    select: { id: true, title: true, body: true, createdAt: true },
    orderBy: { title: 'asc' },
  })
}

export async function createSavedReply(
  workspaceId: string,
  userId: string,
  data: { title: string; body: string }
): Promise<SavedReply> {
  if (!data.title.trim()) throw new Error('عنوان الزامی است')
  if (!data.body.trim()) throw new Error('متن پاسخ الزامی است')
  return db.savedReply.create({
    data: { workspaceId, createdById: userId, title: data.title.trim(), body: data.body.trim() },
    select: { id: true, title: true, body: true, createdAt: true },
  })
}

export async function updateSavedReply(
  id: string,
  workspaceId: string,
  data: Partial<{ title: string; body: string }>
): Promise<SavedReply> {
  const existing = await db.savedReply.findFirst({ where: { id, workspaceId } })
  if (!existing) throw new Error('پاسخ ذخیره‌شده یافت نشد')
  return db.savedReply.update({
    where: { id },
    data: {
      ...(data.title !== undefined && { title: data.title.trim() }),
      ...(data.body !== undefined && { body: data.body.trim() }),
    },
    select: { id: true, title: true, body: true, createdAt: true },
  })
}

export async function deleteSavedReply(id: string, workspaceId: string): Promise<void> {
  const existing = await db.savedReply.findFirst({ where: { id, workspaceId } })
  if (!existing) throw new Error('پاسخ ذخیره‌شده یافت نشد')
  await db.savedReply.delete({ where: { id } })
}

// ── Variable substitution ─────────────────────────────────────────────────────

export function interpolate(body: string, vars: { senderName?: string; channelName?: string }): string {
  return body
    .replace(/\{نام\}/g, vars.senderName ?? '')
    .replace(/\{کانال\}/g, vars.channelName ?? '')
}

// ── Auto-Tag Rules ────────────────────────────────────────────────────────────

export async function listAutoTagRules(workspaceId: string): Promise<AutoTagRule[]> {
  return db.autoTagRule.findMany({
    where: { workspaceId },
    select: { id: true, keyword: true, tag: true, createdAt: true },
    orderBy: { keyword: 'asc' },
  })
}

export async function createAutoTagRule(
  workspaceId: string,
  data: { keyword: string; tag: string }
): Promise<AutoTagRule> {
  if (!data.keyword.trim()) throw new Error('کلیدواژه الزامی است')
  if (!data.tag.trim()) throw new Error('برچسب الزامی است')
  return db.autoTagRule.create({
    data: { workspaceId, keyword: data.keyword.trim().toLowerCase(), tag: data.tag.trim() },
    select: { id: true, keyword: true, tag: true, createdAt: true },
  })
}

export async function deleteAutoTagRule(id: string, workspaceId: string): Promise<void> {
  const existing = await db.autoTagRule.findFirst({ where: { id, workspaceId } })
  if (!existing) throw new Error('قانون یافت نشد')
  await db.autoTagRule.delete({ where: { id } })
}

/** Compute tags for a message body based on workspace rules. */
export function applyAutoTagRules(messageText: string, rules: AutoTagRule[]): string[] {
  const lower = messageText.toLowerCase()
  const tags = new Set<string>()
  for (const rule of rules) {
    if (lower.includes(rule.keyword)) tags.add(rule.tag)
  }
  return Array.from(tags)
}
