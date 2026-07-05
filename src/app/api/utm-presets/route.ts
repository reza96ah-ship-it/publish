import { NextRequest, NextResponse } from 'next/server'
import { requireAnyPermissionApi } from '@/lib/auth-guards'
import { validateBody, utmPresetCreateSchema } from '@/lib/validations'

import { UtmPresetService } from '@/modules/utm/service'

const svc = new UtmPresetService()

export async function GET(_req: NextRequest) {
  const guard = await requireAnyPermissionApi(['content.create', 'content.review'])
  if (guard.error) return guard.error
  const presets = await svc.list(guard.workspaceId)
  return NextResponse.json(presets)
}

export async function POST(req: NextRequest) {
  const guard = await requireAnyPermissionApi(['content.create', 'content.review'])
  if (guard.error) return guard.error
  try {
    const raw = await req.json().catch(() => null)
    if (!raw) return NextResponse.json({ error: 'بدنه نامعتبر است' }, { status: 400 })
    const validation = validateBody(utmPresetCreateSchema, raw)
    if (!validation.success) return NextResponse.json({ error: validation.error }, { status: 400 })
    const body = validation.data
    const preset = await svc.create(guard.workspaceId, body)
    return NextResponse.json(preset, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
