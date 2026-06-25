import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getWorkspaceId } from '@/lib/server'

export async function GET() {
  const workspaceId = await getWorkspaceId()
  if (!workspaceId) return NextResponse.json({ error: 'workspace not found' }, { status: 404 })

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

function roleLabel(r: string) {
  switch (r) {
    case 'admin': return 'مدیر'
    case 'editor': return 'ویراستار'
    case 'approver': return 'تأییدکننده'
    case 'viewer': return 'بیننده'
    default: return r
  }
}
