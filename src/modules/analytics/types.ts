export interface AuthContext {
  workspaceId: string
  userId: string
}

export interface SnapshotSeriesResult {
  dates: string[]
  reach: number[]
  engagement: number[]
  followers: number[]
  clicks: number[]
}

export interface RealStat {
  followers?: number
  reach?: number
  engagement?: number
  source: string
}

export interface RealStatsResult {
  real: Record<string, RealStat>
  fallback: { date: string; platform: string | null; metric: string; value: number }[]
  hasRealData: boolean
}
