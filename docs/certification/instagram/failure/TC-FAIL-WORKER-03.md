# TC-FAIL-WORKER-03: Queue restart / Redis loss

| Field | Value |
|---|---|
| Test ID | TC-FAIL-WORKER-03 |
| Date | |
| Commit SHA | |
| Environment | Staging |

## Preconditions
- Multiple publications queued (3–5)
- Redis is running and controllable

## Steps
1. Queue 3–5 publications with staggered dispatch times
2. Flush Redis: `redis-cli FLUSHALL` (or stop and restart Redis without persistence)
3. Restart the BullMQ worker
4. Observe recovery behavior

## Expected
- Publications queued in BullMQ that were lost from Redis can be reconstructed
  from the PostgreSQL outbox (if implemented) or must be manually re-queued
- No publications are silently lost without surfacing as `ACTION_REQUIRED` or `FAILED`
- No uncontrolled retry loop that would cause duplicates if some jobs had already been dispatched

## Actual
<!-- Fill in -->

## Result
<!-- PASS / FAIL / PARTIAL -->

## Evidence

**Number of jobs queued before flush:**

**Number of jobs recovered / re-queued after restart:**

**Any jobs silently lost?:**

**Any duplicate external posts created?:**

**Worker recovery log:**

## Engineering notes
If Nashrino does not have a PostgreSQL outbox fallback, this test will likely
show data loss. Document the gap and the mitigation plan (e.g. Redis AOF
persistence, periodic outbox reconciliation job).

## Related issue
[#350](https://github.com/reza96ah-ship-it/publish/issues/350)
