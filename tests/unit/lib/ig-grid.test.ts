import { describe, it, expect } from 'vitest'
import { computeSlotSwap } from '@/lib/ig-grid'

// Grid order is newest-first: slot 0 = latest publish time.
const items = [
  { jobId: 'a', at: '2026-07-10T10:00:00.000Z' },
  { jobId: 'b', at: '2026-07-08T10:00:00.000Z' },
  { jobId: 'c', at: '2026-07-06T10:00:00.000Z' },
]

describe('computeSlotSwap', () => {
  it('swaps adjacent items and exchanges their publish times', () => {
    const { moved, changes } = computeSlotSwap(items, 0, 1)
    expect(moved.map((i) => i.jobId)).toEqual(['b', 'a', 'c'])
    expect(changes).toEqual([
      { jobId: 'b', scheduledAt: '2026-07-10T10:00:00.000Z' },
      { jobId: 'a', scheduledAt: '2026-07-08T10:00:00.000Z' },
    ])
  })

  it('moving first to last rotates every slot', () => {
    const { moved, changes } = computeSlotSwap(items, 0, 2)
    expect(moved.map((i) => i.jobId)).toEqual(['b', 'c', 'a'])
    expect(changes).toHaveLength(3)
    // The set of slot times is preserved — only the assignment changes
    expect(changes.map((c) => c.scheduledAt).sort()).toEqual(items.map((i) => i.at).sort())
  })

  it('keeps grid positions anchored to their original times', () => {
    const { moved, slots } = computeSlotSwap(items, 2, 0)
    expect(slots).toEqual(items.map((i) => i.at))
    expect(moved[0].jobId).toBe('c')
  })

  it('no-op move produces no changes', () => {
    const { changes } = computeSlotSwap(items, 1, 1)
    expect(changes).toEqual([])
  })

  it('skips items landing on a null slot', () => {
    const withNull = [...items, { jobId: 'd', at: null }]
    const { changes } = computeSlotSwap(withNull, 3, 2)
    // 'd' takes c's slot (real time) and 'c' lands on the null slot — only 'd' changes
    expect(changes).toEqual([{ jobId: 'd', scheduledAt: '2026-07-06T10:00:00.000Z' }])
  })
})
