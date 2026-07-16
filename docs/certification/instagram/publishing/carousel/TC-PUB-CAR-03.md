# TC-PUB-CAR-03: Mixed image + video carousel

| Field | Value |
|---|---|
| Test ID | TC-PUB-CAR-03 |
| Date | |
| Commit SHA | |
| Media type | CAROUSEL_ALBUM (mixed children) |
| File specs | At least 1 JPEG + at least 1 MP4 in the same carousel |
| Tester | |

## Preconditions
- Connected non-tester account
- Test media: 1–2 images + 1–2 videos compatible with carousel spec

## Steps
1. Create a carousel post mixing images and videos
2. Publish now

## Expected
- Child containers created with correct type per media (IMAGE vs. VIDEO)
- Parent carousel combines both types
- Carousel published successfully
- Mixed media visible on Instagram

## Actual
<!-- Fill in -->

## Result
<!-- PASS / FAIL / PARTIAL -->

## Evidence

**Child container IDs (with type per item):**

**Parent container ID:**

**Provider media ID:**

**Instagram carousel shows mixed media (screenshot):**

## Notes
Instagram allows mixed image/video carousels. Each video child in a carousel
goes through the asynchronous container processing step before the parent
carousel can be published — verify Nashrino waits for all children to finish
processing before publishing the parent.

## Related issue
[#349](https://github.com/reza96ah-ship-it/publish/issues/349)
