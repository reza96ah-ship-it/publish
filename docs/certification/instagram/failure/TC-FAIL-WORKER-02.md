# TC-FAIL-WORKER-02: Worker stops after provider call, before local acknowledgement

| Field | Value |
|---|---|
| Test ID | TC-FAIL-WORKER-02 |
| Date | |
| Commit SHA | |
| Environment | Staging |

## Preconditions
- Ability to inject artificial delay between provider response and database update

## Steps
1. Submit a publication
2. Let the worker call the Instagram provider and receive a container/media ID
3. Inject a delay (or kill the worker) before the `Publication.externalId` is written to the database
4. Restart the worker
5. Worker retries the job

## Expected
- Worker checks for an existing provider ID before making a second provider call
- If the provider ID was already assigned (the publish call succeeded but the DB write failed):
  - Worker sets state to `PROVIDER_ACKNOWLEDGED` (or `PUBLISHED`) without re-publishing
  - No second external post created
- If the provider call outcome is genuinely unknown (e.g. network timeout with no response):
  - State becomes `OUTCOME_UNKNOWN`
  - No second publish call is made automatically
  - Manual reconciliation action is offered

## Actual
<!-- Fill in -->

## Result
<!-- PASS / FAIL / PARTIAL -->

## Evidence

**Job ID:**

**Provider media ID (was it written before kill?):**

**Publication state after restart:**

**Was a second provider call made? (check network/worker logs):**

**Instagram post count before/after (no duplicate):**

## Notes
This is the hardest failure mode to handle correctly. The key invariant is:
*never make a second publish call if the first call may have succeeded*.
Check `mini-services/publish-worker/lib/` for idempotency logic.

## Related issue
[#350](https://github.com/reza96ah-ship-it/publish/issues/350)
