import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermissionApi } from '@/lib/auth-guards'
import {
  validateParams,
  cursorPaginationSchema,
} from '@/lib/validations'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  // Issue #142: viewing members requires security.admin permission
  const guard = await requirePermissionApi('security.admin')
  if (guard.error) return guard.error
  const workspaceId = guard.workspaceId

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

// Issue #143: POST /api/members is DEPRECATED — direct member creation with
// fabricated userId is removed. Use POST /api/members/invite to create
// invitations instead. Invitations create real WorkspaceMember records only
// when the invited user accepts.
export async function POST() {
  return NextResponse.json(
    {
      error: 'ایجاد مستقیم عضو حذف شده است. از دعوت‌نامه استفاده کنید: POST /api/members/invite',
      redirect: '/api/members/invite',
    },
    { status: 410 }
  )
}

function roleLabel(r: string) {
  switch (r) {
    case 'admin':
      return 'مدیر'
    case 'editor':
      return 'ویراستار'
    case 'approver':
      return 'تأییدکننده'
    case 'viewer':
      return 'بیننده'
    default:
      return r
  }
}
