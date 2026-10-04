/** DB-only Inbox automation runner. No provider calls or blind retries. */
import { Prisma, type Automation } from '@prisma/client'
import { parseInboxTemplate, type ParsedInboxTemplate } from '../../../shared/inbox-automation-templates'
import { db } from './db'
import { matchComment, parseKeywordList } from './persian-match'

const INTERVAL_MS = 60_000
const PRIVATE_REPLY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000
const BATCH_SIZE = 100
let timer: ReturnType<typeof setInterval> | null = null
let inProgress = false

type PendingComment = { id: string; threadId: string; body: string; createdAt: Date }
type DueThread = { id: string; assigneeId: string; rootCreatedAt: Date }

export interface InboxAutomationStats { scanned: number; completed: number; skipped: number }

export function startInboxAutomationScanner(): void {
  if (timer) return
  timer = setInterval(() => {
    void scanInboxAutomations().catch((error) =>
      console.error('[inbox-automation] scan failed:', error instanceof Error ? error.name : 'internal_error'))
  }, INTERVAL_MS)
  void scanInboxAutomations().catch((error) =>
    console.error('[inbox-automation] initial scan failed:', error instanceof Error ? error.name : 'internal_error'))
}

export function stopInboxAutomationScanner(): void {
  if (timer) clearInterval(timer)
  timer = null
}

export async function scanInboxAutomations(now = new Date()): Promise<InboxAutomationStats> {
  const stats = { scanned: 0, completed: 0, skipped: 0 }
  if (inProgress) return stats
  inProgress = true
  try {
    const automations = await db.automation.findMany({
      where: { isActive: true, isPaused: false, killSwitch: false },
      orderBy: { createdAt: 'asc' },
    })
    for (const automation of automations) {
      const template = parseInboxTemplate(automation.definition)
      if (!template || automation.requireApproval) continue
      if (template.id === 'reply_window_reminder') {
        await scanReminders(automation, template, now, stats)
      } else {
        await scanComments(automation, template, now, stats)
        if (template.id === 'tag_unanswered') await reconcileAnsweredTags(automation.workspaceId)
      }
    }
    return stats
  } finally {
    inProgress = false
  }
}

