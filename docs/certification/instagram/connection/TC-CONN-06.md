# TC-CONN-06: Revoked app access

| Field | Value |
|---|---|
| Test ID | TC-CONN-06 |
| Date | |
| Commit SHA | |
| Environment | |
| Account type | Business or Creator (connected, then revoked externally) |
| Tester | |

## Preconditions
- A connected Instagram platform row exists (TC-CONN-01 complete)
- The Instagram account can be logged into at instagram.com / Meta settings

## Steps
1. Go to Instagram → Settings → Apps and Websites (or Meta → Business Settings → Apps)
2. Find Nashrino and remove its access
3. Wait for the revocation to propagate (usually immediate)
4. In Nashrino, trigger `POST /api/platforms/[id]/validate` (or visit /channels and trigger a health check)
5. Observe Nashrino's response

## Expected
- `validateCredential` returns `status: 'expired'` (401 from `/me`)
- `Platform.status` is updated to `'expired'`
- Scheduled posts do not silently disappear or fail with no user-visible error
- A clear "Reconnect" CTA is shown in the UI
- Webhook delivery stops (Meta stops sending events when access is revoked)

## Actual
<!-- Fill in after running the test -->

## Result
<!-- PASS / FAIL / PARTIAL -->

## Evidence

**`POST /api/platforms/[id]/validate` response after revocation:**

**UI screenshot (revoked state):**

**Scheduled content still intact (screenshot):**

## Related issue
[#347](https://github.com/reza96ah-ship-it/publish/issues/347)
