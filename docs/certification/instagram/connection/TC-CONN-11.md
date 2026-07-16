# TC-CONN-11: Reconnect (expired → refreshed)

| Field | Value |
|---|---|
| Test ID | TC-CONN-11 |
| Date | |
| Commit SHA | |
| Environment | |
| Account type | Business or Creator |
| Tester | |

## Preconditions
- A previously connected Instagram platform with a simulated expiry (or a real 60-day-old token)
- Scheduled content and drafts exist on this platform

## Steps
1. Simulate token expiry: set `Platform.tokenExpiresAt` to a past date in the database
2. Verify health check shows `tokenExpired: true` (via `/api/channels/health`)
3. Click the "اتصال مجدد" (Reconnect) button or navigate to `/channels?reconnect={platformId}`
4. Complete the Instagram OAuth flow with the same account
5. Inspect the `Platform` row after reconnect

## Expected
- New `tokenSecret` stored correctly (fresh token, not the old one)
- `Platform.status` = `'active'`
- `Platform.tokenExpiresAt` updated to ≈ 60 days from now
- `Platform.tokenScopes` refreshed with current scope list
- Health check passes (`/api/channels/health` → `status: active`, `tokenExpired: false`)
- Previously scheduled drafts and content are untouched
- `platform.disconnected` audit log NOT written (reconnect ≠ disconnect)
- `platform.connected` audit log IS written for the new token

## Actual
<!-- Fill in after running the test -->

## Result
<!-- PASS / FAIL / PARTIAL -->

## Evidence

**Health check before reconnect (expired state):**

**Health check after reconnect (active state):**

**`Platform.tokenExpiresAt` after reconnect:**

**Drafts preserved (database screenshot):**

**Audit log entries (`platform.connected` only, no `platform.disconnected`):**

## Related issue
[#347](https://github.com/reza96ah-ship-it/publish/issues/347)
