# TC-FAIL-PROVIDER-02: Provider 5xx → bounded retry → FAILED

| Field | Value |
|---|---|
| Test ID | TC-FAIL-PROVIDER-02 |
| Date | |
| Commit SHA | |
| Environment | Staging |

## Steps
1. Mock Instagram API to return 5xx for all publish attempts
2. Submit a publication
3. Observe retry behavior (count and backoff)
4. After max retries are exhausted, observe final state

## Expected
- Worker retries with exponential backoff (not immediate re-queue)
- Retry count is bounded (e.g. 3–5 retries)
- After max retries: state = `FAILED` with a human-readable reason
- No duplicate external posts (each retry should carry the same idempotency key)
- Worker logs each retry attempt with attempt number

## Actual
<!-- Fill in -->

## Result
<!-- PASS / FAIL / PARTIAL -->

## Evidence

**Number of retries observed:**

**Final state:**

**Error reason in database:**

**Retry log (worker stderr/stdout):**

**Time between retries (backoff intervals):**

**Confirmed no duplicate post on Instagram:**

## Related issue
[#350](https://github.com/reza96ah-ship-it/publish/issues/350)
