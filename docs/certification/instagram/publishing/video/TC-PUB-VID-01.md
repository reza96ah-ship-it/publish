# TC-PUB-VID-01: Standard MP4 video — valid duration and size

| Field | Value |
|---|---|
| Test ID | TC-PUB-VID-01 |
| Date | |
| Commit SHA | |
| Media type | VIDEO |
| File specs | MP4 (H.264, AAC audio), 15–60s, < 100 MB |
| Tester | |

## Preconditions
- Connected non-tester account
- Test video: MP4, H.264, within Instagram's video spec (≥ 3s, ≤ 60s for feed, < 100 MB)

## Steps
1. Create a post with the test video
2. Add caption
3. Publish now

## Expected state sequence
`DRAFT → QUEUED → PUBLISHING → PROVIDER_ACKNOWLEDGED → PUBLISHED`

Note: Instagram video publishing is asynchronous — the container creation returns
a container ID, then polling checks processing status before the final publish call.

## Actual state sequence
<!-- Fill in -->

## Result
<!-- PASS / FAIL / PARTIAL -->

## Evidence

**Provider media ID:**

**Container ID (from container creation step):**

**Container processing time (from creation to FINISHED status):**

**Provider permalink:**

**UI screenshot:**

## Related issue
[#349](https://github.com/reza96ah-ship-it/publish/issues/349)
