# TC-FAIL-PROVIDER-04: Expired media URL → ACTION_REQUIRED

| Field | Value |
|---|---|
| Test ID | TC-FAIL-PROVIDER-04 |
| Date | |
| Commit SHA | |
| Environment | Staging |

## Steps
1. Schedule a publication with a time-limited signed media URL
2. Wait until the signed URL expires (or manually expire it in the storage provider)
3. Let the worker attempt to process the publication

## Expected
- Worker or Instagram returns an error indicating the media URL is invalid/expired
- State: `ACTION_REQUIRED` (not `FAILED` — the user can fix this by re-uploading)
- UI shows a clear message: "رسانه منقضی شده — لطفاً مجدداً آپلود کنید"
- User can re-upload and retry without losing the draft

## Actual
<!-- Fill in -->

## Result
<!-- PASS / FAIL / PARTIAL -->

## Evidence

**Error from Instagram (signed URL expired):**

**State in database:**

**UI screenshot (ACTION_REQUIRED + re-upload option):**

## Engineering notes
Check that the worker distinguishes "expired media" errors from generic provider
failures. Instagram returns an error code for invalid media URLs — this should
map to `ACTION_REQUIRED` not `FAILED`.

## Related issue
[#350](https://github.com/reza96ah-ship-it/publish/issues/350)
