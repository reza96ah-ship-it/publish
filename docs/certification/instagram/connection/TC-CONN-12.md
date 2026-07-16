# TC-CONN-12: Audit log

| Field | Value |
|---|---|
| Test ID | TC-CONN-12 |
| Date | |
| Commit SHA | |
| Environment | |
| Account type | Any |
| Tester | |

## Preconditions
- Database access to read the `AuditLog` table
- A test workspace with a user

## Steps
1. Connect an Instagram account → note the timestamp
2. Disconnect the same account → note the timestamp
3. Reconnect the account → note the timestamp
4. Query `SELECT * FROM AuditLog WHERE workspaceId = '{workspace-a}' ORDER BY createdAt DESC`
5. Attempt to read Workspace A's audit log as a user of Workspace B

## Expected

### Completeness
- Connect: `action = 'platform.connected'`, includes `platformType`, `accountId`, `scopes`, `expiresAt`
- Disconnect: `action = 'platform.disconnected'`, includes `platformType`, `webhookUnsubscribed`
- Reconnect: second `action = 'platform.connected'` entry
- All entries have: `userId`, `workspaceId`, timestamp

### Isolation
- Workspace B user cannot retrieve Workspace A audit logs
- `AuditLog.workspaceId` is filtered on every query (enforced in auth guards)

### Tamper evidence
- Audit entries are insert-only; no update/delete paths for normal users

## Actual
<!-- Fill in after running the test -->

## Result
<!-- PASS / FAIL / PARTIAL -->

## Evidence

**`platform.connected` log entry (database screenshot):**

**`platform.disconnected` log entry (database screenshot):**

**Second `platform.connected` entry after reconnect:**

**Cross-workspace isolation test (HTTP response from Workspace B):**

## Related issue
[#347](https://github.com/reza96ah-ship-it/publish/issues/347)
