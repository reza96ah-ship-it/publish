# Instagram Connection Certification

12 test cases for issue [#347](https://github.com/reza96ah-ship-it/publish/issues/347).
Fill in each file after running the test and mark the Result as PASS / FAIL / PARTIAL.

| Test case | Description | Requires non-tester account | Status |
|---|---|:---:|:---:|
| [TC-CONN-01](TC-CONN-01.md) | Successful business account connection | ✓ | ⬜ |
| [TC-CONN-02](TC-CONN-02.md) | Successful creator account connection | ✓ | ⬜ |
| [TC-CONN-03](TC-CONN-03.md) | Permission denied (missing scope) | | ⬜ |
| [TC-CONN-04](TC-CONN-04.md) | Unsupported account type (personal) | | ⬜ |
| [TC-CONN-05](TC-CONN-05.md) | Expired token | | ⬜ |
| [TC-CONN-06](TC-CONN-06.md) | Revoked app access | | ⬜ |
| [TC-CONN-07](TC-CONN-07.md) | Missing webhook subscription after connection | ✓ | ⬜ |
| [TC-CONN-08](TC-CONN-08.md) | Workspace isolation | | ⬜ |
| [TC-CONN-09](TC-CONN-09.md) | CSRF / state parameter validation | | ⬜ |
| [TC-CONN-10](TC-CONN-10.md) | Disconnect | | ⬜ |
| [TC-CONN-11](TC-CONN-11.md) | Reconnect (expired → refreshed) | | ⬜ |
| [TC-CONN-12](TC-CONN-12.md) | Audit log | | ⬜ |

## Gate: "Connection: Proven"

Required before this gate can be marked green:
- TC-CONN-01 PASS (non-tester business account)
- TC-CONN-02 PASS (non-tester creator account)
- TC-CONN-03, 04, 08, 09 all PASS
- Zero cases with Result = "unknown"

Update the status column using: ✅ PASS · ❌ FAIL · ⚠️ PARTIAL · ⬜ Not run
