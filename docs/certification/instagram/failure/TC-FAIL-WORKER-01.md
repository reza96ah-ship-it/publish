# TC-FAIL-WORKER-01: Worker stops before provider call

| Field | Value |
|---|---|
| Test ID | TC-FAIL-WORKER-01 |
| Date | |
| Commit SHA | |
| Environment | Staging (never run failure injection in production) |

## Preconditions
- A publication is scheduled or submitted
- Worker process can be killed mid-execution (staging environment only)

## Steps
1. Submit a publication job
2. After the worker picks up the job but **before** it calls the Instagram provider,
   kill the worker process (`kill -9 <pid>` or stop the container)
3. Restart the worker

## Expected
- BullMQ stalled-job detection picks up the unacknowledged job
- Publication resumes from the correct pre-provider state
- No second external post created (worker was killed before any provider call)
- Final state: `PUBLISHED` (or `FAILED` with reason if provider later rejects)

## Actual
<!-- Fill in -->

## Result
<!-- PASS / FAIL / PARTIAL -->

## Evidence

**Job ID:**

**Publication status before kill:**

**Publication status after restart:**

**Stalled-job log excerpt:**

**Provider post count before test:**

**Provider post count after test (no new posts):**

**Instagram profile screenshot (no duplicate):**

## Notes
BullMQ's `stalledInterval` controls how quickly stalled jobs are requeued.
Verify this is configured appropriately in `mini-services/publish-worker/`.

## Related issue
[#350](https://github.com/reza96ah-ship-it/publish/issues/350)
