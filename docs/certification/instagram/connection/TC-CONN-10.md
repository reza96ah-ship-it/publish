# TC-CONN-10: Disconnect

| Field | Value |
|---|---|
| Test ID | TC-CONN-10 |
| Date | |
| Commit SHA | |
| Environment | |
| Account type | Business or Creator (connected) |
| Tester | |

## Preconditions
- A connected Instagram platform exists (TC-CONN-01 complete)
- At least one draft or scheduled post exists on this platform

## Steps
1. Note the `platformId` and confirm there are drafts/scheduled posts in the workspace
2. Call `DELETE /api/platforms/{platformId}` (or use the Disconnect button in the UI if implemented)
3. Inspect the `Platform` row in the database
4. Check Meta App Dashboard → Webhooks to confirm the subscription was removed
5. Verify drafts and scheduled content in the database
6. Attempt to reconnect the same account via the OAuth flow

## Expected
- `DELETE /api/platforms/{platformId}` returns `{ "ok": true, "webhookUnsubscribed": true }`
- `Platform.status` = `'disconnected'`
- `Platform.tokenSecret` = `null`
- `Platform.targetId` = `null`
- `Platform.tokenScopes` = `null`
- Webhook subscription deleted at Meta (confirmed via API or dashboard)
- Drafts and scheduled content in `Content` table are **untouched**
- Publications and PublicationAttempt history is **untouched**
- Reconnect via OAuth creates the same platform row with a fresh token

## Actual
<!-- Fill in after running the test -->

## Result
<!-- PASS / FAIL / PARTIAL -->

## Evidence

**`DELETE /api/platforms/{id}` response:**

**`Platform` row after disconnect (database screenshot):**

**Webhooks page in Meta Dashboard (subscription removed):**

**`Content` table still has drafts (database screenshot):**

**Reconnect success after disconnect:**

## Implementation reference
`disconnectPlatform()` in `src/modules/channels/service.ts`
`DELETE /api/platforms/[id]` → `src/app/api/platforms/[id]/route.ts`

## Related issue
[#347](https://github.com/reza96ah-ship-it/publish/issues/347)
