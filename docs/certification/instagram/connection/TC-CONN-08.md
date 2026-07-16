# TC-CONN-08: Workspace isolation

| Field | Value |
|---|---|
| Test ID | TC-CONN-08 |
| Date | |
| Commit SHA | |
| Environment | |
| Account type | Any (two separate test workspaces) |
| Tester | |

## Preconditions
- Workspace A: a connected Instagram platform (account A)
- Workspace B: a separate workspace with a different user
- API access to both workspaces (two separate sessions or tokens)

## Test steps

### API-level isolation
1. Connect account A in Workspace A. Note the `platformId`.
2. Log in as a user of Workspace B.
3. Attempt `GET /api/platforms/sync-status?platformId={platformId-from-workspace-A}` as Workspace B user
4. Attempt `DELETE /api/platforms/{platformId-from-workspace-A}` as Workspace B user
5. Attempt `POST /api/platforms/{platformId-from-workspace-A}/validate` as Workspace B user

### Service-level isolation
6. Inspect `src/modules/channels/service.ts` — `findInWorkspace(platformId, workspaceId)` ensures the platform row is joined to the requester's workspace before any operation.

## Expected
- Step 3, 4, 5: all return HTTP 404 (not 403 — the platform should not be acknowledged to exist for Workspace B)
- No data from Workspace A's account leaks into Workspace B
- Service-level check: `findInWorkspace` filters by both `id` AND `workspaceId`

## Actual
<!-- Fill in after running the test -->

## Result
<!-- PASS / FAIL / PARTIAL -->

## Evidence

**Step 3 HTTP response (screenshot or curl output):**

**Step 4 HTTP response:**

**Step 5 HTTP response:**

**Code inspection — `findInWorkspace` in `src/modules/channels/repository.ts`:**
```
findInWorkspace(id, workspaceId) → WHERE id = ? AND workspaceId = ?
```
✓ Confirmed in code: workspace isolation enforced at the repository layer.

## Related issue
[#347](https://github.com/reza96ah-ship-it/publish/issues/347)
