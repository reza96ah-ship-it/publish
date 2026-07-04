/**
 * Issue #203 + #204: Scheduling service — queue-based slots + best-time-to-post.
 *
 * #203: Per-channel posting schedule (weekday × time slots), Jalali-aware.
 * #204: Engagement heatmap for best-time-to-post suggestions.
 */
import { db } from '@/lib/db'
import { toJalali } from '@/lib/jalali'

// ── #203: Queue-based scheduling ──

export interface ScheduleSlot {
  day: number // 0=Sat, 1=Sun, ..., 5=Fri
  slots: string[] // ["09:00", "12:30", ...]
}

export interface PostingScheduleConfig {
  platformId: string
  schedule: ScheduleSlot[]
  isActive: boolean
}

/**
 * Get the posting schedule for a platform.
 */
export async function getSchedule(workspaceId: string, platformId: string) {
  return db.postingSchedule.findUnique({
    where: { workspaceId_platformId: { workspaceId, platformId } },
  })
}

/**
 * Get all active schedules for a workspace.
 */
export async function getActiveSchedules(workspaceId: string) {
  return db.postingSchedule.findMany({
    where: { workspaceId, isActive: true },
  })
}

/**
 * Upsert the posting schedule for a platform.
 */
export async function upsertSchedule(workspaceId: string, config: PostingScheduleConfig) {
  return db.postingSchedule.upsert({
    where: { workspaceId_platformId: { workspaceId, platformId: config.platformId } },
    create: {
      workspaceId,
      platformId: config.platformId,
      schedule: config.schedule as any,
      isActive: config.isActive,
    },
    update: {
      schedule: config.schedule as any,
      isActive: config.isActive,
    },
  })
}

/**
 * Calculate the next available queue slot for a platform.
 * Returns the next datetime that matches a schedule slot, starting from now.
 *
 * Jalali week: Saturday=0 ... Friday=5
 * Gregorian getDay(): Sunday=0 ... Saturday=6
 */
export function getNextQueueSlot(
  schedule: ScheduleSlot[],
  fromDate: Date = new Date()
): Date | null {
  if (!schedule.length) return null

  // Convert Gregorian day to Jalali day (Sat=0, Sun=1, ..., Fri=5)
  const gregorianDay = fromDate.getDay()
  const jalaliDay = (gregorianDay + 1) % 7

  // Search the next 14 days for a matching slot
  for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
    const checkDate = new Date(fromDate)
    checkDate.setDate(checkDate.getDate() + dayOffset)
    checkDate.setHours(0, 0, 0, 0)

    const checkGregDay = checkDate.getDay()
    const checkJalaliDay = (checkGregDay + 1) % 7

    const daySchedule = schedule.find(s => s.day === checkJalaliDay)
    if (!daySchedule?.slots?.length) continue

    for (const timeSlot of daySchedule.slots) {
      const [hours, minutes] = timeSlot.split(':').map(Number)
      const slotDate = new Date(checkDate)
      slotDate.setHours(hours, minutes, 0, 0)

      // If this slot is in the future (or today but later), return it
      if (slotDate.getTime() > fromDate.getTime()) {
        return slotDate
      }
    }
  }

  return null // No slot found in next 14 days
}

// ── #204: Best-time-to-post ──

/**
 * Persian market cold-start heuristics for engagement by platform.
 * These are initial values used when there's not enough historical data.
 *
 * Values are relative engagement scores (0-100) by weekday (Sat=0) × hour.
 */
