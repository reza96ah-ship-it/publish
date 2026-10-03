# Initial Sync Specification — Nashrino

**Status:** Implemented in stages; Zernio first-data import is profile + up to 25 recent posts. Inbox and insights remain separate reads.
**Related issue:** #346
**Owner:** Reza / engineering

---

## Activation definition

A user is **activated** when all three are true:
1. A real professional Instagram account is connected
2. Real media or conversation data is visible in Nashrino
3. The user completes one meaningful action: schedules a post, replies to a conversation, or activates a tested automation

Account creation alone is not activation.

---

## Activation funnel

| Step | Event name | Measurement |
|---|---|---|
| 1 | `signup_started` | Session begins |
| 2 | `signup_completed` | Account created |
| 3 | `workspace_created` | Workspace exists |
| 4 | `instagram_connect_started` | OAuth initiated |
| 5 | `instagram_authorized` | OAuth callback complete |
| 6 | `instagram_health_verified` | Health check passes |
| 7 | `initial_sync_started` | Sync job begins |
| 8 | `first_real_data_viewed` | Media or conversation visible |
| 9 | `first_meaningful_action_completed` | Post scheduled / reply sent / automation enabled |
| 10 | `returned_day_7` | User returns within 7 days |

---

## Time-to-value targets

| Event | Target |
|---|---|
| Authorization → connection confirmed | p50 < 30 seconds |
| Authorization → first real profile/media visible | p50 < 2 minutes |
| Authorization → useful workspace | p90 < 5 minutes |
| Full background sync completes | No user-blocking wait |

---

## Sync sequence (required order)

The direct-Meta sequence below describes the legacy connection. The current
customer route is Zernio: the OAuth callback verifies the account against its
workspace-scoped Zernio profile, persists the Platform, queues a durable
`InstagramSyncRun`, and imports up to 25 recent posts. The run stores a Zernio
checkpoint after identity verification and after media import. A stopped run
can be resumed from Channels after five minutes, or immediately after a
recorded failure. Previously imported post IDs are skipped. The account's
profile is saved by the existing Channels synchronization.

Zernio's posts endpoint returns the 25 most recent live posts; it does not
offer a pagination cursor. Thus the Zernio first-data run is intentionally
bounded at 25 and must not be described as a complete historical import.
Insights are queried by the existing overview/dashboard endpoints. Inbox
history is fetched by the existing Inbox path and may arrive later because
Zernio replays messages asynchronously. Neither is counted as complete by
the first-data run. A completed run means only identity and recent posts
succeeded. This is not yet an end-to-end activation claim.

1. Validate token and account identity
2. Save account identity and capabilities
3. Subscribe account webhooks
4. Import profile
5. Import recent media (first 25–50 objects)
6. Import available post metrics for recent media
7. Backfill available conversations (within Meta's historical limits)
8. Mark limitations and partial failures
9. Surface one useful first action

---

## `InstagramSyncRun` data model

The schema below was an early design sketch. The implemented model is in
`prisma/schema.prisma` and is shared by direct-Meta and Zernio runs.

```prisma
model InstagramSyncRun {
  id                        String    @id @default(cuid())
  workspaceId               String
  platformAccountId         String
  status                    SyncStatus
  currentStep               String?
  startedAt                 DateTime  @default(now())
  completedAt               DateTime?
  checkpoint                Json?
  importedMediaCount        Int       @default(0)
  importedConversationCount Int       @default(0)
  warnings                  String[]
  errors                    String[]
  lastProviderCursor        String?
}

enum SyncStatus {
  PENDING
  RUNNING
  COMPLETED
  FAILED
  PARTIAL
}
```

---

## Imported content origin

Every imported item must carry an origin field distinguishing:
- `NASHRINO` — created in Nashrino and published to Instagram
- `INSTAGRAM_IMPORT` — already existed on Instagram, imported for reference

**Critical rule:** Imported content (`INSTAGRAM_IMPORT`) must never be dispatched as a new Nashrino publication. The origin field must be checked before any publish action.

---

## Required characteristics

| Characteristic | Requirement |
|---|---|
| Idempotent | Safe to run multiple times — never duplicates media or conversations |
| Cursor-based | Uses provider cursors for pagination, not offset |
| Resumable | Interrupted sync continues from checkpoint |
| Checkpointed | Checkpoint saved after each successful step |
| Partial-success aware | Media import and conversation import fail independently |
| Observable | `currentStep` and progress counts visible to user |
| No duplicate imports | Rerunning sync never creates duplicate records |
| Honest about limitations | Conversation backfill window and insights availability disclosed to user |

For Zernio specifically, the `lastProviderCursor` and cursor-based requirement
do not apply to the live 25-post endpoint. The single-page fetch is resumed
idempotently by re-fetching and skipping saved post IDs.

---

## First dashboard (post-connection)

After connection and initial sync, show only:
1. Account health indicator (connected / warning / reconnect)
2. Recent content (last 5–10 imported posts)
3. Unanswered conversations count
4. Publishing queue state
5. One recommended next action

Do not greet a new user with 14 equal navigation destinations.

---

## Meta limitations to disclose

- Conversation backfill: limited by Meta's historical availability (typically < 30 days, Requests folder inactive > 30 days may not return)
- Insights: unavailable for accounts under 100 followers; up to 90-day historical window
- Media: captions from imported posts may differ from current caption if edited on Instagram

---

## Implementation checklist

Current Zernio first-data scope (issue #346):

- [x] `InstagramSyncRun` model in Prisma schema + migration
- [x] Sync idempotency test for previously imported posts
- [x] Resume-after-interrupt test for stale/failed run claims
- [x] Progress visible in Channels during sync
- [ ] Partial success state shown honestly
- [x] Origin field set on imported media
- [x] Checkpoint persists in the database across server restart
- [ ] Time-to-first-data measured and within p50 target
- [ ] Validate Business and Creator accounts outside the test team before release
- [ ] Confirm Inbox replay completion and per-account analytics availability separately
