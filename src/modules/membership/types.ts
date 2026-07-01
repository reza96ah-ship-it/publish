/**
 * Issue #156: Membership domain module — types.
 *
 * Pure domain types shared between route handler, service, and repository.
 * No imports from Prisma or Next.js here.
 */

import type { Role } from '@/lib/api-contracts'

export interface AuthContext {
  workspaceId: string
  userId: string
  role: Role
}

export interface AcceptAuthContext {
  /** Signed-in user accepting the invitation (not workspace-scoped). */
  userId: string
  email: string
  name: string | null
}

export type InvitationRole = 'admin' | 'editor' | 'approver' | 'viewer'

export interface CreateInvitationRequest {
  email: string
  name?: string
  role: InvitationRole
}

export interface CreateInvitationResult {
  ok: true
  email: string
  role: InvitationRole
  expiresAt: string
  /** Plaintext token — returned ONCE so the admin can share it. Never stored. */
  inviteToken: string
  message: string
}

export interface AcceptInvitationRequest {
  token: string
}

export interface AcceptInvitationResult {
  ok: true
  message: string
  workspaceId: string
  role: InvitationRole
}

export interface RevokeInvitationRequest {
  id: string
}

export interface RevokeInvitationResult {
  ok: true
  message: string
}

export type InvitationStatus = 'pending' | 'accepted' | 'revoked' | 'expired'

export interface InvitationListItem {
  id: string
  email: string
  role: InvitationRole
  status: InvitationStatus
  expiresAt: string
  acceptedAt: string | null
  revokedAt: string | null
  createdAt: string
}

export interface ListInvitationsResult {
  data: InvitationListItem[]
}

export interface MemberListItem {
  id: string
  name: string
  email: string
  role: InvitationRole
  roleLabel: string
  avatar: string | null
}

export interface ListMembersResult {
  data: MemberListItem[]
  nextCursor: string | null
}

export interface ChangeRoleRequest {
  role: InvitationRole
}

export interface ChangeRoleResult {
  ok: true
  id: string
  role: InvitationRole
}

export interface RemoveMemberResult {
  ok: true
}

export interface ListQuery {
  cursor?: string
  limit: number
}

// Repository row shapes — mirror the Prisma model projections.

export interface MemberRow {
  id: string
  workspaceId: string
  userId: string
  name: string
  email: string
  role: string
  avatarUrl: string | null
}

export interface InvitationRow {
  id: string
  workspaceId: string
  emailNormalized: string
  role: InvitationRole
  tokenHash: string
  invitedById: string | null
  acceptedAt: Date | null
  acceptedById: string | null
  revokedAt: Date | null
  expiresAt: Date
  createdAt: Date
  workspace?: { id: string; name: string }
}
