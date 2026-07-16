# TC-CONN-07: Missing webhook subscription after connection

| Field | Value |
|---|---|
| Test ID | TC-CONN-07 |
| Date | |
| Commit SHA | |
| Environment | |
| Account type | Business or Creator |
| Tester | |

## Preconditions
- A connected Instagram platform exists
- Access to the Meta App Dashboard to delete webhook subscriptions

## Steps
1. Verify that webhook subscription exists after initial connection (TC-CONN-01 evidence)
2. In the Meta App Dashboard → Webhooks, remove the per-account subscription for this IG user
   (or call `DELETE /{ig-user-id}/subscribed_apps?access_token={token}` manually)
3. Trigger a Nashrino reconnect or health check
4. Observe whether the webhook subscription is restored

## Expected
- On reconnect (`POST /api/platforms/[id]/validate` or a full re-OAuth), the `subscribeInstagramWebhooks` helper is called and restores the subscription
- If full re-OAuth is required, the OAuth callback calls `subscribeInstagramWebhooks` (in `src/modules/oauth/service.ts`)
- If Nashrino cannot restore the subscription (e.g. missing Advanced Access), the user is notified

## Actual
<!-- Fill in after running the test -->

## Result
<!-- PASS / FAIL / PARTIAL -->

## Evidence

**Webhook deletion proof (Meta Dashboard screenshot or API response):**

**Webhook restoration proof after reconnect (Meta Dashboard screenshot or API response):**

**`subscribed_apps` API call log (if available):**

## Notes
Webhook subscription re-registration is called in `subscribeInstagramWebhooks()`
in `src/modules/oauth/service.ts`. It fires in the OAuth callback, not in
the validate endpoint. A full re-OAuth is required to restore a deleted subscription
unless we add a dedicated "repair webhooks" action.

## Related issue
[#347](https://github.com/reza96ah-ship-it/publish/issues/347)
