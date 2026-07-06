/**
 * Issue #221: IRR billing — types.
 *
 * Pure domain types shared between route handler, service, and repository.
 * No imports from Prisma or Next.js here.
 *
 * Plans are seeded by prisma/seed.ts:
 *   free     — 0 IRR,         2 channels,  2 seats,  30 posts/month
 *   pro      — 290,000 IRR,  10 channels,  5 seats,  500 posts/month
 *   agency   — 890,000 IRR,  50 channels, 20 seats, unlimited (-1)
 */

export interface AuthContext {
  workspaceId: string
  userId: string
}

export type PlanCode = 'free' | 'pro' | 'agency' | 'enterprise'

export interface PlanRow {
  id: string
  code: string
  name: string
  priceIRR: string // BigInt serialized as string (JSON-safe)
  maxChannels: number
  maxSeats: number
  maxPostsPerMonth: number // -1 = unlimited
  features: string[]
  isActive: boolean
}

export interface InvoiceRow {
  id: string
  workspaceId: string
  planId: string
  planName: string
  amountIRR: string
  status: string
  paidAt: string | null
  zarinpalAuthority: string | null
  zarinpalRefId: string | null
  createdAt: string
}

export interface SubscriptionRow {
  id: string
  workspaceId: string
  planId: string
  planCode: string
  planName: string
  status: string
  currentPeriodEnd: string | null
  createdAt: string
}

export interface UsageRow {
  channelsUsed: number
  channelsLimit: number
  seatsUsed: number
  seatsLimit: number
  postsThisMonth: number
  postsLimit: number // -1 = unlimited
}

export type QuotaResource = 'channels' | 'seats' | 'posts'

export interface SubscribeInput {
  planCode: PlanCode
}

export interface SubscribeResult {
  /** Zarinpal redirect URL — the client should `window.location = url`. */
  paymentUrl: string
  /** Authority code Zarinpal issued for this transaction. */
  authority: string
  /** The created invoice id (status=pending). */
  invoiceId: string
}

export interface VerifyResult {
  ok: boolean
  invoice: InvoiceRow
  subscription: SubscriptionRow
}
