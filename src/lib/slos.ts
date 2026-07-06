/**
 * Issue #155: SLO/SLI definitions and error budget policy.
 *
 * Defines the core user journey SLOs, their initial targets,
 * and the error budget for each.
 *
 * Reference: https://sre.google/sre-book/service-level-objectives/
 */

export interface SLO {
  name: string
  description: string
  /** Target fraction (0-1). e.g. 0.995 = 99.5% */
  target: number
  /** Window in days for error budget calculation */
  windowDays: number
  /** SLI metric name in Prometheus */
  sliMetric: string
  /** Error budget = (1 - target) * window */
  errorBudgetLabel: string
}

export const SLOS: SLO[] = [
  {
    name: 'api_acceptance_availability',
    description: 'Valid publish commands accepted successfully (201 response)',
    target: 0.999, // 99.9%
    windowDays: 28,
    sliMetric: 'nashrino_publish_jobs_accepted_total',
    errorBudgetLabel: 'api_acceptance_budget',
  },
  {
    name: 'publish_correctness',
    description: 'Provider-confirmed successful publications / valid attempted publications',
    target: 0.995, // 99.5% — initial target, raise after sustained evidence
    windowDays: 28,
    sliMetric: 'nashrino_publish_jobs_completed_total{outcome="success"}',
    errorBudgetLabel: 'publish_correctness_budget',
  },
  {
    name: 'schedule_punctuality',
    description: 'Time from scheduledAt to provider request — p95 under 60s',
    target: 0.95, // 95% within 60s
    windowDays: 28,
    sliMetric: 'nashrino_publish_duration_seconds',
    errorBudgetLabel: 'schedule_punctuality_budget',
  },
  {
    name: 'queue_durability',
    description: 'Accepted publications that reach a terminal or visible repair state',
    target: 1.0, // 100% — zero silently lost publications
    windowDays: 28,
    sliMetric: 'nashrino_publish_jobs_completed_total',
    errorBudgetLabel: 'queue_durability_budget',
  },
  {
    name: 'duplicate_rate',
    description: 'Confirmed duplicate external posts — target: zero',
    target: 1.0, // 100% non-duplicate (zero duplicates allowed)
    windowDays: 28,
    sliMetric: 'nashrino_duplicate_posts_total',
    errorBudgetLabel: 'duplicate_budget',
  },
  {
    name: 'unknown_outcome_rate',
    description: 'Publications remaining ambiguous beyond 1 hour policy threshold',
    target: 0.99, // <1% remain unknown after 1h
    windowDays: 28,
    sliMetric: 'nashrino_unknown_outcomes_total',
    errorBudgetLabel: 'unknown_outcome_budget',
  },
  {
    name: 'credential_readiness',
    description: 'Active channels with valid required permissions (not expired/revoked)',
    target: 0.95, // 95% of channels ready
    windowDays: 7,
    sliMetric: 'nashrino_credential_health',
    errorBudgetLabel: 'credential_budget',
  },
  {
    name: 'user_experience_lcp',
    description: 'LCP p75 under 2.5s (mobile + desktop)',
    target: 0.95, // 95% of page loads under 2.5s
    windowDays: 28,
    sliMetric: 'nashrino_web_vitals_seconds{metric="LCP",rating="good"}',
    errorBudgetLabel: 'lcp_budget',
  },
  {
    name: 'user_experience_inp',
    description: 'INP p75 under 200ms (mobile + desktop)',
    target: 0.95, // 95% of interactions under 200ms
    windowDays: 28,
    sliMetric: 'nashrino_web_vitals_seconds{metric="INP",rating="good"}',
    errorBudgetLabel: 'inp_budget',
  },
]

/**
 * Initial release targets (Issue #155).
 */
export const RELEASE_TARGETS = {
  zeroKnownDuplicates: true,
  zeroSilentlyLostPublications: true,
  terminalRepairTraceability: 1.0, // 100%
  scheduleDelayP95Seconds: 60,
  publicationSuccessRate: 0.995, // 99.5% initially
  unknownOutcomeResolutionHours: 24, // resolved or escalated within 24h
  tokenExpiryWarningDays: 7, // warn 7 days before expiry
} as const

/**
 * Compute error budget remaining for an SLO.
 * Returns the fraction (0-1) of error budget remaining.
 * 0 = budget exhausted, 1 = budget fully available.
 */
export function errorBudgetRemaining(slo: SLO, observedGoodRate: number): number {
  const errorBudget = 1 - slo.target
  const observedError = 1 - observedGoodRate
  if (errorBudget === 0) return observedError === 0 ? 1 : 0
  return Math.max(0, (errorBudget - observedError) / errorBudget)
}

/**
 * SLO burn rate — how fast we're consuming the error budget.
 * >1 = burning faster than allowed (alert threshold)
 * >2 = fast burn (page immediately)
 * >10 = critical burn
 */
export function burnRate(slo: SLO, observedGoodRate: number): number {
  const errorBudget = 1 - slo.target
  const observedError = 1 - observedGoodRate
  if (errorBudget === 0) return observedError > 0 ? Infinity : 0
  return observedError / errorBudget
}
