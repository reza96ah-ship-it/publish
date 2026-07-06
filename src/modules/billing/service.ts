/**
 * Issue #221: IRR billing — service.
 *
 * Business-logic layer. Validates inputs, calls the repository for data,
 * integrates with the Zarinpal payment gateway (sandbox by default — set
 * ZARINPAL_MERCHANT_ID + ZARINPAL_CALLBACK_URL in production), and surfaces
 * Persian errors via BillingError subclasses.
 */

import { BillingRepository } from './repository'
import {
  ValidationError,
  PlanNotFoundError,
  InvoiceNotFoundError,
  PaymentGatewayError,
  PaymentVerificationError,
} from './errors'
import type {
  AuthContext,
  PlanRow,
  InvoiceRow,
  SubscriptionRow,
  UsageRow,
  SubscribeInput,
  SubscribeResult,
  VerifyResult,
  QuotaResource,
} from './types'

const FREE_PLAN_CODE = 'free'
const MONTH_MS = 30 * 24 * 60 * 60 * 1000

/** Zarinpal sandbox endpoint — overridden by ZARINPAL_API env when in production. */
const ZARINPAL_API =
  process.env.ZARINPAL_API ?? 'https://sandbox.zarinpal.com/pg/rest/WebGate/Payment'
const ZARINPAL_GATEWAY =
  process.env.ZARINPAL_GATEWAY ?? 'https://sandbox.zarinpal.com/pg/StartPay'
const ZARINPAL_MERCHANT_ID = process.env.ZARINPAL_MERCHANT_ID ?? '00000000-0000-0000-0000-000000000000'
const ZARINPAL_CALLBACK_URL = process.env.ZARINPAL_CALLBACK_URL ?? '/api/billing/verify'

export class BillingService {
  constructor(private readonly repo: BillingRepository = new BillingRepository()) {}

  async listPlans(): Promise<PlanRow[]> {
    return this.repo.listPlans()
  }

  /**
   * Get the workspace's current subscription + the plan row + usage meters.
   * Falls back to the free plan when no subscription exists (so the UI can
   * always render usage bars).
   */
  async getCurrentPlan(
    auth: AuthContext
  ): Promise<{ subscription: SubscriptionRow | null; plan: PlanRow; usage: UsageRow }> {
    const sub = await this.repo.getCurrentSubscription(auth.workspaceId)
    let plan: PlanRow | null = null
    if (sub) {
      plan = await this.repo.getPlanById(sub.planId)
    }
    if (!plan) {
      plan = await this.repo.getPlanByCode(FREE_PLAN_CODE)
    }
    if (!plan) {
      // No plans seeded yet — surface an honest empty plan.
      plan = {
        id: '',
        code: FREE_PLAN_CODE,
        name: 'رایگان',
        priceIRR: '0',
        maxChannels: 2,
        maxSeats: 2,
        maxPostsPerMonth: 30,
        features: [],
        isActive: true,
      }
    }
    const usage = await this.repo.getUsage(auth.workspaceId, plan)
    return { subscription: sub, plan, usage }
  }

  async getInvoices(auth: AuthContext): Promise<InvoiceRow[]> {
    return this.repo.getInvoices(auth.workspaceId)
  }

