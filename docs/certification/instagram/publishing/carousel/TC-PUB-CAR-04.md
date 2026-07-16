# TC-PUB-CAR-04: Carousel with ordered media (order preserved)

| Field | Value |
|---|---|
| Test ID | TC-PUB-CAR-04 |
| Date | |
| Commit SHA | |
| Media type | CAROUSEL_ALBUM (order verification) |
| File specs | 3–5 images with visually distinct content to identify order |
| Tester | |

## Preconditions
- Connected non-tester account
- Test images: visually different and numbered (e.g. "slide 1", "slide 2", "slide 3")

## Steps
1. Create a carousel post, add slides in order: 1, 2, 3
2. Publish
3. View the Instagram carousel: confirm slide order matches the order set in Nashrino

## Expected
- The `children` parameter in the parent carousel creation call lists container IDs in the same order the user arranged them
- Instagram displays the slides in the expected order
- Reordering in Nashrino (if UI supports it) is reflected in the published order

## Actual
<!-- Fill in -->

## Result
<!-- PASS / FAIL / PARTIAL -->

## Evidence

**Order of children in parent container creation call (container ID list):**

**Published slide order on Instagram (screenshot showing slide 1 first):**

**Reorder test (if applicable):**

## Related issue
[#349](https://github.com/reza96ah-ship-it/publish/issues/349)
