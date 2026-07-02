import { db } from '@/lib/db'
import type { Campaign } from '@prisma/client'
import type { CampaignListQuery, CampaignItem, CampaignCreateInput } from './types'

function toItem(c: Campaign): CampaignItem {
  return {
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
  }
}

export class CampaignsRepository {
  async list(workspaceId: string, query: CampaignListQuery) {
    const rows = await db.campaign.findMany({
      where: {
        workspaceId,
        ...(query.cursor ? { id: { gt: query.cursor } } : {}),
      },
      orderBy: { createdAt: 'asc' },
      take: query.limit + 1,
    })
    return rows.map(toItem)
  }

  async create(workspaceId: string, input: CampaignCreateInput): Promise<CampaignItem> {
    const row = await db.campaign.create({
      data: {
        workspaceId,
        name: input.name,
        description: input.description ?? null,
        healthColor: input.color ?? undefined,
      },
    })
    return toItem(row)
  }
}
