import { db } from '@/lib/db'

export async function buildSupportBundle(workspaceId: string) {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const [workspace, platforms, recentJobs, memberCount, inboxCount] = await Promise.all([
    db.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        id: true,
        name: true,
        plan: true,
        timezone: true,
        createdAt: true,
      },
    }),
    db.platform.findMany({
      where: { workspaceId },
      select: {
        id: true,
        type: true,
        name: true,
        status: true,
        circuitState: true,
        lastSuccessAt: true,
        lastValidatedAt: true,
        primaryIssue: true,
      },
    }),
    db.publishJob.findMany({
      where: { workspaceId, createdAt: { gte: sevenDaysAgo } },
      select: {
        id: true,
        status: true,
        createdAt: true,
        error: true,
        platform: { select: { type: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    db.workspaceMember.count({ where: { workspaceId } }),
    db.inboxMessage.count({ where: { workspaceId, isRead: false } }),
  ])

  const jobStats = {
    total: recentJobs.length,
    success: recentJobs.filter((j) => j.status === 'success').length,
    failed: recentJobs.filter((j) => j.status === 'failed').length,
    pending: recentJobs.filter((j) => j.status === 'pending').length,
    processing: recentJobs.filter((j) => j.status === 'processing').length,
  }

  return {
    generatedAt: new Date().toISOString(),
    schemaVersion: '1',
    workspace: workspace
      ? {
          id: workspace.id,
          name: workspace.name,
          plan: workspace.plan,
          timezone: workspace.timezone,
          memberCount,
          unreadInboxCount: inboxCount,
          createdAt: workspace.createdAt.toISOString(),
        }
      : null,
    platforms: platforms.map((p) => ({
      id: p.id,
      type: p.type,
      name: p.name,
      status: p.status,
      circuitState: p.circuitState,
      lastSuccessAt: p.lastSuccessAt?.toISOString() ?? null,
      lastValidatedAt: p.lastValidatedAt?.toISOString() ?? null,
      primaryIssue: p.primaryIssue,
    })),
    publishJobs: {
      period: '7d',
      stats: jobStats,
      recentFailures: recentJobs
        .filter((j) => j.status === 'failed')
        .slice(0, 10)
        .map((j) => ({
          id: j.id,
          platformType: j.platform?.type ?? null,
          createdAt: j.createdAt.toISOString(),
          error: j.error,
        })),
    },
  }
}
