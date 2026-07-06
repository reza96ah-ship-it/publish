/**
 * Issue #248: Customer profiles + case management — repository.
 *
 * Data-access layer. The only file in this module that imports `db`.
 * Follows the smart-pages/repository.ts pattern:
 *   - Cursor pagination: `list()` takes `limit + 1` rows so the service can
 *     derive `nextCursor`.
 *   - JSON columns (socialHandles, definition) are coerced to the typed shape
 *     via a `toItem()` mapper.
 */

import { db } from '@/lib/db'
import type { Prisma } from '@prisma/client'
import type {
  CustomerItem,
  CustomerInteractionItem,
  CaseItem,
  CaseParticipantItem,
  CustomerDetail,
  CaseDetail,
  CustomerListQuery,
  CaseListQuery,
  CreateCustomerInput,
  UpdateCustomerInput,
  CreateInteractionInput,
  CreateCaseInput,
  UpdateCaseInput,
  AddParticipantInput,
  SocialHandles,
  ConsentStatus,
  InteractionType,
  InteractionDirection,
  CaseStatus,
  CasePriority,
  ParticipantRole,
} from './types'

// ── Row → Item mappers ───────────────────────────────────────────────────────

function toCustomer(row: {
  id: string
  workspaceId: string
  name: string
  email: string | null
  phone: string | null
  socialHandles: Prisma.JsonValue
  avatarUrl: string | null
  tags: string[]
  notes: string | null
  consentStatus: string
  optOutAt: Date | null
  mergedIntoId: string | null
  createdAt: Date
  updatedAt: Date
}): CustomerItem {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    email: row.email,
    phone: row.phone,
    socialHandles: (row.socialHandles && typeof row.socialHandles === 'object'
      ? row.socialHandles
      : {}) as SocialHandles,
    avatarUrl: row.avatarUrl,
    tags: row.tags ?? [],
    notes: row.notes,
    consentStatus: row.consentStatus as ConsentStatus,
    optOutAt: row.optOutAt,
    mergedIntoId: row.mergedIntoId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function toInteraction(row: {
  id: string
  customerId: string
  workspaceId: string
  type: string
  platform: string
  content: string
  direction: string
  inboxMessageId: string | null
  handledBy: string | null
  createdAt: Date
}): CustomerInteractionItem {
  return {
    id: row.id,
    customerId: row.customerId,
    workspaceId: row.workspaceId,
    type: row.type as InteractionType,
    platform: row.platform,
    content: row.content,
    direction: row.direction as InteractionDirection,
    inboxMessageId: row.inboxMessageId,
    handledBy: row.handledBy,
    createdAt: row.createdAt,
  }
}

function toCase(row: {
  id: string
  workspaceId: string
  title: string
  description: string | null
  status: string
  priority: string
  resolution: string | null
  assigneeId: string | null
  linkedMessageIds: string[]
  createdAt: Date
  updatedAt: Date
  resolvedAt: Date | null
  closedAt: Date | null
}): CaseItem {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    title: row.title,
    description: row.description,
    status: row.status as CaseStatus,
    priority: row.priority as CasePriority,
    resolution: row.resolution,
    assigneeId: row.assigneeId,
    linkedMessageIds: row.linkedMessageIds ?? [],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    resolvedAt: row.resolvedAt,
    closedAt: row.closedAt,
  }
}

function toParticipant(row: {
  id: string
  caseId: string
  customerId: string
  role: string
  addedAt: Date
  customer?: unknown
}): CaseParticipantItem {
  return {
    id: row.id,
    caseId: row.caseId,
    customerId: row.customerId,
    role: row.role as ParticipantRole,
    addedAt: row.addedAt,
    ...(row.customer ? { customer: toCustomer(row.customer as Parameters<typeof toCustomer>[0]) } : {}),
  }
}

// ── Repository ───────────────────────────────────────────────────────────────

export class CustomersRepository {
  // ── Customers ──────────────────────────────────────────────────────────────

