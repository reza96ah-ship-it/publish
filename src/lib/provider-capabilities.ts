/**
 * Provider Capability Registry — app-side entry point.
 *
 * Issue #150: the capability/support-level/duplicate-guarantee data used to
 * be hand-duplicated between this file and
 * mini-services/publish-worker/lib/provider-capabilities.ts, kept "in sync"
 * only by a unit test. That has been eliminated — the actual data now lives
 * in a single shared module (`shared/provider-capabilities.ts`) that has no
 * Next.js/React/Prisma dependencies, so it's safe for the worker's lean
 * Docker image to import too. Both this file and the worker's copy simply
 * re-export it; there is nothing left to drift.
 *
 * Used by:
 *   - Composer UI (src/components/views/compose-view.tsx) — show/hide media
 *     upload, live character counters, submit validation.
 *   - Channel/platform UI surfaces — support level badges (Issue #150).
 *   - Worker adapters (mini-services/publish-worker/adapters/*) — validate
 *     content before calling the provider API (via the worker's re-export).
 */

export * from '../../shared/provider-capabilities'
