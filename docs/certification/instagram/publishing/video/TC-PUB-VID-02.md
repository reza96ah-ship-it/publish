# TC-PUB-VID-02: Video at duration limit

| Field | Value |
|---|---|
| Test ID | TC-PUB-VID-02 |
| Date | |
| Commit SHA | |
| Media type | VIDEO |
| File specs | MP4, H.264, exactly at or near the maximum duration for feed video (60s) |
| Tester | |

## Preconditions
- Connected non-tester account
- Test video: ≈60 seconds (or as close to the limit as possible)

## Steps
1. Create a post with the near-limit video
2. Publish now
3. Observe whether Instagram accepts it and how long processing takes

## Expected
- Video is accepted (not rejected for duration)
- Container processing may take longer for a longer video
- Final state: PUBLISHED

## Actual
<!-- Fill in -->

## Result
<!-- PASS / FAIL / PARTIAL -->

## Evidence

**Actual video duration (seconds):**

**Container processing time:**

**Provider media ID:**

**Known limitations:** If Instagram rejects the video, record the exact error message and duration used.

## Related issue
[#349](https://github.com/reza96ah-ship-it/publish/issues/349)
