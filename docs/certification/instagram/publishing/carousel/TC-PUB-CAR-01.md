# TC-PUB-CAR-01: 2-image carousel

| Field | Value |
|---|---|
| Test ID | TC-PUB-CAR-01 |
| Date | |
| Commit SHA | |
| Media type | CAROUSEL_ALBUM (2 children) |
| File specs | 2× JPEG, same aspect ratio |
| Tester | |

## Preconditions
- Connected non-tester account
- 2 test images with the same aspect ratio

## Steps
1. Create a carousel post with 2 images
2. Add caption
3. Publish now

## Expected state sequence
`DRAFT → QUEUED → PUBLISHING → PROVIDER_ACKNOWLEDGED → PUBLISHED`

## Expected
- Each child image gets its own container creation call
- A parent carousel container is created with the child container IDs
- The parent carousel is published to the feed
- Post appears as a swipeable carousel on Instagram
- Final `media_type` from Instagram: `CAROUSEL_ALBUM`

## Actual
<!-- Fill in -->

## Result
<!-- PASS / FAIL / PARTIAL -->

## Evidence

**Child container IDs (2):**

**Parent container ID:**

**Provider media ID (parent):**

**Provider permalink:**

**Post appears as carousel on Instagram (screenshot):**

## Related issue
[#349](https://github.com/reza96ah-ship-it/publish/issues/349)
