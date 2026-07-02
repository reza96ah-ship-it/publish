export interface PlatformRealStat {
  followers?: number
  reach?: number
  engagement?: number
  source: string
}

export interface AnalyticsFallbackEntry {
  date: string
  platform: string | null
  metric: string
  value: number
}

export interface RealAnalyticsResult {
  real: Record<string, PlatformRealStat>
  fallback: AnalyticsFallbackEntry[]
  hasRealData: boolean
}
