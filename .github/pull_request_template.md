## Description
Brief description of what this PR does and why.

## Linked Issue
Closes #

## Changes
- 

## Test Evidence
- [ ] Unit tests pass: `bun run test`
- [ ] Typecheck clean: `bun run typecheck`
- [ ] Lint clean: `bun run lint`
- [ ] E2E tests pass (if applicable)

## Review Checklist
- [ ] Tenant scope: all DB queries are workspace-scoped
- [ ] Authorization: correct permission checked on every mutation
- [ ] State truth: no false success/saved/connected/published states
- [ ] Idempotency: retries do not create duplicates
- [ ] Observability: metrics/logs/traces added or updated
- [ ] Migrations: tested forward + rollback (if applicable)
- [ ] Documentation: updated where behavior changes
- [ ] Accessibility: WCAG 2.2 AA for UI changes
- [ ] No secrets/credentials in code or logs

## Rollback Plan
How to safely roll back if this causes issues in production.
