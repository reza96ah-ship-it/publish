/**
 * Issue #248: Customer profiles + case management — service.
 *
 * Business-logic layer. Follows the smart-pages/service.ts pattern:
 *   - Constructor injects the repository (default = new instance).
 *   - Cursor pagination handled in the service: repo returns `limit+1` rows,
 *     service slices + derives `nextCursor`.
 *   - Throws domain errors (CustomerError subclasses) — route handlers map
 *     them to HTTP via `instanceof CustomerError`.
 *
 * mergeCustomers: re-points interactions + participants to the target customer,
 * then marks the source as merged (mergedIntoId = targetId). Soft delete uses
 * the same mechanism (mergedIntoId = self) so list() filters it out without
 * losing interaction history.
 */

import { CustomersRepository } from './repository'
import {
  CustomerNotFoundError,
  CaseNotFoundError,
  ParticipantNotFoundError,
  DuplicateParticipantError,
  MergeConflictError,
  ValidationError,
} from './errors'
import type {
  AuthContext,
  CustomerListQuery,
  CustomerListResult,
  CustomerItem,
  CustomerDetail,
  CreateCustomerInput,
  UpdateCustomerInput,
  CreateInteractionInput,
  CustomerInteractionItem,
  CaseListQuery,
  CaseListResult,
  CaseItem,
  CaseDetail,
  CreateCaseInput,
  UpdateCaseInput,
  AddParticipantInput,
  CaseParticipantItem,
} from './types'

const DEFAULT_LIMIT = 20

function isPrismaUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: unknown }).code === 'P2002'
  )
}

export class CustomersService {
  constructor(private readonly repo: CustomersRepository = new CustomersRepository()) {}

  // ── Customers ──────────────────────────────────────────────────────────────

  async listCustomers(auth: AuthContext, query: CustomerListQuery): Promise<CustomerListResult> {
    const limit = query.limit ?? DEFAULT_LIMIT
    const rows = await this.repo.list(auth.workspaceId, { ...query, limit })
    const hasMore = rows.length > limit
    const page = hasMore ? rows.slice(0, limit) : rows
    const nextCursor = hasMore ? page[page.length - 1]?.id ?? null : null
    return { data: page, nextCursor }
  }

  async getCustomer(auth: AuthContext, id: string): Promise<CustomerDetail> {
    const detail = await this.repo.getCustomerDetail(id, auth.workspaceId)
    if (!detail) throw new CustomerNotFoundError()
    return detail
  }

  async createCustomer(auth: AuthContext, input: CreateCustomerInput): Promise<CustomerItem> {
    if (!input.name || input.name.trim().length === 0) {
      throw new ValidationError('نام مشتری الزامی است')
    }
    try {
      return await this.repo.create(auth.workspaceId, input)
    } catch (err) {
      if (isPrismaUniqueViolation(err)) {
        throw new ValidationError('مشتری با این مشخصات قبلاً ثبت شده است')
      }
      throw err
    }
  }

  async updateCustomer(auth: AuthContext, id: string, input: UpdateCustomerInput): Promise<CustomerItem> {
    const existing = await this.repo.findByIdInWorkspace(id, auth.workspaceId)
    if (!existing) throw new CustomerNotFoundError()
    return this.repo.update(id, input)
  }

  /** Soft delete: marks the customer as merged-into-self so list() filters it. */
  async deleteCustomer(auth: AuthContext, id: string): Promise<void> {
    const existing = await this.repo.findByIdInWorkspace(id, auth.workspaceId)
    if (!existing) throw new CustomerNotFoundError()
    await this.repo.softDelete(id)
  }

  /**
   * Merge source into target. Re-points all interactions + case participants
   * from source → target, then marks source as merged (mergedIntoId = targetId).
   * The source customer row is preserved (audit trail); list() hides it.
   */
  async mergeCustomers(auth: AuthContext, sourceId: string, targetId: string): Promise<void> {
    if (sourceId === targetId) throw new MergeConflictError()
    const source = await this.repo.findByIdInWorkspace(sourceId, auth.workspaceId)
    if (!source) throw new CustomerNotFoundError('مشتری مبدأ یافت نشد')
    const target = await this.repo.findByIdInWorkspace(targetId, auth.workspaceId)
    if (!target) throw new CustomerNotFoundError('مشتری هدف یافت نشد')
    if (source.mergedIntoId) throw new MergeConflictError('مشتری مبدأ قبلاً ادغام شده است')
    await this.repo.merge(sourceId, targetId)
  }

