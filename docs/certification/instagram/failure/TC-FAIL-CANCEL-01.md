# TC-FAIL-CANCEL-01: Cancel before dispatch (clean)

| Field | Value |
|---|---|
| Test ID | TC-FAIL-CANCEL-01 |
| Date | |
| Commit SHA | |
| Environment | Staging or Production |

## Steps
1. Schedule a publication for 10+ minutes in the future
2. Before the job is dispatched to BullMQ, click Cancel in the UI
3. Observe state

## Expected
- Publication state: `CANCELLED_LOCALLY`
- No provider API call was made
- Job is removed from BullMQ (or marked as cancelled so the worker skips it)
- Audit log records the cancellation

## Actual
<!-- Fill in -->

## Result
<!-- PASS / FAIL / PARTIAL -->

## Evidence

**State in database:**

**BullMQ job status (removed or cancelled):**

**No provider network request (confirmed via worker logs):**

**UI screenshot (cancelled state):**

## Related issue
[#350](https://github.com/reza96ah-ship-it/publish/issues/350)
