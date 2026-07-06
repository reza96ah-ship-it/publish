export interface UtmParams {
  source: string
  medium: string
  campaign?: string
  term?: string
  content?: string
}

/**
 * Appends UTM parameters to a URL. Skips empty values.
 * Preserves existing query parameters.
 */
export function appendUtmParams(url: string, params: UtmParams): string {
  try {
    const u = new URL(url)
    if (params.source) u.searchParams.set('utm_source', params.source)
    if (params.medium) u.searchParams.set('utm_medium', params.medium)
    if (params.campaign) u.searchParams.set('utm_campaign', params.campaign)
    if (params.term) u.searchParams.set('utm_term', params.term)
    if (params.content) u.searchParams.set('utm_content', params.content)
    return u.toString()
  } catch {
    // Invalid URL — return as-is
    return url
  }
}

/**
 * Validate that a string is a well-formed https:// URL.
 */
export function isValidUrl(url: string): boolean {
  try {
    const u = new URL(url)
    return u.protocol === 'https:' || u.protocol === 'http:'
  } catch {
    return false
  }
}

/**
 * Extract the base domain for display purposes.
 */
export function displayDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/**
 * Build a full UTM URL preview string from base URL + params.
 */
export function buildUtmPreview(url: string, params: Partial<UtmParams>): string {
  if (!url || !isValidUrl(url)) return url
  return appendUtmParams(url, {
    source: params.source ?? '',
    medium: params.medium ?? '',
    campaign: params.campaign ?? '',
    term: params.term ?? '',
    content: params.content ?? '',
  })
}
