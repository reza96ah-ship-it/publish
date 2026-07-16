# TC-PUB-CAR-05: Missing child media — validation rejects

| Field | Value |
|---|---|
| Test ID | TC-PUB-CAR-05 |
| Date | |
| Commit SHA | |
| Media type | CAROUSEL_ALBUM (invalid — 0 or 1 child) |
| File specs | Carousel with fewer than 2 children (Instagram requires 2–10) |
| Tester | |

## Preconditions
- Connected account (tester account acceptable for negative tests)

## Steps
1. Attempt to create a carousel post with only 1 image (or 0 images)
2. Attempt to publish

## Expected
- Nashrino rejects the carousel **before making any provider API call**
- Error message explains that a carousel requires at least 2 items
- No child container creation calls made to Instagram
- No orphan Publication row created

## Actual
<!-- Fill in -->

## Result
<!-- PASS / FAIL / PARTIAL -->

## Evidence

**Error message shown:**

**Validation occurred before any network call (confirmed via network tab):**

**No orphan database records (screenshot):**

## Related issue
[#349](https://github.com/reza96ah-ship-it/publish/issues/349)
