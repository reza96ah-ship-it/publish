# TC-CONN-05: Expired token

| Field | Value |
|---|---|
| Test ID | TC-CONN-05 |
| Date | |
| Commit SHA | |
| Environment | |
| Account type | Business or Creator (connected, then simulated expiry) |
| Tester | |

## Preconditions
- A connected Instagram platform row exists (TC-CONN-01 complete)
- Database write access to modify `tokenExpiresAt`

## Steps
1. Using the database or a migration script, set `Platform.tokenExpiresAt` to a past date (e.g. `2020-01-01`)
2. Trigger the channel health check via `GET /api/channels/health`
3. Attempt to publish or schedule a post on the expired platform
4. Observe what Nashrino does at each step

## Expected
- `GET /api/channels/health` returns `tokenExpired: true` and `daysRemaining <= 0`
- Publishing/scheduling on the expired platform is blocked (no silent failure)
- `Platform.status` is updated to `'expired'`
- UI shows the "منقضی — نیاز به اتصال مجدد" state
- A reconnect CTA is shown with the reconnect URL
- Existing drafts and scheduled content that was created before expiry are **preserved**

## Actual
<!-- Fill in after running the test -->

## Result
<!-- PASS / FAIL / PARTIAL -->

## Evidence

**`/api/channels/health` response showing expiry:**

**UI screenshot (expired state + reconnect CTA):**

**Database: scheduled content still intact (screenshot):**

**Known behavior: token expiry is currently detected from stored `tokenExpiresAt`,
not by a live API call — a deferred live check would improve accuracy.**

## Related issue
[#347](https://github.com/reza96ah-ship-it/publish/issues/347)
