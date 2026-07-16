# TC-CONN-02: Successful creator account connection

| Field | Value |
|---|---|
| Test ID | TC-CONN-02 |
| Date | |
| Commit SHA | |
| Environment | |
| Account type | Creator |
| Tester | |

## Preconditions
- A non-tester Instagram Creator professional account is available
- Same environment setup as TC-CONN-01

## Steps
1. Same as TC-CONN-01, using a Creator-type account instead

## Expected
- Same connection flow succeeds
- `Platform.status` = `'active'`
- All 5 `instagram_business_*` scopes granted
- Creator-specific limitations noted (e.g. some API endpoints may return differently)
- UI shows account as "متصل و پایدار"

## Actual
<!-- Fill in after running the test -->

## Result
<!-- PASS / FAIL / PARTIAL -->

## Creator-specific observations
<!-- Note any API capability differences between Business and Creator account type -->

## Evidence

**Provider account ID:**

**Granted scopes:**

**UI screenshot:**

**`/api/channels/health` response (JSON):**

**Known limitations for Creator accounts:**

## Related issue
[#347](https://github.com/reza96ah-ship-it/publish/issues/347)
