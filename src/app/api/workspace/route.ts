import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermissionApi } from '@/lib/auth-guards'
import { validateBody, workspaceUpdateSchema } from '@/lib/validations'
import { writeAuditLog } from '@/lib/audit'

export const dynamic = 'force-dynamic'

// GET /api/workspace — return the active workspace (profile + brand kit).
export async function GET() {
  const guard = await requirePermissionApi('workspace.settings')
  if (guard.error) return guard.error
  const ws = await db.workspace.findUnique({ where: { id: guard.workspaceId } })
  return NextResponse.json(ws)
}

// PATCH /api/workspace — update profile and/or brand-kit fields.
//
// Issue #213 / settings-brandkit: previously the four Settings tabs (Profile,
// Brand Kit, Notifications, Billing) were all disabled with "به‌زودی" badges.
// This handler wires Profile + Brand Kit to a real Prisma update. The same
// endpoint serves both tabs because they edit the same Workspace row.
//
// Permission: workspace.settings (admin-only per RBAC matrix).
// Validation: workspaceUpdateSchema (Zod strict — rejects unknown keys).
// Audit: emits a workspace.update event with the changed field list.
export async function PATCH(req: NextRequest) {
  const guard = await requirePermissionApi('workspace.settings')
  if (guard.error) return guard.error

  const body = await req.json().catch(() => null)
  if (body === null) {
    return NextResponse.json({ error: 'بدنه درخواست نامعتبر است' }, { status: 400 })
  }

  const check = validateBody(workspaceUpdateSchema, body)
  if (!check.success) {
    return NextResponse.json({ error: check.error }, { status: 400 })
  }

  // Prisma picks up only the fields that were present in the request body —
  // the Zod schema is `.optional()` on every field, so `undefined` is stripped
  // by JSON.stringify on the client side and the resulting object only carries
  // explicitly-typed keys.
  const data = check.data

  // Empty PATCH is a no-op but should not 400 — the user might have clicked
  // save without changing anything.
  if (Object.keys(data).length === 0) {
    const fresh = await db.workspace.findUnique({ where: { id: guard.workspaceId } })
    return NextResponse.json(fresh)
  }

  const updated = await db.workspace.update({
    where: { id: guard.workspaceId },
    data,
  })

  // Audit log — non-fatal if the write fails.
  void writeAuditLog({
    action: 'workspace.update',
    workspaceId: guard.workspaceId,
    userId: guard.userId,
    metadata: { fields: Object.keys(data) },
  })

  return NextResponse.json(updated)
}
