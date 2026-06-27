import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireWorkspaceApi } from '@/lib/auth-guards'
import { validateBody, validateParams, memberInviteSchema, cursorPaginationSchema } from '@/lib/validations'
import { randomUUID } from 'crypto'

export async function GET(req: NextRequest) {
  const guard = await requireWorkspaceApi()
  if (guard.error) return guard.error
  const workspaceId = guard.workspace.id

  const query = Object.fromEntries(req.nextUrl.searchParams.entries())
  const queryCheck = validateParams(cursorPaginationSchema, query)
  if (!queryCheck.success) return NextResponse.json({ error: queryCheck.error }, { status: 400 })
  const { cursor, limit } = queryCheck.data

  const members = await db.workspaceMember.findMany({
    where: {
      workspaceId,
      ...(cursor ? { id: { lt: cursor } } : {}),
    },
    orderBy: { id: 'desc' },
    take: limit + 1,
  })

  const hasMore = members.length > limit
  const data = hasMore ? members.slice(0, limit) : members
  const nextCursor = hasMore ? data[data.length - 1]?.id : null

  return NextResponse.json({
    data: data.map((m) => ({
      id: m.id,
      name: m.name,
      email: m.email,
      role: m.role,
      roleLabel: roleLabel(m.role),
      avatar: m.avatarUrl,
    })),
    nextCursor,
  })
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