  // ── Interactions ───────────────────────────────────────────────────────────

  async listInteractions(auth: AuthContext, customerId: string): Promise<CustomerInteractionItem[]> {
    const customer = await this.repo.findByIdInWorkspace(customerId, auth.workspaceId)
    if (!customer) throw new CustomerNotFoundError()
    return this.repo.listInteractions(customerId, auth.workspaceId)
  }

  async addInteraction(
    auth: AuthContext,
    customerId: string,
    input: CreateInteractionInput
  ): Promise<CustomerInteractionItem> {
    const customer = await this.repo.findByIdInWorkspace(customerId, auth.workspaceId)
    if (!customer) throw new CustomerNotFoundError()
    return this.repo.addInteraction(customerId, auth.workspaceId, input)
  }

  // ── Cases ──────────────────────────────────────────────────────────────────

  async listCases(auth: AuthContext, query: CaseListQuery): Promise<CaseListResult> {
    const limit = query.limit ?? DEFAULT_LIMIT
    const rows = await this.repo.listCases(auth.workspaceId, { ...query, limit })
    const hasMore = rows.length > limit
    const page = hasMore ? rows.slice(0, limit) : rows
    const nextCursor = hasMore ? page[page.length - 1]?.id ?? null : null
    return { data: page, nextCursor }
  }

  async getCase(auth: AuthContext, id: string): Promise<CaseDetail> {
    const detail = await this.repo.getCaseDetail(id, auth.workspaceId)
    if (!detail) throw new CaseNotFoundError()
    return detail
  }

  async createCase(auth: AuthContext, input: CreateCaseInput): Promise<CaseItem> {
    if (!input.title || input.title.trim().length === 0) {
      throw new ValidationError('عنوان پرونده الزامی است')
    }
    return this.repo.createCase(auth.workspaceId, input)
  }

  async updateCase(auth: AuthContext, id: string, input: UpdateCaseInput): Promise<CaseItem> {
    const existing = await this.repo.findCaseByIdInWorkspace(id, auth.workspaceId)
    if (!existing) throw new CaseNotFoundError()
    return this.repo.updateCase(id, input)
  }

  async deleteCase(auth: AuthContext, id: string): Promise<void> {
    const existing = await this.repo.findCaseByIdInWorkspace(id, auth.workspaceId)
    if (!existing) throw new CaseNotFoundError()
    await this.repo.deleteCase(id)
  }

  // ── Participants ───────────────────────────────────────────────────────────

  async addParticipant(
    auth: AuthContext,
    caseId: string,
    input: AddParticipantInput
  ): Promise<CaseParticipantItem> {
    const caseRow = await this.repo.findCaseByIdInWorkspace(caseId, auth.workspaceId)
    if (!caseRow) throw new CaseNotFoundError()
    const existing = await this.repo.findParticipant(caseId, input.customerId)
    if (existing) throw new DuplicateParticipantError()
    try {
      return await this.repo.addParticipant(caseId, input)
    } catch (err) {
      if (isPrismaUniqueViolation(err)) throw new DuplicateParticipantError()
      throw err
    }
  }

  async removeParticipant(auth: AuthContext, caseId: string, participantId: string): Promise<void> {
    const caseRow = await this.repo.findCaseByIdInWorkspace(caseId, auth.workspaceId)
    if (!caseRow) throw new CaseNotFoundError()
    const participant = await this.repo.findParticipantById(participantId)
    if (!participant || participant.caseId !== caseId) {
      throw new ParticipantNotFoundError()
    }
    await this.repo.removeParticipant(participantId)
  }
}

export const customersService = new CustomersService()
