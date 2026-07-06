/**
 * Issue #248: Customer profiles + case management — types.
 *
 * A Customer is a unified contact record across platforms (Instagram handle,
 * Telegram username, email, phone). CustomerInteraction logs every inbound/
 * outbound touchpoint. A Case bundles related interactions + participants so
 * an agent can follow a customer issue from open → resolution.
 *
 * Soft delete: customers are not hard-deleted (to preserve interaction
 * history). mergeCustomers points `mergedIntoId` at the canonical record so
 * duplicates collapse without losing their interactions.
 */

export interface AuthContext {
  workspaceId: string
  userId: string
}

// Social handles: { instagram: '@user', telegram: '@user', ... }
export type SocialHandles = Record<string, string>

export type ConsentStatus = 'unknown' | 'granted' | 'denied'

export type InteractionType = 'comment' | 'dm' | 'mention' | 'reply'
export type InteractionDirection = 'inbound' | 'outbound'

export type CaseStatus = 'open' | 'in_progress' | 'resolved' | 'closed'
export type CasePriority = 'low' | 'normal' | 'high' | 'urgent'
export type ParticipantRole = 'primary' | 'cc' | 'mentioned'

// ── Item shapes ──────────────────────────────────────────────────────────────

export interface CustomerItem {
  id: string
  workspaceId: string
  name: string
  email: string | null
  phone: string | null
  socialHandles: SocialHandles
  avatarUrl: string | null
  tags: string[]
  notes: string | null
  consentStatus: ConsentStatus
  optOutAt: Date | null
  mergedIntoId: string | null
  createdAt: Date
  updatedAt: Date
}

export interface CustomerInteractionItem {
  id: string
  customerId: string
  workspaceId: string
  type: InteractionType
  platform: string
  content: string
  direction: InteractionDirection
  inboxMessageId: string | null
  handledBy: string | null
  createdAt: Date
}

export interface CaseItem {
  id: string
  workspaceId: string
  title: string
  description: string | null
  status: CaseStatus
  priority: CasePriority
  resolution: string | null
  assigneeId: string | null
  linkedMessageIds: string[]
  createdAt: Date
  updatedAt: Date
  resolvedAt: Date | null
  closedAt: Date | null
}

export interface CaseParticipantItem {
  id: string
  caseId: string
  customerId: string
  role: ParticipantRole
  addedAt: Date
  customer?: CustomerItem
}

/** Customer with their full interaction timeline + linked cases (admin view). */
export interface CustomerDetail extends CustomerItem {
  interactions: CustomerInteractionItem[]
  cases: { id: string; title: string; status: CaseStatus; role: ParticipantRole }[]
}

/** Case with its participants expanded (admin view). */
export interface CaseDetail extends CaseItem {
  participants: CaseParticipantItem[]
}

// ── List queries / results ───────────────────────────────────────────────────

export interface CustomerListQuery {
  search?: string
  tag?: string
  cursor?: string
  limit?: number
}

export interface CustomerListResult {
  data: CustomerItem[]
  nextCursor: string | null
}

export interface CaseListQuery {
  status?: CaseStatus
  assigneeId?: string
  cursor?: string
  limit?: number
}

export interface CaseListResult {
  data: CaseItem[]
  nextCursor: string | null
}

// ── Create / Update inputs ───────────────────────────────────────────────────

export interface CreateCustomerInput {
  name: string
  email?: string | null
  phone?: string | null
  socialHandles?: SocialHandles
  avatarUrl?: string | null
  tags?: string[]
  notes?: string | null
  consentStatus?: ConsentStatus
}

export type UpdateCustomerInput = Partial<CreateCustomerInput> & {
  optOutAt?: Date | null
}

export interface CreateInteractionInput {
  type: InteractionType
  platform: string
  content: string
  direction?: InteractionDirection
  inboxMessageId?: string | null
  handledBy?: string | null
}

export interface CreateCaseInput {
  title: string
  description?: string
  priority?: CasePriority
  assigneeId?: string | null
  linkedMessageIds?: string[]
}

export type UpdateCaseInput = Partial<CreateCaseInput> & {
  status?: CaseStatus
  resolution?: string | null
}

export interface AddParticipantInput {
  customerId: string
  role?: ParticipantRole
}
