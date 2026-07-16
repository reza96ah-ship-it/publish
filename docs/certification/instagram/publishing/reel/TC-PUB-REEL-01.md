# TC-PUB-REEL-01: Valid Reel (3–90s, 9:16 aspect)

| Field | Value |
|---|---|
| Test ID | TC-PUB-REEL-01 |
| Date | |
| Commit SHA | |
| Media type | REEL (`media_product_type: REELS`) |
| File specs | MP4, H.264, 9:16 (1080×1920), 15–60s |
| Tester | |

## Preconditions
- Connected non-tester Business/Creator account
- Test video: vertical (9:16), valid duration, H.264, ≤ 1 GB

## Steps
1. Create a new post and select "Reel" as media type (or upload a 9:16 video)
2. Add caption
3. Publish now
4. Verify the published post appears as a Reel, not a standard video

## Expected state sequence
`DRAFT → QUEUED → PUBLISHING → PROVIDER_ACKNOWLEDGED → PUBLISHED`

## Expected
- `media_product_type: REELS` set in the container creation call
- Published post categorized as Reel in Instagram (not standard Video)
- Provider media ID received
- Final state: PUBLISHED

## Actual
<!-- Fill in -->

## Result
<!-- PASS / FAIL / PARTIAL -->

## Evidence

**Provider media ID:**

**`media_type` value in API response (should be `VIDEO`, `media_product_type` = `REELS`):**

**Post visible as Reel on Instagram profile (screenshot):**

**Provider permalink:**

## Notes
Instagram returns `media_type: VIDEO` for Reels — use `media_product_type: REELS` to identify.
Nashrino must use `media_product_type: REELS` in the container creation request.

## Related issue
[#349](https://github.com/reza96ah-ship-it/publish/issues/349)
