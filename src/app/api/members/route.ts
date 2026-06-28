import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireWorkspaceApi } from '@/lib/auth-guards'
import {
  validateBody,
  validateParams,
  memberInviteSchema,
  cursorPaginationSchema,
} from '@/lib/validations'
import { randomUUID } from 'crypto'

export const dynamic = 'force-dynamic'

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

// POST â€” add a team member directly (similar to /api/members/invite but without invite token)
export async function POST(req: NextRequest) {
  const guard = await requireWorkspaceApi()
  if (guard.error) return guard.error
  const workspaceId = guard.workspace.id

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'ط¨ط¯ظ†ظ‡ ظ†ط§ظ…ط¹طھط¨ط±' }, { status: 400 })

  const validation = validateBody(memberInviteSchema, body)
  if (!validation.success) return NextResponse.json({ error: validation.error }, { status: 400 })
  const { email, name, role } = validation.data

  // Check duplicate
  const existing = await db.workspaceMember.findFirst({ where: { workspaceId, email } })
  if (existing)
    return NextResponse.json(
      { error: 'ط§غŒظ† ط¹ط¶ظˆ ظ‚ط¨ظ„ط§ظ‹ ط§ط¶ط§ظپظ‡ ط´ط¯ظ‡ ط§ط³طھ' },
      { status: 409 }
    )

  const member = await db.workspaceMember.create({
    data: {
      workspaceId,
      userId: randomUUID(), // temporary â€” replaced when user accepts
      name: name || email.split('@')[0],
      email,
      role,
    },
  })

  return NextResponse.json(
    {
      ok: true,
      member: {
        id: member.id,
        name: member.name,
        email: member.email,
        role: member.role,
        roleLabel: roleLabel(member.role),
      },
    },
    { status: 201 }
  )
}

function roleLabel(r: string) {
  switch (r) {
    case 'admin':
      return 'ظ…ط¯غŒط±'
    case 'editor':
      return 'ظˆغŒط±ط§ط³طھط§ط±'
    case 'approver':
      return 'طھط£غŒغŒط¯ع©ظ†ظ†ط¯ظ‡'
    case 'viewer':
      return 'ط¨غŒظ†ظ†ط¯ظ‡'
    default:
      return r
  }
}
