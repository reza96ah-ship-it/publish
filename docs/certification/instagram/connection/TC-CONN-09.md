# TC-CONN-09: CSRF / state parameter validation

| Field | Value |
|---|---|
| Test ID | TC-CONN-09 |
| Date | |
| Commit SHA | |
| Environment | |
| Account type | Any |
| Tester | |

## Preconditions
- Nashrino is running and Instagram OAuth is configured

## Steps

### Tampered state parameter
1. Start the OAuth flow: `GET /api/platforms/oauth/start?type=instagram`
2. Note the `authorizationUrl` — it contains `state=<hex-token>`
3. Before following the redirect, construct a fake callback URL:
   `GET /api/platforms/oauth/callback?code=validcode&state=TAMPERED_STATE`
4. Call the fake callback URL directly

### Missing state cookie
5. Start a new OAuth flow
6. Call the callback URL with the correct state but **without the `oauth_state_<state>` cookie** (e.g. from a different browser or after clearing cookies)

## Expected

### Tampered state
- `state=TAMPERED_STATE` → cookie name `oauth_state_TAMPERED_STATE` doesn't exist
- Nashrino returns a redirect to `/channels?oauth_error=invalid_or_expired_state`
- No `Platform` row is created or modified

### Missing cookie
- Cookie absent → `cookieValue = undefined`
- Nashrino returns `/channels?oauth_error=invalid_or_expired_state`
- No account record created

## Actual
<!-- Fill in after running the test -->

## Result
<!-- PASS / FAIL / PARTIAL -->

## Evidence

**Step 4 redirect response (tampered state):**

**Step 6 redirect response (missing cookie):**

**Database: no orphan platform rows created:**

## Code reference
CSRF protection is implemented in `src/app/api/platforms/oauth/callback/route.ts` and
`src/modules/oauth/service.ts`. The state cookie name is `oauth_state_${state}` —
without a matching cookie the callback returns `invalid_or_expired_state`.

## Related issue
[#347](https://github.com/reza96ah-ship-it/publish/issues/347)
