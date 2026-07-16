# TC-FAIL-PROVIDER-01: Provider timeout → OUTCOME_UNKNOWN

| Field | Value |
|---|---|
| Test ID | TC-FAIL-PROVIDER-01 |
| Date | |
| Commit SHA | |
| Environment | Staging |

## Steps
1. Mock/block the Instagram API call to simulate a timeout (no response within the request timeout)
2. Submit a publication that will hit this timeout
3. Observe the final state

## Expected
- State: `OUTCOME_UNKNOWN` (not `FAILED`, not `PUBLISHED`)
- Worker does not retry automatically (would risk a duplicate)
- UI shows an honest "outcome unknown" message with a reconciliation action
- The reconciliation action allows the user to check Instagram manually and report outcome

## Actual
<!-- Fill in -->

## Result
<!-- PASS / FAIL / PARTIAL -->

## Evidence

**Publication state in database:**

**Error logged by worker:**

**UI showing OUTCOME_UNKNOWN state (screenshot):**

**Reconciliation action available (screenshot):**

## Notes
A timeout is different from a 5xx error because the provider may have
received the request and started processing it (leading to a duplicate if retried).
`OUTCOME_UNKNOWN` must be used when the outcome cannot be determined safely.

## Related issue
[#350](https://github.com/reza96ah-ship-it/publish/issues/350)