async function scanComments(
  automation: Automation,
  template: Extract<ParsedInboxTemplate, { id: 'notify_team' | 'tag_unanswered' }>,
  now: Date,
  stats: InboxAutomationStats,
): Promise<void> {
  const activatedAt = automation.activatedAt ?? automation.createdAt
  const messages = await db.$queryRaw<PendingComment[]>`
    SELECT m."id", m."threadId", m."body", m."createdAt"
    FROM "InboxThreadMessage" m
    WHERE m."workspaceId" = ${automation.workspaceId}
      AND m."messageType" = 'comment' AND m."direction" = 'inbound'
      AND m."ingestedAt" >= ${activatedAt} AND m."createdAt" >= ${activatedAt}
      AND NOT EXISTS (
        SELECT 1 FROM "AutomationRun" r
        WHERE r."automationId" = ${automation.id} AND r."eventKey" = m."id"
      )
    ORDER BY m."ingestedAt" ASC, m."id" ASC
    LIMIT ${BATCH_SIZE}
  `
  for (const message of messages) {
    stats.scanned++
    if (await limitReached(automation, now)) break
    try {
      const outcome = await db.$transaction(async (tx) => {
        const current = await tx.automation.findUnique({ where: { id: automation.id } })
        if (!current?.isActive || current.isPaused || current.killSwitch ||
            current.version !== automation.version || current.requireApproval) return 'deferred'
        const matched = template.id === 'tag_unanswered' || matchComment(message.body, parseKeywordList(template.keyword)).matched
        const run = await tx.automationRun.create({
          data: {
            automationId: automation.id, workspaceId: automation.workspaceId,
            eventKey: message.id, version: automation.version,
            trigger: { type: 'instagram_comment', templateId: template.id, messageId: message.id, matched },
            conditions: [], actions: [], status: matched ? 'running' : 'skipped',
            startedAt: now, completedAt: matched ? null : now,
          },
        })
        if (!matched) return 'skipped'
        if (current.dryRunMode) {
          await tx.automationRun.update({ where: { id: run.id }, data: {
            status: 'completed', completedAt: now,
            actions: [{ type: template.id, status: 'dry_run' }],
          } })
          return 'completed'
        }
        const thread = await tx.inboxThread.findFirst({
          where: { id: message.threadId, workspaceId: automation.workspaceId, messageType: 'comment' },
          select: { id: true, assigneeId: true, firstResponseAt: true, status: true },
        })
        const priorReply = thread ? await tx.inboxThreadMessage.count({
          where: { threadId: thread.id, direction: 'outbound' },
        }) : 0
        if (!thread || thread.firstResponseAt || thread.status === 'resolved' || priorReply > 0) {
          await tx.automationRun.update({
            where: { id: run.id }, data: { status: 'skipped', completedAt: now,
              actions: [{ type: 'thread_state', status: 'skipped', reason: 'already_answered_or_missing' }] },
          })
          return 'skipped'
        }
        const actions: Record<string, unknown>[] = []
        const tag = template.tag
        await tx.$executeRaw`
          UPDATE "InboxThread" SET "tags" = array_append("tags", ${tag})
          WHERE "id" = ${thread.id} AND "workspaceId" = ${automation.workspaceId}
            AND NOT (${tag} = ANY("tags"))
        `
        actions.push({ type: 'add_tag', status: 'completed', tag })
        if (template.id === 'notify_team') {
          await tx.inboxThread.update({ where: { id: thread.id }, data: { priority: 'high' } })
          if (!thread.assigneeId) {
            const fallback = await tx.workspaceMember.findFirst({
              where: { id: template.defaultAssigneeId, workspaceId: automation.workspaceId,
                role: { in: ['admin', 'editor'] } }, select: { id: true },
            })
            if (fallback) {
              await tx.inboxThread.updateMany({
                where: { id: thread.id, assigneeId: null },
                data: { assigneeId: fallback.id, assignedAt: now, status: 'assigned' },
              })
            }
          }
          const assigned = await tx.inboxThread.findUnique({ where: { id: thread.id }, select: { assigneeId: true } })
          const eligible = assigned?.assigneeId ? await tx.workspaceMember.findFirst({
            where: { id: assigned.assigneeId, workspaceId: automation.workspaceId,
              role: { in: ['admin', 'editor'] } }, select: { id: true },
          }) : null
          if (eligible) {
            await tx.notification.create({ data: {
              workspaceId: automation.workspaceId, recipientMemberId: eligible.id,
              type: 'inbox_priority', title: template.message,
              body: message.body.slice(0, 120), href: `/inbox?thread=${encodeURIComponent(thread.id)}`,
            } })
            actions.push({ type: 'send_notification', status: 'completed', recipientMemberId: eligible.id })
          } else {
            actions.push({ type: 'send_notification', status: 'skipped', reason: 'no_reply_capable_assignee' })
          }
        }
        await tx.automationRun.update({
          where: { id: run.id }, data: {
            status: actions.some((action) => action.status === 'skipped') ? 'partial' : 'completed',
            actions: actions as Prisma.InputJsonValue, completedAt: now,
          },
        })
        return 'completed'
      })
      if (outcome === 'completed') stats.completed++
      else if (outcome === 'skipped') stats.skipped++
      else break
    } catch (error) {
      if (isUniqueConflict(error)) { stats.skipped++; continue }
      throw error
    }
  }
}

/** Keep the existing Inbox tag truthful after a reply or resolution. */
async function reconcileAnsweredTags(workspaceId: string): Promise<void> {
  await db.$executeRaw`
    UPDATE "InboxThread" t SET "tags" = array_remove(t."tags", 'unanswered'), "updatedAt" = CURRENT_TIMESTAMP
    WHERE t."workspaceId" = ${workspaceId} AND t."messageType" = 'comment'
      AND 'unanswered' = ANY(t."tags")
      AND (t."firstResponseAt" IS NOT NULL OR t."status" = 'resolved' OR EXISTS (
        SELECT 1 FROM "InboxThreadMessage" m
        WHERE m."threadId" = t."id" AND m."direction" = 'outbound'
      ))
  `
}

