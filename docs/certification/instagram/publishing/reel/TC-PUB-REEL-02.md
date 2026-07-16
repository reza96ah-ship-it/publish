# TC-PUB-REEL-02: Reel with cover image

| Field | Value |
|---|---|
| Test ID | TC-PUB-REEL-02 |
| Date | |
| Commit SHA | |
| Media type | REEL with `cover_url` |
| File specs | MP4 (Reel-compatible) + JPEG cover image |
| Tester | |

## Preconditions
- Connected non-tester account
- Test video + separate cover image (1:1 or 9:16 recommended)

## Steps
1. Create a Reel post
2. Upload a cover image via Nashrino's cover selection UI (if available)
3. Publish

## Expected
- Container creation includes `cover_url` parameter
- Reel is published with the custom cover on the Instagram grid

## Actual
<!-- Fill in -->

## Result
<!-- PASS / FAIL / PARTIAL -->

## Evidence

**Cover URL passed in container creation (from logs or network tab):**

**Instagram grid shows correct cover (screenshot):**

**Known limitation:** If Nashrino does not yet expose a cover image picker UI, note this gap.

## Related issue
[#349](https://github.com/reza96ah-ship-it/publish/issues/349)
