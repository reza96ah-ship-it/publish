# TC-FAIL-PROVIDER-05: Token revoked at dispatch → RECONNECT_REQUIRED

| Field | Value |
|---|---|
| Test ID | TC-FAIL-PROVIDER-05 |
| Date | |
| Commit SHA | |
| Environment | Staging |

## Steps
1. Schedule a publication for 5 minutes in the future
2. Before dispatch: revoke the connected Instagram account's access
   (Settings → Apps and Websites → Remove Nashrino, or via API)
3. Let the worker attempt to dispatch at the scheduled time

## Expected
- Worker receives 401 from Instagram on the publish call
- State: `RECONNECT_REQUIRED` (not `FAILED` — this is a fixable credential issue)
- Scheduled content is preserved (not deleted)
- UI shows: "لطفاً حساب اینستاگرام را مجدداً متصل کنید" with reconnect link
- After reconnect, the publication can be retried

## Actual
<!-- Fill in -->

## Result
<!-- PASS / FAIL / PARTIAL -->

## Evidence

**Worker error log (401 from provider):**

**State in database:**

**Scheduled content preserved (database screenshot):**

**UI screenshot (RECONNECT_REQUIRED state):**

**Post reconnect — publication retry successful:**

## Related issue
[#350](https://github.com/reza96ah-ship-it/publish/issues/350)
