# Branch Protection Rules — Issue #141
#
# These rules must be configured in GitHub → Settings → Branches → Branch protection rules.
# They cannot be set via files in the repo; this document records the required configuration.
#
# Rule name: main

## Require a pull request before merging
- [x] Require pull request reviews before merging
  - Required approving reviews: 1 (when more than one maintainer is available)
  - Dismiss stale pull request approvals when new commits are pushed
  - Require review from Code Owners
- [x] Require conversation resolution before merging

## Require status checks to pass before merging
- [x] Require branches to be up to date before merging
- Required status checks (all must pass):
  - `Lint + Typecheck + Test + Build` (quality job)
  - `Security Audit (Blocking)` (security job)
  - `Docker Build (all targets)` (docker job)
  - `E2E (Playwright)` (e2e job)

## Restrict pushes that create matching branches
- [x] Do not allow bypassing the above settings

## Restrict who can push to matching branches
- [x] Restrict pushes that create matching branches to admins, maintainers, or none

## Allow force pushes
- [x] Do not allow force pushes (permanently disabled)

## Allow deletions
- [x] Do not allow deletions (permanently disabled)
