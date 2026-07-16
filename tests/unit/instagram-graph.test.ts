import { describe, expect, it } from 'vitest'
import {
  DEFAULT_INSTAGRAM_GRAPH_API_VERSION,
  INSTAGRAM_GRAPH_API_VERSION_ENV,
  INSTAGRAM_INBOX_API_LIMITS,
  INSTAGRAM_INBOX_REQUIRED_SCOPES,
  buildInstagramGraphApiUrl,
  getInstagramGraphApiBaseUrl,
  getInstagramGraphApiMetadata,
  getInstagramGraphApiVersion,
  normalizeInstagramGraphApiVersion,
} from '../../shared/instagram-graph'
import { getCapabilities } from '../../shared/provider-capabilities'

describe('Instagram Graph API config', () => {
  it('defaults every Instagram Graph caller to the current shared version', () => {
    expect(DEFAULT_INSTAGRAM_GRAPH_API_VERSION).toBe('v25.0')
    expect(getInstagramGraphApiVersion({})).toBe('v25.0')
    expect(getInstagramGraphApiBaseUrl({})).toBe('https://graph.instagram.com/v25.0')
    expect(getCapabilities('instagram').apiVersion).toBe('Graph API v25.0')
  })

  it('normalizes operator-provided versions', () => {
    expect(normalizeInstagramGraphApiVersion('25.0')).toBe('v25.0')
    expect(normalizeInstagramGraphApiVersion('25')).toBe('v25.0')
    expect(normalizeInstagramGraphApiVersion('v24.0')).toBe('v24.0')
    expect(normalizeInstagramGraphApiVersion(' V23.0 ')).toBe('v23.0')
    expect(normalizeInstagramGraphApiVersion('latest')).toBe('v25.0')
  })

  it('builds URLs without double slashes', () => {
    const env = { [INSTAGRAM_GRAPH_API_VERSION_ENV]: 'v24.0' }

    expect(buildInstagramGraphApiUrl('/123/messages', env)).toBe(
      'https://graph.instagram.com/v24.0/123/messages'
    )
    expect(buildInstagramGraphApiUrl('123/comments', env)).toBe(
      'https://graph.instagram.com/v24.0/123/comments'
    )
  })

  it('documents Instagram inbox API constraints for UI and worker features', () => {
    expect(INSTAGRAM_INBOX_REQUIRED_SCOPES).toContain('instagram_business_manage_messages')
    expect(INSTAGRAM_INBOX_REQUIRED_SCOPES).toContain('instagram_business_manage_comments')
    expect(INSTAGRAM_INBOX_API_LIMITS.privateReplyWindowDays).toBe(7)
    expect(INSTAGRAM_INBOX_API_LIMITS.conversationMessageReadLimit).toBe(20)
    expect(INSTAGRAM_INBOX_API_LIMITS.webhookFirstEvents).toContain('messages')

    const metadata = getInstagramGraphApiMetadata({})
    expect(metadata.requiredScopes).toBe(INSTAGRAM_INBOX_REQUIRED_SCOPES)
    expect(metadata.inboxLimits).toBe(INSTAGRAM_INBOX_API_LIMITS)
    expect(metadata.isDefaultVersion).toBe(true)
  })
})
