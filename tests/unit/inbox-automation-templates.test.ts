import { describe, expect, it } from 'vitest'
import {
  notifyTeamDefinition, parseInboxTemplate, replyWindowReminderDefinition,
  tagUnansweredDefinition,
} from '../../shared/inbox-automation-templates'

describe('executable Inbox templates', () => {
  it('recognizes only the three supported definitions', () => {
    expect(parseInboxTemplate(notifyTeamDefinition('urgent', 'member-1'))).toEqual({
      id: 'notify_team', keyword: 'urgent', tag: 'priority',
      defaultAssigneeId: 'member-1', message: 'کامنت مهم جدید نیاز به بررسی دارد.',
    })
    expect(parseInboxTemplate(tagUnansweredDefinition())).toEqual({ id: 'tag_unanswered', tag: 'unanswered' })
    expect(parseInboxTemplate(replyWindowReminderDefinition(60))).toEqual({
      id: 'reply_window_reminder', leadMinutes: 60,
      message: 'مهلت پاسخ خصوصی به کامنت در حال پایان است.',
    })
  })

  it('fails closed for arbitrary drafts and malformed recipient or lead time', () => {
    expect(parseInboxTemplate({ triggers: [{ type: 'schedule', config: { cron: '* * * * *' } }],
      conditions: [], actions: [{ type: 'send_notification', config: { message: 'hello' } }] })).toBeNull()
    const team = notifyTeamDefinition('urgent', 'member-1')
    team.actions[2].config.recipient = 'all'
    expect(parseInboxTemplate(team)).toBeNull()
    expect(parseInboxTemplate(replyWindowReminderDefinition(0))).toBeNull()
    expect(parseInboxTemplate(replyWindowReminderDefinition(1441))).toBeNull()
    expect(parseInboxTemplate({ ...tagUnansweredDefinition(),
      actions: [{ type: 'add_tag', config: { tag: 'unanswered' } },
        { type: 'call_webhook', config: { url: 'https://example.com' } }],
    })).toBeNull()
  })
})