const PERSIAN_MARKET_HEURISTICS: Record<string, Record<number, Record<number, number>>> = {
  // Telegram: evening peaks (20:00-23:00), lunch dip
  telegram: {
    0: { 8: 30, 12: 20, 14: 35, 18: 50, 20: 80, 21: 90, 22: 75 }, // Sat
    1: { 8: 30, 12: 20, 14: 35, 18: 50, 20: 80, 21: 90, 22: 75 }, // Sun
    2: { 8: 30, 12: 20, 14: 35, 18: 50, 20: 80, 21: 90, 22: 75 }, // Mon
    3: { 8: 30, 12: 20, 14: 35, 18: 50, 20: 80, 21: 90, 22: 75 }, // Tue
    4: { 8: 25, 12: 15, 14: 30, 18: 45, 20: 70, 21: 80, 22: 60 }, // Wed
    5: { 10: 40, 14: 50, 18: 60, 20: 85, 21: 95, 22: 80 },       // Thu
  },
  // Instagram: lunch (12-14) + late night (22-01)
  instagram: {
    0: { 12: 60, 13: 70, 19: 65, 21: 75, 22: 85, 23: 80 }, // Sat
    1: { 12: 60, 13: 70, 19: 65, 21: 75, 22: 85, 23: 80 }, // Sun
    2: { 12: 60, 13: 70, 19: 65, 21: 75, 22: 85, 23: 80 }, // Mon
    3: { 12: 60, 13: 70, 19: 65, 21: 75, 22: 85, 23: 80 }, // Tue
    4: { 12: 55, 13: 65, 19: 60, 21: 70, 22: 80, 23: 75 }, // Wed
    5: { 13: 65, 15: 75, 20: 70, 22: 90, 23: 85 },         // Thu
  },
  // LinkedIn: morning (8-10) + early afternoon (13-15)
  linkedin: {
    0: { 8: 70, 9: 80, 10: 75, 13: 65, 14: 60, 15: 50 }, // Sat
    1: { 8: 70, 9: 80, 10: 75, 13: 65, 14: 60, 15: 50 }, // Sun
    2: { 8: 70, 9: 80, 10: 75, 13: 65, 14: 60, 15: 50 }, // Mon
    3: { 8: 70, 9: 80, 10: 75, 13: 65, 14: 60, 15: 50 }, // Tue
    4: { 8: 65, 9: 75, 10: 70, 13: 60, 14: 55, 15: 45 }, // Wed
  },
}

/**
 * Get best-time-to-post suggestions for a platform.
 * Returns top 3 time slots sorted by engagement score.
 *
 * Uses historical data from EngagementHeatmap if available (sampleCount > 5),
 * otherwise falls back to Persian market heuristics.
 */
export async function getBestTimesToPost(
  workspaceId: string,
  platform: string
): Promise<Array<{ weekday: number; hour: number; score: number; confidence: 'high' | 'medium' | 'low'; source: 'historical' | 'heuristic' }>> {
  // Try historical data first
  const heatmap = await db.engagementHeatmap.findMany({
    where: { workspaceId, platform, sampleCount: { gte: 3 } },
    orderBy: { avgEngagement: 'desc' },
    take: 10,
  })

  if (heatmap.length >= 3) {
    return heatmap.slice(0, 3).map(h => ({
      weekday: h.weekday,
      hour: h.hour,
      score: Math.round(h.avgEngagement),
      confidence: h.sampleCount >= 10 ? 'high' : 'medium',
      source: 'historical' as const,
    }))
  }

  // Fall back to Persian market heuristics
  const heuristics = PERSIAN_MARKET_HEURISTICS[platform]
  if (!heuristics) return []

  const suggestions: Array<{ weekday: number; hour: number; score: number; confidence: 'high' | 'medium' | 'low'; source: 'historical' | 'heuristic' }> = []
  for (const [dayStr, hours] of Object.entries(heuristics)) {
    const day = Number(dayStr)
    for (const [hourStr, score] of Object.entries(hours)) {
      suggestions.push({
        weekday: day,
        hour: Number(hourStr),
        score,
        confidence: 'low',
        source: 'heuristic',
      })
    }
  }

  return suggestions.sort((a, b) => b.score - a.score).slice(0, 3)
}

/**
 * Format a best-time suggestion as a human-readable Persian string.
 */
export function formatBestTime(weekday: number, hour: number): string {
  const JALALI_WEEKDAYS = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه']
  const dayName = JALALI_WEEKDAYS[weekday] ?? ''
  const persianHour = String(hour).padStart(2, '0')
  return `${dayName} ساعت ${persianHour}:۰۰`
}