  /**
   * Initiate a Zarinpal payment for the given plan. Creates a pending invoice,
   * calls Zarinpal's /PaymentRequest endpoint, and returns the redirect URL
   * + authority code.
   */
  async createSubscription(auth: AuthContext, input: SubscribeInput): Promise<SubscribeResult> {
    if (!input.planCode) throw new ValidationError('کد طرح الزامی است')
    const plan = await this.repo.getPlanByCode(input.planCode)
    if (!plan) throw new PlanNotFoundError()
    if (plan.code === FREE_PLAN_CODE) {
      throw new ValidationError('طرح رایگان نیازی به پرداخت ندارد')
    }
    if (plan.priceIRR === '0') {
      throw new ValidationError('این طرح رایگان است')
    }

    const amount = Number(plan.priceIRR)
    // Zarinpal expects the amount in Tomans (IRR / 10).
    const amountTomans = Math.round(amount / 10)

    const callback = `${ZARINPAL_CALLBACK_URL}?planCode=${plan.code}&workspaceId=${auth.workspaceId}`

    let authority = ''
    try {
      const res = await fetch(`${ZARINPAL_API}/Request.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          MerchantID: ZARINPAL_MERCHANT_ID,
          Amount: amountTomans,
          CallbackURL: callback,
          Description: `اشتراک ${plan.name} نشرینو`,
        }),
      })
      const data = (await res.json()) as { Status: number; Authority: string }
      if (data.Status !== 100 || !data.Authority) {
        throw new PaymentGatewayError('پاسخ نامعتبر از درگاه پرداخت')
      }
      authority = data.Authority
    } catch (err) {
      if (err instanceof PaymentGatewayError) throw err
      throw new PaymentGatewayError('ارتباط با درگاه پرداخت ناموفق بود')
    }

    const invoice = await this.repo.createPendingInvoice(
      auth.workspaceId,
      plan.id,
      BigInt(plan.priceIRR),
      authority
    )

    return {
      paymentUrl: `${ZARINPAL_GATEWAY}/${authority}`,
      authority,
      invoiceId: invoice.id,
    }
  }

  /**
   * Zarinpal callback handler. Verifies the payment with Zarinpal's
   * /Verification endpoint, marks the invoice paid, and upserts the workspace's
   * subscription. Returns the invoice + subscription on success.
   */
  async verifyPayment(
    authority: string,
    status: string
  ): Promise<VerifyResult> {
    if (status !== 'OK') {
      throw new PaymentVerificationError('پرداخت توسط کاربر لغو شد')
    }
    const invoice = await this.repo.findInvoiceByAuthority(authority)
    if (!invoice) throw new InvoiceNotFoundError()
    if (invoice.status === 'paid') {
      throw new ValidationError('این فاکتور قبلاً تأیید شده است')
    }

    const plan = await this.repo.getPlanById(invoice.planId)
    if (!plan) throw new PlanNotFoundError()

    const amountTomans = Math.round(Number(invoice.amountIRR) / 10)

    let refId = ''
    try {
      const res = await fetch(`${ZARINPAL_API}/Verification.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          MerchantID: ZARINPAL_MERCHANT_ID,
          Authority: authority,
          Amount: amountTomans,
        }),
      })
      const data = (await res.json()) as { Status: number; RefID: number }
      if (data.Status !== 100) {
        throw new PaymentVerificationError('تأیید پرداخت ناموفق بود')
      }
      refId = String(data.RefID)
    } catch (err) {
      if (err instanceof PaymentVerificationError) throw err
      throw new PaymentGatewayError('ارتباط با درگاه پرداخت ناموفق بود')
    }

    const periodEnd = new Date(Date.now() + MONTH_MS)
    const { invoice: paidInvoice, subscription } =
      await this.repo.markInvoicePaidAndUpsertSubscription(
        invoice.id,
        plan.id,
        invoice.workspaceId,
        refId,
        periodEnd
      )

    return { ok: true, invoice: paidInvoice, subscription }
  }

  /**
   * Check whether the workspace is within its quota for a given resource.
   * Returns true if allowed, false if the limit would be exceeded.
   * Unlimited plans (-1) always return true.
   */
  async checkQuota(
    auth: AuthContext,
    resource: QuotaResource
  ): Promise<boolean> {
    const { plan, usage } = await this.getCurrentPlan(auth)
    switch (resource) {
      case 'channels':
        return plan.maxChannels === -1 || usage.channelsUsed < plan.maxChannels
      case 'seats':
        return plan.maxSeats === -1 || usage.seatsUsed < plan.maxSeats
      case 'posts':
        return plan.maxPostsPerMonth === -1 || usage.postsThisMonth < plan.maxPostsPerMonth
      default:
        return false
    }
  }
}

export const billingService = new BillingService()
