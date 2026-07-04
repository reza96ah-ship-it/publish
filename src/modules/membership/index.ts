/**
 * Issue #156: Membership domain module — public API.
 *
 * Re-exports the service + types so route handlers can import from a single
 * entry point:
 *   import { membershipService, type CreateInvitationRequest } from '@/modules/membership'
 */

export { MembershipService } from './service'
export { MembershipRepository } from './repository'
export type {
  AuthContext,
  AcceptAuthContext,
  InvitationRole,
  CreateInvitationRequest,
  CreateInvitationResult,
  AcceptInvitationRequest,
  AcceptInvitationResult,
  RevokeInvitationRequest,
  RevokeInvitationResult,
  ListInvitationsResult,
  ListMembersResult,
  ChangeRoleRequest,
  ChangeRoleResult,
  RemoveMemberResult,
  ListQuery,
  InvitationListItem,
  MemberListItem,
  MemberRow,
  InvitationRow,
  InvitationStatus,
} from './types'
export {
  MembershipError,
  ValidationError,
  AlreadyMemberError,
  InvitationAlreadyAcceptedError,
  InvitationConflictError,
  InvitationNotFoundError,
  InvitationInvalidError,
  InvitationExpiredError,
  InvitationRevokedError,
  InvitationAcceptMismatchError,
  CannotRevokeAcceptedInvitationError,
  MemberNotFoundError,
  LastAdminError,
  CannotRemoveLastAdminError,
  CannotRemoveSelfError,
} from './errors'

import { MembershipService } from './service'
export const membershipService = new MembershipService()
