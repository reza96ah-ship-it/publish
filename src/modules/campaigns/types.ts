export interface AuthContext { workspaceId: string; userId: string }

export interface CampaignListQuery { cursor?: string; limit: number }

export interface CampaignItem {
  id: string
  name: string
  description: string | null
  status: string
  healthLabel: string | null
  healthColor: string | null
  owner: string | null
  daysRemaining: string | null
  pubProgress: number | null
  goalCompletion: string | null
  platforms: string[]
  topBlocker: string | null
  startDate: Date | null
  endDate: Date | null
  goalType: string | null
  goalValue: number | null
}

export interface CampaignListResult {
  data: CampaignItem[]
  nextCursor: string | null
}

export interface CampaignCreateInput {
  name: string
  description?: string
  color?: string
}
