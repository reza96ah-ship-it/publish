# TC-PUB-IMG-02: PNG at max file size (8 MB)

| Field | Value |
|---|---|
| Test ID | TC-PUB-IMG-02 |
| Date | |
| Commit SHA | |
| Media type | IMAGE |
| File specs | PNG, any valid aspect ratio, ≈ 8 MB |
| Tester | |

## Preconditions
- Connected non-tester account
- Test image: PNG file as close to 8 MB as possible while still within Instagram's limit

## Steps
1. Create a new post with the large PNG
2. Publish to Instagram without scheduling

## Expected
- Upload does not time out or fail silently
- Provider accepts the file (Instagram max: 8 MB for images)
- State sequence: `QUEUED → PUBLISHING → PROVIDER_ACKNOWLEDGED → PUBLISHED`

## Actual state sequence
<!-- Fill in -->

## Result
<!-- PASS / FAIL / PARTIAL -->

## Evidence

**File size used:**

**Provider media ID:**

**Upload duration (approximate):**

**UI screenshot:**

**Known limitations:** If the file exceeds the platform limit, expect validation rejection before the API call (not a silent API failure).

## Related issue
[#349](https://github.com/reza96ah-ship-it/publish/issues/349)
