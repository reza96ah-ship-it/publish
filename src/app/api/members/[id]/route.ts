import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermissionApi } from '@/lib/auth-guards'
import { validateBody } from '@/lib/validations'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const VALID_ROLES = ['admin', 'editor', 'approver', 'viewer'] as const
const roleChangeSchema = z.object({
  role: z.enum(VALID_ROLES),
})

// PATCH /api/members/[id] — change a member's role
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const guard = await requirePermissionApi('member.manage')
  if (guard.error) return guard.error
  const { workspaceId, userId: actorId } = guard

  const raw = await req.json().catch(() => null)
  const validation = validateBody(roleChangeSchema, raw)
  if (!validation.success) return NextResponse.json({ error: validation.error }, { status: 400 })
  const { role } = validation.data

  const member = await db.workspaceMember.findFirst({
    where: { id, workspaceId },
  })
  if (!member) return NextResponse.json({ error: 'عضو یافت نشد' }, { status: 404 })

  // Prevent demoting the last admin
  if (member.role === 'admin' && role !== 'admin') {
    const adminCount = await db.workspaceMember.count({
      where: { workspaceId, role: 'admin' },
    })
    if (adminCount <= 1) {
      return NextResponse.json(
        { error: 'نمی‌توان تنها مدیر فضای کاری را تنزل داد' },
        { status: 409 }
      )
    }
  }

  const updated = await db.workspaceMember.update({
    where: { id },
    data: { role },
  })

  try {
    await db.auditLog.create({
      data: {
        userId: actorId,
        workspaceId,
        action: 'member.role_changed',
        resource: 'WorkspaceMember',
        metadata: { memberId: id, previousRole: member.role, newRole: role },
      },
    })
  } catch { /* audit failure is non-fatal */ }

  return NextResponse.json({ ok: true, id: updated.id, role: updated.role })
}

// DELETE /api/members/[id] — remove a member from the workspace
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const guard = await requirePermissionApi('member.manage')
  if (guard.error) return guard.error
  const { workspaceId, userId: actorId } = guard

  const member = await db.workspaceMember.findFirst({
    where: { id, workspaceId },
  })
  if (!member) return NextResponse.json({ error: 'عضو یافت نشد' }, { status: 404 })

  // Prevent removing the last admin
  if (member.role === 'admin') {
    const adminCount = await db.workspaceMember.count({
      where: { workspaceId, role: 'admin' },
    })
    if (adminCount <= 1) {
      return NextResponse.json(
        { error: 'نمی‌توان تنها مدیر فضای کاری را حذف کرد' },
        { status: 409 }
      )
    }
  }

  // Prevent self-removal (use member management UI instead)
  if (member.userId === actorId) {
    return NextResponse.json(
      { error: 'نمی‌توانید خودتان را از فضای کاری حذف کنید' },
      { status: 400 }
    )
  }

  await db.workspaceMember.delete({ where: { id } })

  try {
    await db.auditLog.create({
      data: {
        userId: actorId,
        workspaceId,
        action: 'member.removed',
        resource: 'WorkspaceMember',
        metadata: { memberId: id, email: member.email, role: member.role },
      },
    })
  } catch { /* audit failure is non-fatal */ }

  return NextResponse.json({ ok: true })
}
