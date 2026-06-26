import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireWorkspaceApi } from '@/lib/auth-guards'

export async function GET() {
  const guard = await requireWorkspaceApi()
  if (guard.error) return guard.error
  const workspaceId = guard.workspace.id

  const items = await db.media.findMany({
    where: { workspaceId },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(items.map((m) => ({
    id: m.id,
    name: m.name,
    fileType: m.fileType,
    fileSize: m.fileSize,
    url: m.url,
    thumbnail: m.thumbnailUrl ?? m.url,
    folder: m.folder,
    tags: m.tags ? m.tags.split(',').filter(Boolean) : [],
    width: m.width,
    height: m.height,
    createdAt: m.createdAt,
  })))
}
