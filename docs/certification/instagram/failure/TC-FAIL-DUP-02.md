# TC-FAIL-DUP-02: Concurrent workers — fencing prevents double dispatch

| Field | Value |
|---|---|
| Test ID | TC-FAIL-DUP-02 |
| Date | |
| Commit SHA | |
| Environment | Staging (requires multi-worker setup) |

## Steps
1. Run 2 or more publish worker instances simultaneously
2. Submit a single publication job
3. Observe which worker processes it and confirm the other worker does not also process it

## Expected
- Only one worker picks up and processes the job (BullMQ handles this via its locking mechanism)
- Only one external post created
- No race condition between workers

## Actual
<!-- Fill in -->

## Result
<!-- PASS / FAIL / PARTIAL -->

## Evidence

**Number of worker instances running:**

**Job lock acquired by which worker (from logs):**

**Only one external post created (confirm via Instagram or provider logs):**

**BullMQ lock TTL configuration:**

## Notes
BullMQ uses Redis-based distributed locking (`SETNX`/`GETSET`) to prevent
multiple workers from processing the same job. Verify that:
1. The lock TTL is longer than the expected job duration
2. The worker extends the lock periodically for long-running jobs
3. Lock extensions (`extendLock`) are in place for video container polling

## Related issue
[#350](https://github.com/reza96ah-ship-it/publish/issues/350)
