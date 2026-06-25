import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getWorkspaceId } from '@/lib/server'

export async function GET() {
  const workspaceId = await getWorkspaceId()
  if (!workspaceId) return NextResponse.json({ error: 'workspace not found' }, { status: 404 })

  const campaigns = await db.campaign.findMany({
    where: { workspaceId },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json(campaigns.map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    status: c.status,
    healthLabel: c.healthLabel,
    healthColor: c.healthColor,
    owner: c.ownerName,
    daysRemaining: c.daysRemaining,
    pubProgress: c.pubProgress,
    goalCompletion: c.goalCompletion,
    platforms: [],
    topBlocker: c.topBlocker,
    startDate: c.startDate,
    endDate: c.endDate,
    goalType: c.goalType,
    goalValue: c.goalValue,
  })))
}
