import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireWorkspaceApi } from '@/lib/auth-guards'

export const dynamic = 'force-dynamic'

export async function GET() {
  const guard = await requireWorkspaceApi()
  if (guard.error) return guard.error
  const workspaceId = guard.workspace.id

  // P8.3: Fixed N+1 â€” single groupBy query instead of count per platform
  const platforms = await db.platform.findMany({
    where: { workspaceId },
    orderBy: { createdAt: 'asc' },
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

  const result = platforms.map((p) => ({
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
  }))

  return NextResponse.json(result)
}

function logoFor(t: string) {
  return `https://picsum.photos/seed/${t}/64/64`
}
function stateLabel(p: { status: string; circuitState: string; accountKind: string }) {
  if (p.status === 'expired') return 'ظ†غŒط§ط²ظ…ظ†ط¯ ط§ط­ط±ط§ط² ظ…ط¬ط¯ط¯'
  if (p.status === 'error' || p.circuitState === 'open') return 'ط§ط®طھظ„ط§ظ„ API'
  if (p.status === 'disconnected') return 'ظ‚ط·ط¹ ط´ط¯ظ‡'
  if (p.accountKind === 'personal') return 'ط­ط³ط§ط¨ ط´ط®طµغŒ (ط¯ط³طھغŒ)'
  return 'ظ…طھطµظ„ ظˆ ظ¾ط§غŒط¯ط§ط±'
}
function stateColor(p: { status: string; circuitState: string; accountKind: string }) {
  if (p.status === 'expired') return 'text-amber-700 bg-amber-50 border-amber-200'
  if (p.status === 'error' || p.circuitState === 'open')
    return 'text-rose-700 bg-rose-50 border-rose-200'
  if (p.status === 'disconnected') return 'text-slate-700 bg-slate-50 border-slate-200'
  if (p.accountKind === 'personal') return 'text-blue-700 bg-blue-50 border-blue-200'
  return 'text-emerald-700 bg-emerald-50 border-emerald-200'
}
