# TC-CONN-04: Unsupported account type (personal account)

| Field | Value |
|---|---|
| Test ID | TC-CONN-04 |
| Date | |
| Commit SHA | |
| Environment | |
| Account type | Personal (Instagram) |
| Tester | |

## Preconditions
- A personal (non-professional) Instagram account is available for testing
- Nashrino app is in Development mode

## Steps
1. Navigate to Settings → Channels → Connect Instagram
2. Authorize using a **personal** Instagram account (not Business, not Creator)
3. Observe the OAuth callback and Nashrino's response

## Expected
- Nashrino rejects the connection clearly
- Error message explains the requirement in plain language (not technical jargon)
  - Good: "این حساب باید حساب حرفه‌ای اینستاگرام (Business یا Creator) باشد"
  - Bad: "instagram_business_basic scope error"
- No `Platform` row is left in `connected` or `active` state for this account
- The previously partial/disconnected `Platform` row is safe to reconnect from

## Actual
<!-- Fill in after running the test -->

## Result
<!-- PASS / FAIL / PARTIAL -->

## Evidence

**`Platform.status` after rejection:**

**Error message shown to user (screenshot):**

**Database state (no orphan active platform for personal account):**

## Notes
Personal Instagram accounts cannot obtain `instagram_business_basic` scope.
The OAuth consent screen may still succeed but the subsequent `/me` call or
scope check in `validateCredential` (in `oauth-adapters.ts`) should detect
the account is not a professional account.

## Related issue
[#347](https://github.com/reza96ah-ship-it/publish/issues/347)
