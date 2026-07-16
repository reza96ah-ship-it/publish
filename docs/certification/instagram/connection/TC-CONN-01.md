# TC-CONN-01: Successful business account connection

| Field | Value |
|---|---|
| Test ID | TC-CONN-01 |
| Date | |
| Commit SHA | |
| Environment | |
| Account type | Business |
| Tester | |

## Preconditions
- A non-tester Instagram Business professional account is available
- The app is in Development mode (or Live mode with the account in testers list removed)
- `INSTAGRAM_CLIENT_ID` and `INSTAGRAM_CLIENT_SECRET` are set in the environment
- No existing platform row for this account exists in the test workspace

## Steps
1. Log in to Nashrino as a workspace admin
2. Navigate to Settings → Channels
3. Click "Connect Instagram"
4. Complete the Instagram OAuth flow using the Business account
5. Observe the redirect back to `/channels?oauth_success=1`
6. Open the database and inspect the `Platform` row

## Expected
- Anti-CSRF state parameter was validated (callback succeeded, not rejected)
- `Platform.status` = `'active'`
- `Platform.targetId` = Instagram user ID (numeric string)
- `Platform.tokenScopes` contains all 5 `instagram_business_*` scopes
- `Platform.tokenExpiresAt` is set (≈ 60 days from now)
- `Platform.username` matches the Instagram handle
- Webhook subscription created (`subscribed_apps` confirmed via Meta dashboard or API)
- `/api/channels/health` health check confirms `status: active`, no missing scopes
- UI shows the account as "متصل و پایدار"

## Actual
<!-- Fill in after running the test -->

## Result
<!-- PASS / FAIL / PARTIAL -->

## Evidence

**Provider account ID:**

**Granted scopes:**

**Token expiry:**

**Database record (screenshot):**

**UI screenshot:**

**`/api/channels/health` response (JSON):**

**Webhook confirmation (screenshot or `subscribed_apps` API response):**

**Known limitations:**

## Related issue
[#347](https://github.com/reza96ah-ship-it/publish/issues/347)
