# TC-PUB-IMG-03: Wrong aspect ratio — rejected before provider call

| Field | Value |
|---|---|
| Test ID | TC-PUB-IMG-03 |
| Date | |
| Commit SHA | |
| Media type | IMAGE |
| File specs | JPEG or PNG with invalid aspect ratio (e.g. 1:3 portrait, wider than 1.91:1) |
| Tester | |

## Preconditions
- Connected account (tester account acceptable for negative tests)

## Steps
1. Prepare an image with an aspect ratio outside Instagram's accepted range
   (accepted: 4:5 to 1.91:1; anything outside this should be rejected)
2. Attempt to create a post and publish

## Expected
- Nashrino **rejects the image before making any provider API call**
- Error message explains the aspect ratio constraint in plain language
- No `PublicationJob` or `Publication` row is created for this attempt
- No container creation API call is made to Instagram

## Actual
<!-- Fill in -->

## Result
<!-- PASS / FAIL / PARTIAL -->

## Evidence

**Validation error message shown:**

**No provider request made (confirm via network tab or logs):**

**No orphan Publication row (database screenshot):**

## Notes
Aspect ratio validation should happen at the Nashrino validation layer (not Meta's error path)
to give a clear user-facing message in Persian before any request is made.

## Related issue
[#349](https://github.com/reza96ah-ship-it/publish/issues/349)
