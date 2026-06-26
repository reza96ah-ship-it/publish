import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireWorkspaceApi } from '@/lib/auth-guards'
import { validateBody, memberInviteSchema } from '@/lib/validations'
import { randomUUID } from 'crypto'

export async function GET() {
  const guard = await requireWorkspaceApi()
  if (guard.error) return guard.error
  const workspaceId = guard.workspace.id

  const members = await db.workspaceMember.findMany({
    where: { workspaceId },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json(members.map((m) => ({
    id: m.id,
    name: m.name,
    email: m.email,
    role: m.role,
    roleLabel: roleLabel(m.role),
    avatar: m.avatarUrl,
  })))
}

// POST — add a team member directly (similar to /api/members/invite but without invite token)
export async function POST(req: NextRequest) {
  const guard = await requireWorkspaceApi()
  if (guard.error) return guard.error
  const workspaceId = guard.workspace.id

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'بدنه نامعتبر' }, { status: 400 })

  const validation = validateBody(memberInviteSchema, body)
  if (!validation.success) return NextResponse.json({ error: validation.error }, { status: 400 })
  const { email, name, role } = validation.data

  // Check duplicate
  const existing = await db.workspaceMember.findFirst({ where: { workspaceId, email } })
  if (existing) return NextResponse.json({ error: 'این عضو قبلاً اضافه شده است' }, { status: 409 })

  const member = await db.workspaceMember.create({
    data: {
      workspaceId,
      userId: randomUUID(), // temporary — replaced when user accepts
      name: name || email.split('@')[0],
      email,
      role,
    },
  })

  return NextResponse.json({
    ok: true,
    member: {
      id: member.id,
      name: member.name,
      email: member.email,
      role: member.role,
      roleLabel: roleLabel(member.role),
    },
  }, { status: 201 })
}

function roleLabel(r: string) {
  switch (r) {
    case 'admin': return 'مدیر'
    case 'editor': return 'ویراستار'
    case 'approver': return 'تأییدکننده'
    case 'viewer': return 'بیننده'
    default: return r
  }
}
