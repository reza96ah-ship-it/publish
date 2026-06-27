import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireWorkspaceApi } from '@/lib/auth-guards'
import { validateBody, campaignCreateSchema } from '@/lib/validations'

export async function GET() {
  const guard = await requireWorkspaceApi()
  if (guard.error) return guard.error
  const workspaceId = guard.workspace.id

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

// POST — create a new campaign
export async function POST(req: NextRequest) {
  const guard = await requireWorkspaceApi()
  if (guard.error) return guard.error
  const workspaceId = guard.workspace.id

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'بدنه نامعتبر' }, { status: 400 })

  const validation = validateBody(campaignCreateSchema, body)
  if (!validation.success) return NextResponse.json({ error: validation.error }, { status: 400 })
  const { name, description, color } = validation.data

  const campaign = await db.campaign.create({
    data: {
      workspaceId,
      name,
      description: description ?? null,
      healthColor: color ?? undefined,
    },
  })

  return NextResponse.json({
    id: campaign.id,
    name: campaign.name,
    description: campaign.description,
    status: campaign.status,
    healthLabel: campaign.healthLabel,
    healthColor: campaign.healthColor,
    owner: campaign.ownerName,
    daysRemaining: campaign.daysRemaining,
    pubProgress: campaign.pubProgress,
    goalCompletion: campaign.goalCompletion,
    platforms: [],
    topBlocker: campaign.topBlocker,
    startDate: campaign.startDate,
    endDate: campaign.endDate,
    goalType: campaign.goalType,
    goalValue: campaign.goalValue,
  }, { status: 201 })
}
