/**
 * Issue #221: IRR billing — public API.
 *
 * Re-exports the service singleton + repository class + types + errors so
 * route handlers can import from a single entry point:
 *   import { billingService, BillingError } from '@/modules/billing'
 */

export { BillingService, billingService } from './service'
export { BillingRepository } from './repository'
export type {
  AuthContext,
  PlanCode,
  PlanRow,
  InvoiceRow,
  SubscriptionRow,
  UsageRow,
  QuotaResource,
  SubscribeInput,
  SubscribeResult,
  VerifyResult,
} from './types'
export {
  BillingError,
  ValidationError,
  PlanNotFoundError,
  InvoiceNotFoundError,
  PaymentGatewayError,
  PaymentVerificationError,
  QuotaExceededError,
} from './errors'
