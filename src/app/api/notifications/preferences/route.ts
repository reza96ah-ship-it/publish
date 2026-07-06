import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireWorkspaceApi } from '@/lib/auth-guards'
import {
  validateBody,
  notificationPreferencesSchema,
  NOTIFICATION_CATEGORY_IDS,
  type NotificationCategoryId,
  type NotificationChannel,
} from '@/lib/validations'

export const dynamic = 'force-dynamic'

// Default prefs — mirrors NOTIFICATION_TOGGLES in settings-view.tsx.
// inbox_new defaults off (avoid spam); everything else on.
function defaultPreferences(): Record<NotificationCategoryId, NotificationChannel> {
  const out = {} as Record<NotificationCategoryId, NotificationChannel>
  for (const id of NOTIFICATION_CATEGORY_IDS) {
    const on = id !== 'inbox_new'
    out[id] = { email: on, push: on, inApp: on }
  }
  return out
}

// Merge stored prefs (which may be partial / missing channels) over defaults.
function mergeStored(
  stored: Record<string, unknown> | null | undefined,
): Record<NotificationCategoryId, NotificationChannel> {
  const merged = { ...defaultPreferences() }
  const s = (stored ?? {}) as Record<string, unknown>
  for (const id of NOTIFICATION_CATEGORY_IDS) {
    const rec = s[id]
    if (!rec || typeof rec !== 'object') continue
    const r = rec as Partial<NotificationChannel>
    merged[id] = {
      email: typeof r.email === 'boolean' ? r.email : merged[id].email,
      push: typeof r.push === 'boolean' ? r.push : merged[id].push,
      inApp: typeof r.inApp === 'boolean' ? r.inApp : merged[id].inApp,
    }
  }
  return merged
}

// GET /api/notifications/preferences — return user prefs (defaults if unset).
export async function GET() {
  const guard = await requireWorkspaceApi()
  if (guard.error) return guard.error
  const user = await db.user.findUnique({
    where: { id: guard.userId },
    select: { notificationPreferences: true },
  })
  return NextResponse.json(
    mergeStored(user?.notificationPreferences as Record<string, unknown> | null),
  )
}

// PATCH /api/notifications/preferences — merge partial prefs into stored.
// Body: { categoryId: { email?, push?, inApp? } }. Any channel may be omitted;
// the existing value is preserved. Any authenticated member can edit their
// own prefs — no role requirement.
export async function PATCH(req: NextRequest) {
  const guard = await requireWorkspaceApi()
  if (guard.error) return guard.error

  const body = await req.json().catch(() => null)
  if (body === null || typeof body !== 'object') {
    return NextResponse.json({ error: 'بدنه درخواست نامعتبر است' }, { status: 400 })
  }

  const existing = (await db.user.findUnique({
    where: { id: guard.userId },
    select: { notificationPreferences: true },
  }))?.notificationPreferences as Record<string, unknown> | null
  const base: Record<string, NotificationChannel> = mergeStored(existing)

  // Widen partial channel records (fill missing channels from base).
  const widened: Record<string, NotificationChannel> = {}
  for (const [k, v] of Object.entries(body as Record<string, unknown>)) {
    if (!(NOTIFICATION_CATEGORY_IDS as readonly string[]).includes(k)) continue
    const cur = base[k] ?? { email: false, push: false, inApp: false }
    const inc = (v ?? {}) as Partial<NotificationChannel>
    widened[k] = {
      email: typeof inc.email === 'boolean' ? inc.email : cur.email,
      push: typeof inc.push === 'boolean' ? inc.push : cur.push,
      inApp: typeof inc.inApp === 'boolean' ? inc.inApp : cur.inApp,
    }
  }

  const check = validateBody(notificationPreferencesSchema, widened)
  if (!check.success) return NextResponse.json({ error: check.error }, { status: 400 })

  const next: Record<string, NotificationChannel> = { ...base, ...check.data }
  await db.user.update({
    where: { id: guard.userId },
    data: { notificationPreferences: next as unknown as object },
  })
  return NextResponse.json(next)
}
