/**
 * Issue #250: Smart Pages (link-in-bio) domain module — types.
 *
 * A Smart Page is a single public landing page that aggregates a workspace's
 * important links (link-in-bio). Each page is a vertical stack of "blocks":
 * links, social icons, headings, text, images, and a dynamic "latest posts"
 * block. Visitors view the page at /p/[slug]; click events are tracked.
 */

export interface AuthContext {
  workspaceId: string
  userId: string
}

// ── Block definitions ────────────────────────────────────────────────────────
//
// blocks is stored as a JSON column on SmartPage. The runtime shape is a
// discriminated union on the `type` field. Order in the array = order on page.

export type SmartPageBlock =
  | { type: 'link'; id: string; label: string; url: string; icon?: string }
  | { type: 'social'; id: string; platform: string; url: string; label?: string }
  | { type: 'heading'; id: string; text: string }
  | { type: 'text'; id: string; text: string }
  | {
      type: 'image'
      id: string
      url: string
      alt: string
      caption?: string
    }
  | { type: 'latest-posts'; id: string; limit: number; label?: string }

// ── Item shapes ──────────────────────────────────────────────────────────────

export interface SmartPageItem {
  id: string
  workspaceId: string
  slug: string
  title: string
  description: string | null
  avatarUrl: string | null
  blocks: SmartPageBlock[]
  isPublished: boolean
  views: number
  clicks: number
  createdAt: Date
  updatedAt: Date
}

/**
 * Public-facing Smart Page payload (returned by findBySlug).
 * Adds the workspace's brand colors so the rendered /p/[slug] page can use
 * the workspace's identity without an extra API round-trip.
 */
export interface PublicSmartPageItem extends SmartPageItem {
  brandPrimaryColor: string
  brandAccentColor: string
  workspaceName: string
}

// ── List query / result ──────────────────────────────────────────────────────

export interface SmartPageListQuery {
  cursor?: string
  limit?: number
}

export interface SmartPageListResult {
  data: SmartPageItem[]
  nextCursor: string | null
}

// ── Create / Update inputs ───────────────────────────────────────────────────

export interface CreateSmartPageInput {
  slug: string
  title: string
  description?: string
  avatarUrl?: string | null
  blocks?: SmartPageBlock[]
  isPublished?: boolean
}

export type UpdateSmartPageInput = Partial<CreateSmartPageInput>

// ── Click tracking ───────────────────────────────────────────────────────────

export interface ClickInput {
  blockId: string
  blockType: string
  label: string
  url: string
  referrer?: string
  userAgent?: string
}

export interface ClickStat {
  date: string // YYYY-MM-DD
  clicks: number
}
