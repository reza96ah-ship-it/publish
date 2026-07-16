# TC-FAIL-DUP-01: Manual retry — exactly one external post

| Field | Value |
|---|---|
| Test ID | TC-FAIL-DUP-01 |
| Date | |
| Commit SHA | |
| Environment | Staging |

## Steps
1. Force a publication to `FAILED` state (e.g. via worker fault injection or manual DB update)
   — the first attempt must have actually called the provider and received an error
2. User clicks "Retry" in the Nashrino UI
3. Retry is dispatched and succeeds

## Expected
- Exactly one external post visible on Instagram (no duplicate)
- If the first attempt was partially received by Instagram (idempotency key scenario),
  the retry uses the same idempotency key and Instagram deduplicates it
- Final state: `PUBLISHED` with the same `externalId` as (or confirming lack of) first attempt

## Actual
<!-- Fill in -->

## Result
<!-- PASS / FAIL / PARTIAL -->

## Evidence

**Instagram post count before retry:**

**Instagram post count after retry:**

**Provider media ID from retry:**

**Was the same idempotency key used?:**

## Notes
Instagram's Content Publishing API does not natively support idempotency keys.
Nashrino must implement client-side duplicate detection:
before making a second publish call, check if a post with the given caption and
timestamp already exists on the profile (or use a shorter reconciliation window).

## Related issue
[#350](https://github.com/reza96ah-ship-it/publish/issues/350)