  async list(workspaceId: string, query: CustomerListQuery): Promise<CustomerItem[]> {
    const limit = query.limit ?? 20
    const where: Prisma.CustomerWhereInput = {
      workspaceId,
      mergedIntoId: null, // hide merged duplicates
      ...(query.tag ? { tags: { has: query.tag } } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
              { phone: { contains: query.search } },
            ],
          }
        : {}),
    }
    const rows = await db.customer.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    })
    return rows.map(toCustomer)
  }

  async findByIdInWorkspace(id: string, workspaceId: string): Promise<CustomerItem | null> {
    const row = await db.customer.findFirst({ where: { id, workspaceId } })
    return row ? toCustomer(row) : null
  }

  /** Get a customer with their interactions + linked cases (admin detail view). */
  async getCustomerDetail(id: string, workspaceId: string): Promise<CustomerDetail | null> {
    const row = await db.customer.findFirst({
      where: { id, workspaceId },
      include: {
        interactions: { orderBy: { createdAt: 'desc' }, take: 200 },
        cases: { include: { case: true } },
      },
    })
    if (!row) return null
    const base = toCustomer(row)
    return {
      ...base,
      interactions: (row.interactions ?? []).map(toInteraction),
      cases: (row.cases ?? []).map((cp) => ({
        id: cp.case.id,
        title: cp.case.title,
        status: cp.case.status as CaseStatus,
        role: cp.role as ParticipantRole,
      })),
    }
  }

  async create(workspaceId: string, data: CreateCustomerInput): Promise<CustomerItem> {
    const row = await db.customer.create({
      data: {
        workspaceId,
        name: data.name,
        email: data.email ?? null,
        phone: data.phone ?? null,
        socialHandles: (data.socialHandles ?? {}) as Prisma.InputJsonValue,
        avatarUrl: data.avatarUrl ?? null,
        tags: data.tags ?? [],
        notes: data.notes ?? null,
        consentStatus: data.consentStatus ?? 'unknown',
      },
    })
    return toCustomer(row)
  }

  async update(id: string, data: UpdateCustomerInput): Promise<CustomerItem> {
    const row = await db.customer.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.email !== undefined ? { email: data.email } : {}),
        ...(data.phone !== undefined ? { phone: data.phone } : {}),
        ...(data.socialHandles !== undefined
          ? { socialHandles: data.socialHandles as Prisma.InputJsonValue }
          : {}),
        ...(data.avatarUrl !== undefined ? { avatarUrl: data.avatarUrl } : {}),
        ...(data.tags !== undefined ? { tags: data.tags } : {}),
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
        ...(data.consentStatus !== undefined ? { consentStatus: data.consentStatus } : {}),
        ...(data.optOutAt !== undefined ? { optOutAt: data.optOutAt } : {}),
      },
    })
    return toCustomer(row)
  }

  /** Soft delete: mark merged-into self so list() filters it out. */
  async softDelete(id: string): Promise<void> {
    // We don't expose a deleted flag; instead we set mergedIntoId to a sentinel
    // by pointing at itself. The list() filter excludes mergedIntoId != null.
    // For true soft-delete we use the same mechanism: point at itself.
    await db.customer.update({
      where: { id },
      data: { mergedIntoId: id },
    })
  }

  /** Merge source into target: re-point interactions, mark source merged. */
  async merge(sourceId: string, targetId: string): Promise<void> {
    await db.$transaction([
      db.customerInteraction.updateMany({
        where: { customerId: sourceId },
        data: { customerId: targetId },
      }),
      db.caseParticipant.updateMany({
        where: { customerId: sourceId },
        data: { customerId: targetId },
      }),
      db.customer.update({
        where: { id: sourceId },
        data: { mergedIntoId: targetId },
      }),
    ])
  }

  // ── Interactions ───────────────────────────────────────────────────────────

  async listInteractions(customerId: string, workspaceId: string): Promise<CustomerInteractionItem[]> {
    const rows = await db.customerInteraction.findMany({
      where: { customerId, workspaceId },
      orderBy: { createdAt: 'desc' },
      take: 200,
    })
    return rows.map(toInteraction)
  }

  async addInteraction(
    customerId: string,
    workspaceId: string,
    data: CreateInteractionInput
  ): Promise<CustomerInteractionItem> {
    const row = await db.customerInteraction.create({
      data: {
        customerId,
        workspaceId,
        type: data.type,
        platform: data.platform,
        content: data.content,
        direction: data.direction ?? 'inbound',
        inboxMessageId: data.inboxMessageId ?? null,
        handledBy: data.handledBy ?? null,
      },
    })
    return toInteraction(row)
  }

  // ── Cases ──────────────────────────────────────────────────────────────────

  async listCases(workspaceId: string, query: CaseListQuery): Promise<CaseItem[]> {
    const limit = query.limit ?? 20
    const where: Prisma.CaseWhereInput = {
      workspaceId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.assigneeId ? { assigneeId: query.assigneeId } : {}),
    }
    const rows = await db.case.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    })
    return rows.map(toCase)
  }

  async findCaseByIdInWorkspace(id: string, workspaceId: string): Promise<CaseItem | null> {
    const row = await db.case.findFirst({ where: { id, workspaceId } })
    return row ? toCase(row) : null
  }

  async getCaseDetail(id: string, workspaceId: string): Promise<CaseDetail | null> {
    const row = await db.case.findFirst({
      where: { id, workspaceId },
      include: { participants: { include: { customer: true } } },
    })
    if (!row) return null
    return {
      ...toCase(row),
      participants: (row.participants ?? []).map((p) =>
        toParticipant({
          id: p.id,
          caseId: p.caseId,
          customerId: p.customerId,
          role: p.role,
          addedAt: p.addedAt,
          customer: p.customer,
        })
      ),
    }
  }

  async createCase(workspaceId: string, data: CreateCaseInput): Promise<CaseItem> {
    const row = await db.case.create({
      data: {
        workspaceId,
        title: data.title,
        description: data.description ?? null,
        priority: data.priority ?? 'normal',
        assigneeId: data.assigneeId ?? null,
        linkedMessageIds: data.linkedMessageIds ?? [],
      },
    })
    return toCase(row)
  }

  async updateCase(id: string, data: UpdateCaseInput): Promise<CaseItem> {
    const now = new Date()
    const row = await db.case.update({
      where: { id },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.priority !== undefined ? { priority: data.priority } : {}),
        ...(data.assigneeId !== undefined ? { assigneeId: data.assigneeId } : {}),
        ...(data.linkedMessageIds !== undefined ? { linkedMessageIds: data.linkedMessageIds } : {}),
        ...(data.resolution !== undefined ? { resolution: data.resolution } : {}),
        ...(data.status !== undefined
          ? {
              status: data.status,
              resolvedAt: data.status === 'resolved' ? now : undefined,
              closedAt: data.status === 'closed' ? now : undefined,
            }
          : {}),
      },
    })
    return toCase(row)
  }

  async deleteCase(id: string): Promise<void> {
    await db.case.delete({ where: { id } })
  }

  // ── Participants ───────────────────────────────────────────────────────────

  async addParticipant(caseId: string, input: AddParticipantInput): Promise<CaseParticipantItem> {
    const row = await db.caseParticipant.create({
      data: { caseId, customerId: input.customerId, role: input.role ?? 'primary' },
      include: { customer: true },
    })
    return toParticipant(row)
  }

  async findParticipant(caseId: string, customerId: string): Promise<CaseParticipantItem | null> {
    const row = await db.caseParticipant.findFirst({ where: { caseId, customerId } })
    return row ? toParticipant(row) : null
  }

  async findParticipantById(id: string): Promise<CaseParticipantItem | null> {
    const row = await db.caseParticipant.findUnique({ where: { id } })
    return row ? toParticipant({ ...row, customer: undefined }) : null
  }

  async removeParticipant(id: string): Promise<void> {
    await db.caseParticipant.delete({ where: { id } })
  }
}
