# TC-PUB-REEL-03: Reel — share to feed true vs false

| Field | Value |
|---|---|
| Test ID | TC-PUB-REEL-03 |
| Date | |
| Commit SHA | |
| Media type | REEL |
| File specs | MP4, Reel-compatible |
| Tester | |

## Preconditions
- Connected non-tester account

## Steps
### Run A — share to feed: true
1. Create a Reel post with "share to feed" enabled
2. Publish
3. Check that the Reel appears on both the Reels tab AND the grid/feed

### Run B — share to feed: false
1. Create a Reel post with "share to feed" disabled
2. Publish
3. Check that the Reel appears in the Reels tab but NOT on the grid/feed

## Expected
- Run A: `share_to_feed: true` in container creation; Reel appears in grid
- Run B: `share_to_feed: false` in container creation; Reel does NOT appear in grid

## Actual
<!-- Fill in for both runs -->

## Result A (share to feed on)
<!-- PASS / FAIL / PARTIAL -->

## Result B (share to feed off)
<!-- PASS / FAIL / PARTIAL -->

## Evidence

**Run A — container creation param (`share_to_feed: true`):**

**Run A — post visible in grid (screenshot):**

**Run B — container creation param (`share_to_feed: false`):**

**Run B — post NOT in grid (screenshot of grid showing no new post):**

**Known limitation:** If Nashrino does not expose a "share to feed" toggle, note this gap.

## Related issue
[#349](https://github.com/reza96ah-ship-it/publish/issues/349)
