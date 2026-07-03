/**
 * GET /api/support-bundle — generates a sanitized diagnostic bundle for support requests.
 *
 * Collects: recent publish job outcomes, channel health, workspace config (no secrets),
 * active member count, and platform connection status.
 *
 * NEVER includes: OAuth tokens, password hashes, MFA secrets, caption text, DM content,
 * or any personal data beyond workspace/job metadata.
 *
 * Returns a JSON file download.
 */

import { NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const guard = await requirePermissionApi('workspace.settings')
  if (guard.error) return guard.error
  const workspaceId = guard.workspaceId

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
        // Deliberately exclude: brandPrimaryColor, brandVoice, etc. (not diagnostic)
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
        // Deliberately exclude: tokenHash, tokenSecret, tokenScopes (secrets)
      },
    }),
    db.publishJob.findMany({
      where: { workspaceId, createdAt: { gte: sevenDaysAgo } },
      select: {
        id: true,
        status: true,
        createdAt: true,
        scheduledAt: true,
        completedAt: true,
        error: true,
        // Deliberately exclude: content.caption, content.text, any personal data
        platform: { select: { type: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    db.workspaceMember.count({ where: { workspaceId } }),
    db.inboxMessage.count({ where: { workspaceId, isRead: false } }),
  ])

  // Aggregate job stats (no content, just outcomes)
  const jobStats = {
    total: recentJobs.length,
    success: recentJobs.filter((j) => j.status === 'success').length,
    failed: recentJobs.filter((j) => j.status === 'failed').length,
    pending: recentJobs.filter((j) => j.status === 'pending').length,
    processing: recentJobs.filter((j) => j.status === 'processing').length,
  }

  const bundle = {
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

  const filename = `nashrino-support-bundle-${new Date().toISOString().split('T')[0]}.json`

  return new NextResponse(JSON.stringify(bundle, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
