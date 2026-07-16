# TC-PUB-VID-04: Scheduled video publish

| Field | Value |
|---|---|
| Test ID | TC-PUB-VID-04 |
| Date | |
| Commit SHA | |
| Media type | VIDEO |
| File specs | MP4, H.264, standard feed video (15–60s) |
| Tester | |

## Preconditions
- Connected non-tester account
- BullMQ worker running

## Steps
1. Create a post with the test video
2. Schedule it 5 minutes in the future
3. Wait for dispatch and completion

## Expected state sequence
`DRAFT → SCHEDULED → QUEUED → PUBLISHING → PROVIDER_ACKNOWLEDGED → PUBLISHED`

## Expected timing
- Job dispatched within ± 60 seconds of scheduled time
- Container processing added to the overall wait (videos take longer than images)

## Actual
<!-- Fill in -->

## Dispatch timestamp vs. scheduled time:

## Result
<!-- PASS / FAIL / PARTIAL -->

## Evidence

**Scheduled time:**

**Actual dispatch time:**

**Container ID:**

**Provider media ID:**

**Provider permalink:**

## Related issue
[#349](https://github.com/reza96ah-ship-it/publish/issues/349)
