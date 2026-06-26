# Implementation Roadmap — Nashrino

**Last updated:** 2025-06-26
**Source:** `docs/PRODUCTION_READINESS_MASTER_PLAN.md`
**Version baseline:** `docs/VERSION_BASELINE_2026.md` (stable pins)
**Architecture:** `docs/ARCHITECTURE_MODULAR_MONOLITH.md` (modular monolith, 11 domain modules)

## 10-Phase Roadmap to 9/10 Production Readiness

| Phase | Focus | Effort | Status | Acceptance |
|---|---|---|---|---|
| **1** | P0 Safety Blockers | 1 week | ⬜ Pending | [§6.1](../docs/PRODUCTION_READINESS_MASTER_PLAN.md#phase-1--p0-safety-blockers-week-1) |
| **2** | Observability + Health | 3 days | ⬜ Pending | [§6.2](../docs/PRODUCTION_READINESS_MASTER_PLAN.md#phase-2--observability--health-week-2) |
| **3** | Docker + CI/CD | 4 days | ⬜ Pending | [§6.3](../docs/PRODUCTION_READINESS_MASTER_PLAN.md#phase-3--docker--cicd-week-3) |
| **4** | PostgreSQL Migration | 4 days | ⬜ Pending | [§6.4](../docs/PRODUCTION_READINESS_MASTER_PLAN.md#phase-4--postgresql-migration-week-4) |
| **5** | Token Encryption + RBAC + AI Safety | 3 days | ⬜ Pending | [§6.5](../docs/PRODUCTION_READINESS_MASTER_PLAN.md#phase-5--token-encryption--rbac--ai-safety-week-5) |
| **6** | Worker Hardening | 4 days | ⬜ Pending | [§6.6](../docs/PRODUCTION_READINESS_MASTER_PLAN.md#phase-6--worker-hardening-week-6) |
| **7** | Realtime Auth + Redis Adapter | 3 days | ⬜ Pending | [§6.7](../docs/PRODUCTION_READINESS_MASTER_PLAN.md#phase-7--realtime-auth--redis-adapter-week-7) |
| **8** | API Quality: Pagination + Rate Limiting | 4 days | ⬜ Pending | [§6.8](../docs/PRODUCTION_READINESS_MASTER_PLAN.md#phase-8--api-quality-pagination--rate-limiting--zod-week-8) |
| **9** | Media: S3 + Validation + Quotas | 4 days | ⬜ Pending | [§6.9](../docs/PRODUCTION_READINESS_MASTER_PLAN.md#phase-9--media-s3--validation--quotas-week-9) |
| **10** | Testing + Performance Budgets | 5 days | ⬜ Pending | [§6.10](../docs/PRODUCTION_READINESS_MASTER_PLAN.md#phase-10--testing--performance-budgets-week-10) |
| **Total** | | **~10 weeks** | | |

## Status legend

- ⬜ Pending — not started
- 🔄 In progress — actively being worked on
- ✅ Done — acceptance criteria met, merged to main
- ⏸ Blocked — waiting on dependency

## Dependency graph

```
Phase 1 (P0) ──┬──→ Phase 2 (Observability) ──→ Phase 10 (Testing)
               ├──→ Phase 3 (Docker/CI) ──→ Phase 4 (Postgres)
               │                          └──→ Phase 5 (Security)
               └──→ Phase 5 (Security) ──→ Phase 6 (Worker)
                                        └──→ Phase 7 (Realtime)
                                        └──→ Phase 8 (API Quality)
                                                └──→ Phase 9 (Media)
```

- Phase 1 unblocks everything.
- Phase 2, 3, 5 can run in parallel after Phase 1.
- Phase 4 depends on Phase 3 (Docker).
- Phase 6, 7, 8 depend on Phase 5 (RBAC).
- Phase 9 depends on Phase 8 (API quality).
- Phase 10 depends on all prior phases.

## How to update this file

1. Before starting a phase: change status to 🔄 In progress.
2. On merge to main: change status to ✅ Done, add date.
3. On blocker: change status to ⏸ Blocked, add note.
4. After each phase: update `docs/CURRENT_STATUS.md` scorecard.
5. After architecture decisions: append to `docs/DECISION_LOG.md`.
