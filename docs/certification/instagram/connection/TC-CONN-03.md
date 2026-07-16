# TC-CONN-03: Permission denied (user unchecks a required scope)

| Field | Value |
|---|---|
| Test ID | TC-CONN-03 |
| Date | |
| Commit SHA | |
| Environment | |
| Account type | Business or Creator |
| Tester | |

## Preconditions
- A test Instagram professional account is available (tester account is fine for this negative test)
- Nashrino app is in Development mode

## Steps
1. Navigate to Settings → Channels → Connect Instagram
2. In the Meta permission consent screen, **manually uncheck** one or more required permissions (e.g. uncheck `instagram_business_manage_messages`)
3. Complete the OAuth flow
4. Observe the redirect and Nashrino's response

## Expected
- Nashrino does NOT set `Platform.status = 'active'`
- The missing scopes are detected (via `/api/channels/health` → `missingScopes`)
- UI does NOT show "Connected" badge with green indicator
- A clear error or warning message is shown, naming the missing permission
- A "Reconnect and grant [permission name]" CTA is shown

## Actual
<!-- Fill in after running the test -->

## Result
<!-- PASS / FAIL / PARTIAL -->

## Evidence

**Missing scopes detected:**

**`Platform.status` in database:**

**UI screenshot (error state):**

**`/api/channels/health` response showing `missingScopes`:**

## Notes
If the platform status is set to `'active'` despite missing scopes, that is a FAIL.
The `computeCredentialStatus` function in `src/lib/provider-auth/types.ts` should return
a non-active status when required scopes are missing.

## Related issue
[#347](https://github.com/reza96ah-ship-it/publish/issues/347)
