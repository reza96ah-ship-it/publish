import { describe, it, expect } from 'vitest'
import {
  deriveContentStatus,
  type JobStatus,
} from '../../../mini-services/publish-worker/lib/state-reducer'

describe('deriveContentStatus — MISS-06 aggregate reducer', () => {
  // Table-driven tests — all 7 required cases from the issue
  const cases: {
    label: string
    input: JobStatus[]
    expectedStatus: string
    markPublishedAt: boolean
  }[] = [
    {
      label: '[published, published] → published',
      input: ['success', 'success'],
      expectedStatus: 'published',
      markPublishedAt: true,
    },
    {
      label: '[published, failed] → partially_published',
      input: ['success', 'failed'],
      expectedStatus: 'partially_published',
      markPublishedAt: false,
    },
    {
      label: '[failed, failed] → failed',
      input: ['failed', 'failed'],
      expectedStatus: 'failed',
      markPublishedAt: false,
    },
    {
      label: '[published, action_required] → action_required',
      input: ['success', 'action'],
      expectedStatus: 'action_required',
      markPublishedAt: false,
    },
    {
      label: '[publishing, published] → publishing',
      input: ['processing', 'success'],
      expectedStatus: 'publishing',
      markPublishedAt: false,
    },
    {
      label: '[cancelled, cancelled] → cancelled',
      input: ['cancelled', 'cancelled'],
      expectedStatus: 'cancelled',
      markPublishedAt: false,
    },
    {
      label: '[queued] → publishing',
      input: ['pending'],
      expectedStatus: 'publishing',
      markPublishedAt: false,
    },
  ]

  for (const tc of cases) {
    it(tc.label, () => {
      const result = deriveContentStatus(tc.input)
      expect(result.status).toBe(tc.expectedStatus)
      expect(result.markPublishedAt).toBe(tc.markPublishedAt)
    })
  }

  // Edge cases
  it('empty job list → failed', () => {
    expect(deriveContentStatus([]).status).toBe('failed')
  })

  it('action_required takes priority over failed', () => {
    expect(deriveContentStatus(['failed', 'action', 'failed']).status).toBe('action_required')
  })

  it('active job takes priority over mix of success+failed', () => {
    expect(deriveContentStatus(['success', 'failed', 'processing']).status).toBe('publishing')
  })

  it('single success → published with publishedAt', () => {
    const result = deriveContentStatus(['success'])
    expect(result.status).toBe('published')
    expect(result.markPublishedAt).toBe(true)
  })

  it('scheduled is treated as active', () => {
    expect(deriveContentStatus(['scheduled', 'success']).status).toBe('publishing')
  })
})
