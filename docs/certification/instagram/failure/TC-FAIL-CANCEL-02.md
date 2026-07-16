# TC-FAIL-CANCEL-02: Cancel during processing (ambiguous)

| Field | Value |
|---|---|
| Test ID | TC-FAIL-CANCEL-02 |
| Date | |
| Commit SHA | |
| Environment | Staging |

## Steps
1. Submit a publication
2. While the worker is mid-provider-call (inject artificial delay), request cancellation
3. Observe the outcome

## Expected
- Nashrino does NOT claim cancellation if the provider outcome is unknown
- State: `OUTCOME_UNKNOWN` (if provider outcome is genuinely ambiguous)
  OR `PUBLISHED` (if provider already confirmed before cancel reached the worker)
  OR `CANCELLED_LOCALLY` only if it can be proven no provider call was in flight
- UI shows an honest message — no false "Cancelled" when the post may have published
- User is told to check Instagram manually

## Actual
<!-- Fill in -->

## Result
<!-- PASS / FAIL / PARTIAL -->

## Evidence

**State in database after cancel:**

**UI message shown (screenshot):**

**Actual Instagram outcome (did the post publish or not?):**

## Notes
This is one of the hardest concurrency cases. The safest approach:
if the cancel request arrives while a provider call is in-flight, wait for the
provider to respond and use the actual outcome (not the cancellation intent).

## Related issue
[#350](https://github.com/reza96ah-ship-it/publish/issues/350)