async function scanReminders(
  automation: Automation,
  template: Extract<ParsedInboxTemplate, { id: 'reply_window_reminder' }>,
  now: Date,
  stats: InboxAutomationStats,
): Promise<void> {
  const earliest = new Date(now.getTime() - PRIVATE_REPLY_WINDOW_MS)
  const latest = new Date(earliest.getTime() + template.leadMinutes * 60_000)
  const due = await db.$queryRaw<DueThread[]>`
    SELECT t."id", t."assigneeId", first_comment."createdAt" AS "rootCreatedAt"
    FROM "InboxThread" t
    JOIN "WorkspaceMember" assignee ON assignee."id" = t."assigneeId"
      AND assignee."workspaceId" = t."workspaceId" AND assignee."role" IN ('admin', 'editor')
    JOIN LATERAL (
      SELECT m."createdAt" FROM "InboxThreadMessage" m
      WHERE m."threadId" = t."id" AND m."messageType" = 'comment' AND m."direction" = 'inbound'
      ORDER BY m."createdAt" ASC LIMIT 1
    ) first_comment ON true
    WHERE t."workspaceId" = ${automation.workspaceId} AND t."messageType" = 'comment'
      AND t."assigneeId" IS NOT NULL AND t."firstResponseAt" IS NULL AND t."status" <> 'resolved'
      AND first_comment."createdAt" > ${earliest} AND first_comment."createdAt" <= ${latest}
      AND NOT EXISTS (
        SELECT 1 FROM "InboxThreadMessage" reply
        WHERE reply."threadId" = t."id" AND reply."direction" = 'outbound'
      )
      AND NOT EXISTS (
        SELECT 1 FROM "AutomationRun" run
        WHERE run."automationId" = ${automation.id} AND run."eventKey" = 'reminder:' || t."id"
      )
    ORDER BY first_comment."createdAt" ASC LIMIT ${BATCH_SIZE}
  `
  for (const thread of due) {
    stats.scanned++
    if (await limitReached(automation, now)) break
    const eventKey = `reminder:${thread.id}`
    try {
      const outcome = await db.$transaction(async (tx) => {
        const current = await tx.automation.findUnique({ where: { id: automation.id } })
        if (!current?.isActive || current.isPaused || current.killSwitch ||
            current.version !== automation.version || current.requireApproval) return 'deferred'
        const liveThread = await tx.inboxThread.findFirst({
          where: { id: thread.id, workspaceId: automation.workspaceId, messageType: 'comment',
            firstResponseAt: null, status: { not: 'resolved' } },
          select: { assigneeId: true },
        })
        if (!liveThread?.assigneeId) return 'deferred'
        const eligible = await tx.workspaceMember.findFirst({
          where: { id: liveThread.assigneeId, workspaceId: automation.workspaceId,
            role: { in: ['admin', 'editor'] } }, select: { id: true },
        })
        if (!eligible) return 'deferred'
        // A reply can arrive between candidate selection and this transaction.
        if (await tx.inboxThreadMessage.count({ where: { threadId: thread.id, direction: 'outbound' } }) > 0) {
          return 'deferred'
        }
        const run = await tx.automationRun.create({ data: {
          automationId: automation.id, workspaceId: automation.workspaceId, eventKey,
          version: automation.version,
          trigger: { type: 'reply_window', templateId: template.id, threadId: thread.id,
            rootCommentAt: thread.rootCreatedAt.toISOString() },
          conditions: [], actions: [], status: 'running', startedAt: now,
        } })
        if (current.dryRunMode) {
          await tx.automationRun.update({ where: { id: run.id }, data: {
            status: 'completed', completedAt: now,
            actions: [{ type: 'send_notification', status: 'dry_run' }],
          } })
          return 'completed'
        }
        await tx.notification.create({ data: {
          workspaceId: automation.workspaceId, recipientMemberId: eligible.id,
          type: 'inbox_reply_window', title: template.message,
          body: 'مهلت پاسخ خصوصی این کامنت به‌زودی پایان می‌یابد.',
          href: `/inbox?thread=${encodeURIComponent(thread.id)}`,
        } })
        await tx.automationRun.update({ where: { id: run.id }, data: {
          status: 'completed', completedAt: now,
          actions: [{ type: 'send_notification', status: 'completed', recipientMemberId: eligible.id }],
        } })
        return 'completed'
      })
      if (outcome === 'completed') stats.completed++
    } catch (error) {
      if (isUniqueConflict(error)) { stats.skipped++; continue }
      throw error
    }
  }
}

async function limitReached(automation: Automation, now: Date): Promise<boolean> {
  const completed = await db.automationRun.count({
    where: { automationId: automation.id, status: { in: ['completed', 'partial'] },
      createdAt: { gte: new Date(now.getTime() - 60 * 60_000) } },
  })
  return completed >= automation.maxRunsPerHour
}

function isUniqueConflict(error: unknown): boolean {
  return error !== null && typeof error === 'object' && 'code' in error && error.code === 'P2002'
}
