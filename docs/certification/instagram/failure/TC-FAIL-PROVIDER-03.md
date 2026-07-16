# TC-FAIL-PROVIDER-03: Provider rate limit (429) + Retry-After

| Field | Value |
|---|---|
| Test ID | TC-FAIL-PROVIDER-03 |
| Date | |
| Commit SHA | |
| Environment | Staging |

## Steps
1. Mock Instagram API to return HTTP 429 with `Retry-After: 60` header
2. Submit a publication
3. Observe worker behavior

## Expected
- Worker reads the `Retry-After` header and delays retry accordingly
- Worker does NOT immediately retry (ignoring the header)
- Eventually the retry succeeds (mock returns 200 after the delay)
- Final state: `PUBLISHED`
- No duplicate posts

## Actual
<!-- Fill in -->

## Result
<!-- PASS / FAIL / PARTIAL -->

## Evidence

**`Retry-After` header value used in mock:**

**Actual retry delay observed:**

**Worker log showing rate limit handling:**

**Final state:**

## Related issue
[#350](https://github.com/reza96ah-ship-it/publish/issues/350)
