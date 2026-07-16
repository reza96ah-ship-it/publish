# TC-PUB-IMG-04: Scheduled image publish (dispatch within ± 60 seconds)

| Field | Value |
|---|---|
| Test ID | TC-PUB-IMG-04 |
| Date | |
| Commit SHA | |
| Media type | IMAGE |
| File specs | Standard JPEG, valid aspect ratio |
| Tester | |

## Preconditions
- Connected non-tester account
- BullMQ worker running
- Scheduled time: 5–10 minutes from now (enough to verify scheduling without long wait)

## Steps
1. Create a post and set a scheduled publish time 5 minutes in the future
2. Confirm post enters `SCHEDULED` state
3. Wait for the scheduled time
4. Verify dispatch happens within ± 60 seconds of the scheduled time
5. Wait for the job to complete; verify `PUBLISHED` state

## Expected state sequence
`DRAFT → SCHEDULED → QUEUED → PUBLISHING → PROVIDER_ACKNOWLEDGED → PUBLISHED`

## Expected timing
- Job dispatched: scheduled time ± 60 seconds
- If server is briefly unavailable: job persists in BullMQ (not lost)

## Actual
<!-- Fill in -->

## Dispatch timestamp
<!-- Actual time job was dispatched vs. scheduled time -->

## Result
<!-- PASS / FAIL / PARTIAL -->

## Evidence

**Scheduled time:**

**Actual dispatch time:**

**Drift (seconds):**

**Provider media ID:**

**BullMQ job ID:**

**UI screenshot showing SCHEDULED then PUBLISHED:**

## Related issue
[#349](https://github.com/reza96ah-ship-it/publish/issues/349)
