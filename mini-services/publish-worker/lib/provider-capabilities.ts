/**
 * Provider Capability Registry — worker-side entry point.
 *
 * Issue #150: this used to be a hand-maintained copy of
 * src/lib/provider-capabilities.ts, kept "in sync" only by a unit test that
 * compared the two. That has been eliminated — the actual data now lives in
 * a single shared module (`shared/provider-capabilities.ts`, repo root) that
 * both the Next.js app and this worker mini-service import directly. This
 * file is just a re-export so existing `../lib/provider-capabilities`
 * imports in the adapters keep working unchanged.
 *
 * The worker's Docker image (see Dockerfile `worker` stage) explicitly
 * excludes `src/` (avoids pulling in Next.js/React) but DOES copy
 * `shared/` alongside `mini-services/publish-worker/` — the shared module
 * has zero framework dependencies, so it's safe and cheap to include.
 *
 * Used by the worker adapters (mini-services/publish-worker/adapters/*) to
 * validate content before calling the provider API.
 */

export * from '../../../shared/provider-capabilities'
