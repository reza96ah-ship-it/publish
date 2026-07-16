# TC-PUB-VID-03: Invalid codec — rejected at validation

| Field | Value |
|---|---|
| Test ID | TC-PUB-VID-03 |
| Date | |
| Commit SHA | |
| Media type | VIDEO |
| File specs | Video with unsupported codec (e.g. HEVC/H.265, VP9, AV1) |
| Tester | |

## Preconditions
- Test video encoded in an unsupported codec (Instagram only accepts H.264)

## Steps
1. Create a post with the invalid-codec video
2. Attempt to publish

## Expected
- Nashrino validates the codec before uploading (or Meta rejects during container creation)
- Clear error message in Persian explaining the codec requirement
- No successful container creation at Meta
- Final state: `FAILED` or `ACTION_REQUIRED` (not stuck in PUBLISHING)

## Actual
<!-- Fill in -->

## Result
<!-- PASS / FAIL / PARTIAL -->

## Evidence

**Error message shown:**

**Where validation occurred (Nashrino-side or Meta-side):**

**Publication state in database:**

## Notes
If Nashrino doesn't validate the codec locally, the container creation API call
will fail with a Meta error. Either path is acceptable as long as the error
is surfaced clearly and the job doesn't get stuck in PUBLISHING indefinitely.

## Related issue
[#349](https://github.com/reza96ah-ship-it/publish/issues/349)
