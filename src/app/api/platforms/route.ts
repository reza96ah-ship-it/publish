import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getWorkspaceId } from '@/lib/server'

export async function GET() {
  const workspaceId = await getWorkspaceId()
  if (!workspaceId) return NextResponse.json({ error: 'workspace not found' }, { status: 404 })

  const platforms = await db.platform.findMany({
    where: { workspaceId },
    orderBy: { createdAt: 'asc' },
  })

  const result = await Promise.all(platforms.map(async (p) => {
    const accounts = await db.platform.count({ where: { workspaceId, type: p.type } })
    return {
      id: p.id,
      name: p.name,
      type: p.type,
      logo: logoFor(p.type),
      state: stateLabel(p),
      stateColor: stateColor(p),
      accounts,
      primaryIssue: p.primaryIssue,
      lastSuccess: p.lastSuccessAt,
      accountKind: p.accountKind,
      circuitState: p.circuitState,
      username: p.username,
    }
  }))

  return NextResponse.json(result)
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
  if (p.status === 'error' || p.circuitState === 'open') return 'text-rose-700 bg-rose-50 border-rose-200'
  if (p.status === 'disconnected') return 'text-slate-700 bg-slate-50 border-slate-200'
  if (p.accountKind === 'personal') return 'text-blue-700 bg-blue-50 border-blue-200'
  return 'text-emerald-700 bg-emerald-50 border-emerald-200'
}
