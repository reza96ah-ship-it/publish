import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermissionApi } from '@/lib/auth-guards'
import { validateParams, cursorPaginationSchema } from '@/lib/validations'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const guard = await requirePermissionApi('platform.manage')
  if (guard.error) return guard.error
  const workspaceId = guard.workspaceId

  const query = Object.fromEntries(req.nextUrl.searchParams.entries())
  const queryCheck = validateParams(cursorPaginationSchema, query)
  if (!queryCheck.success) return NextResponse.json({ error: queryCheck.error }, { status: 400 })
  const { cursor, limit } = queryCheck.data

  // P8.3: Fixed N+1 — single groupBy query instead of count per platform
  const platforms = await db.platform.findMany({
    where: {
      workspaceId,
      ...(cursor ? { id: { gt: cursor } } : {}),
    },
    orderBy: { createdAt: 'asc' },
    take: limit + 1,
    select: {
      id: true,
      name: true,
      type: true,
      status: true,
      circuitState: true,
      accountKind: true,
      username: true,
      primaryIssue: true,
      lastSuccessAt: true,
    },
  })

  // Single groupBy query to get counts per type (was N queries)
  const typeCounts = await db.platform.groupBy({
    by: ['type'],
    where: { workspaceId },
    _count: { _all: true },
  })
  const countMap = new Map(typeCounts.map((t) => [t.type, t._count._all]))

  const hasMore = platforms.length > limit
  const page = hasMore ? platforms.slice(0, limit) : platforms
  const nextCursor = hasMore ? page[page.length - 1]?.id : null

  return NextResponse.json({
    data: page.map((p) => ({
      id: p.id,
      name: p.name,
      type: p.type,
      logo: logoFor(p.type),
      state: stateLabel(p),
      stateColor: stateColor(p),
      accounts: countMap.get(p.type) ?? 1,
      primaryIssue: p.primaryIssue,
      lastSuccess: p.lastSuccessAt,
      accountKind: p.accountKind,
      circuitState: p.circuitState,
      username: p.username,
    })),
    nextCursor,
  })
}

function logoFor(t: string) {
  return `https://picsum.photos/seed/${t}/64/64`
}
function stateLabel(p: { status: string; circuitState: string; accountKind: string }) {
  if (p.status === 'expired') return 'نیازمند احراز مجدد'
  if (p.status === 'error' || p.circuitState === 'open') return 'اختلال API'
  if (p.status === 'disconnected') return 'قطع شده'
  if (p.accountKind === 'personal') return 'حساب شخصی (دستی)'
  return 'متصل و پایدار'
}
function stateColor(p: { status: string; circuitState: string; accountKind: string }) {
  if (p.status === 'expired') return 'text-amber-700 bg-amber-50 border-amber-200'
  if (p.status === 'error' || p.circuitState === 'open')
    return 'text-rose-700 bg-rose-50 border-rose-200'
  if (p.status === 'disconnected') return 'text-slate-700 bg-slate-50 border-slate-200'
  if (p.accountKind === 'personal') return 'text-blue-700 bg-blue-50 border-blue-200'
  return 'text-emerald-700 bg-emerald-50 border-emerald-200'
}
