/**
 * GET /api/analytics/real — fetch real analytics from platform APIs.
 *
 * For platforms with valid tokens, calls:
 * - Telegram: getChatMemberCount (channel subscribers)
 * - Instagram: /{ig-user-id}/insights (reach, impressions, engagement)
 * - LinkedIn: organizationalEntityShareStatistics
 *
 * Falls back to DB-stored AnalyticsSnapshot if API call fails.
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireWorkspaceApi } from "@/lib/auth-guards";
import { decrypt } from "@/lib/crypto";

export async function GET() {
  const guard = await requireWorkspaceApi();
  if (guard.error) return guard.error;
  const workspaceId = guard.workspace.id;

  // Get all connected platforms
  const platforms = await db.platform.findMany({
    where: { workspaceId, tokenSecret: { not: null } },
  });

  const realStats: Record<string, { followers?: number; reach?: number; engagement?: number; source: string }> = {};

  for (const platform of platforms) {
    if (!platform.tokenSecret) continue;
    const token = decrypt(platform.tokenSecret);

    try {
      if (platform.type === "telegram" && platform.targetId) {
        // Telegram: get chat member count
        const res = await fetch(
          `https://api.telegram.org/bot${token}/getChatMemberCount`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: platform.targetId }),
          }
        );
        const data = await res.json();
        if (data.ok) {
          realStats[platform.type] = {
            followers: data.result,
            source: "telegram_api",
          };
        }
      } else if (platform.type === "bale" && platform.targetId) {
        // Bale: get chat member count (same API as Telegram)
        const res = await fetch(
          `https://tapi.bale.ai/bot${token}/getChatMemberCount`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: platform.targetId }),
          }
        );
        const data = await res.json();
        if (data.ok) {
          realStats[platform.type] = {
            followers: data.result,
            source: "bale_api",
          };
        }
      } else if (platform.type === "instagram" && platform.targetId) {
        // Instagram Graph API: insights
        const igUserId = platform.targetId;
        const res = await fetch(
          `https://graph.facebook.com/v21.0/${igUserId}/insights?metric=follower_count,reach,impressions&period=day&access_token=${token}`
        );
        const data = await res.json();
        if (!data.error) {
          const metrics: Record<string, number> = {};
          for (const item of data.data || []) {
            if (item.values?.[0]?.value) {
              metrics[item.name] = item.values[0].value;
            }
          }
          realStats[platform.type] = {
            followers: metrics.follower_count,
            reach: metrics.reach,
            engagement: metrics.impressions,
            source: "instagram_graph_api",
          };
        }
      }
    } catch (err) {
      console.error(`[analytics] ${platform.type} error:`, err);
    }
  }

  // Fallback: get latest DB snapshots for platforms without real data
  const dbSnapshots = await db.analyticsSnapshot.findMany({
    where: { workspaceId, date: { gte: new Date(Date.now() - 7 * 86400_000).toISOString().split("T")[0] } },
    orderBy: { date: "desc" },
    take: 50,
  });

  return NextResponse.json({
    real: realStats,
    fallback: dbSnapshots.map((s) => ({
      date: s.date,
      platform: s.platform,
      metric: s.metricType,
      value: s.value,
    })),
    hasRealData: Object.keys(realStats).length > 0,
  });
}
