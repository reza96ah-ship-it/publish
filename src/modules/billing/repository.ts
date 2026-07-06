/**
 * Issue #221: IRR billing — repository.
 *
 * Data-access layer. db is imported ONLY here (architecture rule).
 * Exposes pure-data methods; the service adds validation + Persian error
 * mapping + Zarinpal gateway integration.
 *
 * Plans are global (not workspace-scoped) — seeded by prisma/seed.ts.
 * Invoices + Subscriptions are workspace-scoped (object-level tenant auth
 * enforced at the service layer).
 */

import { db } from '@/lib/db'
import type { PlanRow, InvoiceRow, SubscriptionRow, UsageRow } from './types'

function toPlanRow(p: {
  id: string
  code: string
  name: string
  priceIRR: bigint
  maxChannels: number
  maxSeats: number
  maxPostsPerMonth: number
  features: unknown
  isActive: boolean
}): PlanRow {
  return {
    id: p.id,
    code: p.code,
    name: p.name,
    priceIRR: p.priceIRR.toString(),
    maxChannels: p.maxChannels,
    maxSeats: p.maxSeats,
    maxPostsPerMonth: p.maxPostsPerMonth,
    features: Array.isArray(p.features) ? (p.features as string[]) : [],
    isActive: p.isActive,
  }
}

export class BillingRepository {
  async listPlans(): Promise<PlanRow[]> {
    const rows = await db.plan.findMany({
      where: { isActive: true },
      orderBy: { priceIRR: 'asc' },
    })
    return rows.map(toPlanRow)
  }

  async getPlanByCode(code: string): Promise<PlanRow | null> {
    const p = await db.plan.findUnique({ where: { code } })
    return p ? toPlanRow(p) : null
  }

  async getPlanById(id: string): Promise<PlanRow | null> {
    const p = await db.plan.findUnique({ where: { id } })
    return p ? toPlanRow(p) : null
  }

  async getCurrentSubscription(workspaceId: string): Promise<SubscriptionRow | null> {
    const sub = await db.subscription.findUnique({
      where: { workspaceId },
      include: { plan: true },
    })
    if (!sub) return null
    return {
      id: sub.id,
      workspaceId: sub.workspaceId,
      planId: sub.planId,
      planCode: sub.plan.code,
      planName: sub.plan.name,
      status: sub.status,
      currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
      createdAt: sub.createdAt.toISOString(),
    }
  }

  async getInvoices(workspaceId: string): Promise<InvoiceRow[]> {
    const rows = await db.invoice.findMany({
      where: { workspaceId },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    return rows.map((r) => ({
      id: r.id,
      workspaceId: r.workspaceId,
      planId: r.planId,
      planName: r.plan.name,
      amountIRR: r.amountIRR.toString(),
      status: r.status,
      paidAt: r.paidAt?.toISOString() ?? null,
      zarinpalAuthority: r.zarinpalAuthority,
      zarinpalRefId: r.zarinpalRefId,
      createdAt: r.createdAt.toISOString(),
    }))
  }

  async createPendingInvoice(
    workspaceId: string,
    planId: string,
    amountIRR: bigint,
    authority: string
  ): Promise<InvoiceRow> {
    const inv = await db.invoice.create({
      data: {
        workspaceId,
        planId,
        amountIRR,
        status: 'pending',
        zarinpalAuthority: authority,
      },
      include: { plan: true },
    })
    return {
      id: inv.id,
      workspaceId: inv.workspaceId,
      planId: inv.planId,
      planName: inv.plan.name,
      amountIRR: inv.amountIRR.toString(),
      status: inv.status,
      paidAt: inv.paidAt?.toISOString() ?? null,
      zarinpalAuthority: inv.zarinpalAuthority,
      zarinpalRefId: inv.zarinpalRefId,
      createdAt: inv.createdAt.toISOString(),
    }
  }

  async findInvoiceByAuthority(authority: string): Promise<InvoiceRow | null> {
    const inv = await db.invoice.findFirst({
      where: { zarinpalAuthority: authority },
      include: { plan: true },
    })
    if (!inv) return null
    return {
      id: inv.id,
      workspaceId: inv.workspaceId,
      planId: inv.planId,
      planName: inv.plan.name,
      amountIRR: inv.amountIRR.toString(),
      status: inv.status,
      paidAt: inv.paidAt?.toISOString() ?? null,
      zarinpalAuthority: inv.zarinpalAuthority,
      zarinpalRefId: inv.zarinpalRefId,
      createdAt: inv.createdAt.toISOString(),
    }
  }

  /** Mark invoice paid + upsert the workspace's subscription in one transaction. */
  async markInvoicePaidAndUpsertSubscription(
    invoiceId: string,
    planId: string,
    workspaceId: string,
    refId: string,
    periodEnd: Date | null
  ): Promise<{ invoice: InvoiceRow; subscription: SubscriptionRow }> {
    const result = await db.$transaction(async (tx) => {
      const inv = await tx.invoice.update({
        where: { id: invoiceId },
        data: { status: 'paid', paidAt: new Date(), zarinpalRefId: refId },
        include: { plan: true },
      })
      const sub = await tx.subscription.upsert({
        where: { workspaceId },
        create: {
          workspaceId,
          planId,
          status: 'active',
          currentPeriodEnd: periodEnd,
        },
        update: { planId, status: 'active', currentPeriodEnd: periodEnd },
        include: { plan: true },
      })
      await tx.workspace.update({
        where: { id: workspaceId },
        data: { planId },
      })
      return { inv, sub }
    })
    return {
      invoice: {
        id: result.inv.id,
        workspaceId: result.inv.workspaceId,
        planId: result.inv.planId,
        planName: result.inv.plan.name,
        amountIRR: result.inv.amountIRR.toString(),
        status: result.inv.status,
        paidAt: result.inv.paidAt?.toISOString() ?? null,
        zarinpalAuthority: result.inv.zarinpalAuthority,
        zarinpalRefId: result.inv.zarinpalRefId,
        createdAt: result.inv.createdAt.toISOString(),
      },
      subscription: {
        id: result.sub.id,
        workspaceId: result.sub.workspaceId,
        planId: result.sub.planId,
        planCode: result.sub.plan.code,
        planName: result.sub.plan.name,
        status: result.sub.status,
        currentPeriodEnd: result.sub.currentPeriodEnd?.toISOString() ?? null,
        createdAt: result.sub.createdAt.toISOString(),
      },
    }
  }

  /** Count usage for the workspace against the plan limits. */
  async getUsage(workspaceId: string, plan: PlanRow): Promise<UsageRow> {
    const [channels, seats, posts] = await Promise.all([
      db.platform.count({ where: { workspaceId } }),
      db.workspaceMember.count({ where: { workspaceId } }),
      db.content.count({
        where: {
          workspaceId,
          createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
        },
      }),
    ])
    return {
      channelsUsed: channels,
      channelsLimit: plan.maxChannels,
      seatsUsed: seats,
      seatsLimit: plan.maxSeats,
      postsThisMonth: posts,
      postsLimit: plan.maxPostsPerMonth,
    }
  }
}
