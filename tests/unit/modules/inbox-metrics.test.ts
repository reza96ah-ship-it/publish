import { describe, expect, it } from 'vitest'
import { combineInboxMetricCounts, INBOX_SLA_TARGET_MINUTES } from '@/modules/inbox/metrics'

describe('inbox operational metrics', () => {
  it('combines thread and unmirrored legacy inbox counts', () => {
    const metrics = combineInboxMetricCounts({
      threadUnread: 5,
      legacyUnread: 2,
      threadSlaRisk: 3,
      legacySlaRisk: 1,
    })

    expect(metrics.unreadInbox).toBe(7)
    expect(metrics.slaRisk).toBe(4)
    expect(metrics.slaTargetMinutes).toBe(INBOX_SLA_TARGET_MINUTES)
  })

  it('guards dashboard badges from negative or fractional counts', () => {
    const metrics = combineInboxMetricCounts({
      threadUnread: -5,
      legacyUnread: 1.8,
      threadSlaRisk: -1,
      legacySlaRisk: 2.9,
    })

    expect(metrics).toMatchObject({
      threadUnread: 0,
      legacyUnread: 1,
      unreadInbox: 1,
      threadSlaRisk: 0,
      legacySlaRisk: 2,
      slaRisk: 2,
    })
  })
})
