/** Executable Inbox templates. Other saved workflow definitions remain drafts. */

export type InboxTemplateId = 'notify_team' | 'tag_unanswered' | 'reply_window_reminder'

type Piece = { type: string; config: Record<string, unknown> }
export type InboxTemplateDefinition = {
  triggers: { type: 'keyword' | 'provider_event' | 'schedule'; config: Record<string, unknown> }[]
  conditions: []
  actions: { type: 'add_tag' | 'assign_inbox' | 'send_notification'; config: Record<string, unknown> }[]
}

export type ParsedInboxTemplate =
  | { id: 'notify_team'; keyword: string; tag: string; defaultAssigneeId: string; message: string }
  | { id: 'tag_unanswered'; tag: 'unanswered' }
  | { id: 'reply_window_reminder'; leadMinutes: number; message: string }

const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : null

const piece = (value: unknown): Piece | null => {
  const row = record(value)
  const config = record(row?.config)
  return typeof row?.type === 'string' && config ? { type: row.type, config } : null
}

const nonEmpty = (value: unknown, max: number): string | null => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed && trimmed.length <= max ? trimmed : null
}

/** Fail closed: a definition executes only if it matches one supported template. */
export function parseInboxTemplate(value: unknown): ParsedInboxTemplate | null {
  const definition = record(value)
  if (!Array.isArray(definition?.triggers) || definition.triggers.length !== 1 ||
      !Array.isArray(definition.conditions) || definition.conditions.length !== 0 ||
      !Array.isArray(definition.actions)) return null
  const trigger = piece(definition.triggers[0])
  const actions = definition.actions.map(piece)
  if (!trigger || actions.some((action) => !action)) return null

  if (trigger.config.templateId === 'notify_team' && trigger.type === 'keyword' &&
      actions.length === 3 && actions[0]?.type === 'add_tag' &&
      actions[1]?.type === 'assign_inbox' && actions[2]?.type === 'send_notification') {
    const keyword = nonEmpty(trigger.config.text, 100)
    const tag = nonEmpty(actions[0].config.tag, 50)
    const defaultAssigneeId = nonEmpty(actions[1].config.assigneeId, 100)
    const message = nonEmpty(actions[2].config.message, 200)
    if (keyword && tag && defaultAssigneeId && message &&
        actions[2].config.recipient === 'thread_assignee') {
      return { id: 'notify_team', keyword, tag, defaultAssigneeId, message }
    }
  }

  if (trigger.config.templateId === 'tag_unanswered' && trigger.type === 'provider_event' &&
      trigger.config.event === 'instagram.comment.received' && actions.length === 1 &&
      actions[0]?.type === 'add_tag' && actions[0].config.tag === 'unanswered') {
    return { id: 'tag_unanswered', tag: 'unanswered' }
  }

  if (trigger.config.templateId === 'reply_window_reminder' && trigger.type === 'schedule' &&
      trigger.config.event === 'instagram.comment.reply_window' && actions.length === 1 &&
      actions[0]?.type === 'send_notification' && actions[0].config.recipient === 'thread_assignee') {
    const leadMinutes = trigger.config.leadMinutes
    const message = nonEmpty(actions[0].config.message, 200)
    if (Number.isInteger(leadMinutes) && Number(leadMinutes) >= 15 && Number(leadMinutes) <= 1440 && message) {
      return { id: 'reply_window_reminder', leadMinutes: Number(leadMinutes), message }
    }
  }
  return null
}

export function notifyTeamDefinition(keyword: string, assigneeId: string): InboxTemplateDefinition {
  return {
    triggers: [{ type: 'keyword', config: { templateId: 'notify_team', text: keyword.trim() } }],
    conditions: [],
    actions: [
      { type: 'add_tag', config: { tag: 'priority' } },
      { type: 'assign_inbox', config: { assigneeId } },
      { type: 'send_notification', config: { recipient: 'thread_assignee', message: 'کامنت مهم جدید نیاز به بررسی دارد.' } },
    ],
  }
}

export function tagUnansweredDefinition(): InboxTemplateDefinition {
  return {
    triggers: [{ type: 'provider_event', config: { templateId: 'tag_unanswered', event: 'instagram.comment.received' } }],
    conditions: [],
    actions: [{ type: 'add_tag', config: { tag: 'unanswered' } }],
  }
}

export function replyWindowReminderDefinition(leadMinutes = 60): InboxTemplateDefinition {
  return {
    triggers: [{ type: 'schedule', config: { templateId: 'reply_window_reminder', event: 'instagram.comment.reply_window', leadMinutes } }],
    conditions: [],
    actions: [{ type: 'send_notification', config: { recipient: 'thread_assignee', message: 'مهلت پاسخ خصوصی به کامنت در حال پایان است.' } }],
  }
}
