import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { db } from '@/lib/db'
import { NotificationsRepository } from '@/modules/notifications/repository'
import { automationsService } from '@/modules/automations/service'
import {
  notifyTeamDefinition, replyWindowReminderDefinition, tagUnansweredDefinition,
} from '../../../shared/inbox-automation-templates'
import { scanInboxAutomations } from '../../../mini-services/publish-worker/lib/inbox-automation-scanner'
import { db as workerDb } from '../../../mini-services/publish-worker/lib/db'
import { cleanupTestUser, cleanupTestWorkspace, createTestPlatform, createTestWorkspace, testId } from '../helpers'

const SKIP = !process.env.DATABASE_URL || process.env.DATABASE_URL.startsWith('file:')

describe.skipIf(SKIP)('Inbox automation templates — PostgreSQL', () => {
  beforeAll(async () => { await db.$connect() })
  afterAll(async () => { await Promise.all([db.$disconnect(), workerDb.$disconnect()]) })

  it('runs T3/T4/T5 once, scopes private notifications, and removes answered tags', async () => {
    const workspace = await createTestWorkspace()
    const viewerEmail = `${testId('viewer')}@nashrino.test`
    const viewer = await db.user.create({ data: {
      email: viewerEmail, name: 'Viewer', passwordHash: 'unused-test-hash', emailVerified: new Date(),
    } })
    try {
      await db.workspaceMember.create({ data: {
        workspaceId: workspace.workspaceId, userId: viewer.id,
        email: viewerEmail, name: 'Viewer', role: 'viewer',
      } })
      const { platformId } = await createTestPlatform(workspace.workspaceId, 'instagram')
      const now = new Date()
      const activatedAt = new Date(now.getTime() - 2 * 60_000)
      const auth = { workspaceId: workspace.workspaceId, userId: workspace.userId }
      const priority = await automationsService.createAutomation(auth, {
        name: 'Notify team', definition: notifyTeamDefinition('urgent', workspace.membershipId),
        maxRunsPerHour: 1000,
      })
      const unanswered = await automationsService.createAutomation(auth, {
        name: 'Tag unanswered', definition: tagUnansweredDefinition(), maxRunsPerHour: 1000,
      })
      const reminder = await automationsService.createAutomation(auth, {
        name: 'Reply reminder', definition: replyWindowReminderDefinition(60), maxRunsPerHour: 1000,
      })
      await db.automation.updateMany({
        where: { id: { in: [priority.id, unanswered.id, reminder.id] } },
        data: { isActive: true, activatedAt },
      })
      await expect(automationsService.createAutomation(auth, {
        name: 'Duplicate', definition: tagUnansweredDefinition(),
      })).rejects.toMatchObject({ statusCode: 400 })

      const commentThread = await db.inboxThread.create({ data: {
        workspaceId: workspace.workspaceId, platformId,
        providerThreadId: testId('priority-thread'), messageType: 'comment',
      } })
      const comment = await db.inboxThreadMessage.create({ data: {
        workspaceId: workspace.workspaceId, platformId, threadId: commentThread.id,
        providerMessageId: testId('priority-comment'), messageType: 'comment',
        direction: 'inbound', body: 'This is URGENT', payload: {},
        createdAt: now, ingestedAt: now,
      } })
      const dueAt = new Date(now.getTime() - 7 * 24 * 60 * 60_000 + 30 * 60_000)
      const dueThread = await db.inboxThread.create({ data: {
        workspaceId: workspace.workspaceId, platformId,
        providerThreadId: testId('due-thread'), messageType: 'comment',
        assigneeId: workspace.membershipId,
      } })
      await db.inboxThreadMessage.create({ data: {
        workspaceId: workspace.workspaceId, platformId, threadId: dueThread.id,
        providerMessageId: testId('due-comment'), messageType: 'comment',
        direction: 'inbound', body: 'Old comment', payload: {},
        createdAt: dueAt, ingestedAt: now,
      } })
      const answeredThread = await db.inboxThread.create({ data: {
        workspaceId: workspace.workspaceId, platformId,
        providerThreadId: testId('answered-thread'), messageType: 'comment',
        assigneeId: workspace.membershipId,
      } })
      await db.inboxThreadMessage.createMany({ data: [
        { workspaceId: workspace.workspaceId, platformId, threadId: answeredThread.id,
          providerMessageId: testId('answered-comment'), messageType: 'comment',
          direction: 'inbound', body: 'Already answered', payload: {},
          createdAt: dueAt, ingestedAt: now },
        { workspaceId: workspace.workspaceId, platformId, threadId: answeredThread.id,
          providerMessageId: testId('answered-reply'), messageType: 'comment',
          direction: 'outbound', body: 'Thanks', payload: {}, createdAt: now, ingestedAt: now },
      ] })

      await scanInboxAutomations(now)
      const updated = await db.inboxThread.findUniqueOrThrow({ where: { id: commentThread.id } })
      expect(updated.tags).toEqual(expect.arrayContaining(['priority', 'unanswered']))
      expect(updated.priority).toBe('high')
      expect(updated.assigneeId).toBe(workspace.membershipId)
      expect(await db.automationRun.count({ where: {
        automationId: priority.id, eventKey: comment.id, status: 'completed',
      } })).toBe(1)
      expect(await db.automationRun.count({ where: {
        automationId: reminder.id, eventKey: `reminder:${dueThread.id}`, status: 'completed',
      } })).toBe(1)
      expect(await db.automationRun.count({ where: {
        automationId: reminder.id, eventKey: `reminder:${answeredThread.id}`,
      } })).toBe(0)

      const notifications = new NotificationsRepository()
      const adminItems = await notifications.list(workspace.workspaceId, workspace.userId, { limit: 20 })
      expect(adminItems).toHaveLength(2)
      expect(adminItems.map((item) => item.href)).toEqual(expect.arrayContaining([
        `/inbox?thread=${commentThread.id}`, `/inbox?thread=${dueThread.id}`,
      ]))
      expect(await notifications.list(workspace.workspaceId, viewer.id, { limit: 20 })).toEqual([])
      expect(await notifications.markAllRead(workspace.workspaceId, viewer.id)).toBe(0)
      expect(await notifications.markRead(workspace.workspaceId, viewer.id, adminItems[0].id)).toBe(false)
      expect(await notifications.markRead(workspace.workspaceId, workspace.userId, adminItems[0].id)).toBe(true)

      await scanInboxAutomations(now)
      expect(await db.automationRun.count({ where: { automationId: priority.id } })).toBe(1)
      expect(await db.notification.count({ where: { workspaceId: workspace.workspaceId } })).toBe(2)

      await db.inboxThreadMessage.create({ data: {
        workspaceId: workspace.workspaceId, platformId, threadId: commentThread.id,
        providerMessageId: testId('reply'), messageType: 'comment',
        direction: 'outbound', body: 'Handled', payload: {},
      } })
      await scanInboxAutomations(now)
      const answered = await db.inboxThread.findUniqueOrThrow({ where: { id: commentThread.id } })
      expect(answered.tags).toContain('priority')
      expect(answered.tags).not.toContain('unanswered')
    } finally {
      await cleanupTestWorkspace(workspace.workspaceId)
      await cleanupTestUser(workspace.userId)
      await cleanupTestUser(viewer.id)
    }
  })
})
