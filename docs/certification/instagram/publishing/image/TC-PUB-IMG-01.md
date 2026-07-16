# TC-PUB-IMG-01: Standard JPEG image — 1:1 with caption and hashtags

| Field | Value |
|---|---|
| Test ID | TC-PUB-IMG-01 |
| Date | |
| Commit SHA | |
| Media type | IMAGE |
| File specs | JPEG, 1:1 (e.g. 1080×1080px), < 8 MB |
| Tester | |

## Preconditions
- Connected non-tester Business/Creator account (TC-CONN-01 complete)
- Test image prepared: standard JPEG, square aspect ratio, reasonable file size

## Steps
1. Create a new post in Nashrino with the test image
2. Add a caption (Persian text + hashtags, ≤ 2200 characters)
3. Select the connected Instagram account
4. Click "Publish Now"
5. Observe state transitions in the UI and database

## Expected state sequence
`DRAFT → QUEUED → PUBLISHING → PROVIDER_ACKNOWLEDGED → PUBLISHED`

## Expected final state
- `Publication.status` = `PUBLISHED`
- `Publication.externalId` = Instagram media ID (numeric string)
- `Publication.permalink` = `https://www.instagram.com/p/...`
- Post is visible on the Instagram profile
- Analytics collector can link the media ID to this publication

## Actual state sequence
<!-- Fill in -->

## Result
<!-- PASS / FAIL / PARTIAL -->

## Evidence

**Provider media ID:**

**Provider permalink:**

**Container ID (if async 2-step):**

**Provider request ID / trace:**

**State sequence log (from database):**

**UI screenshot at PUBLISHED state:**

**Post visible on Instagram (screenshot):**

**Analytics linkage confirmed (yes/no):**

## Related issue
[#349](https://github.com/reza96ah-ship-it/publish/issues/349)
