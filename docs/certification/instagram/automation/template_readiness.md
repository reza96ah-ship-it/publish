# Comment automation template readiness (issue #354)

This is code-level evidence, not live Instagram certification. The 50 controlled comments and non-tester account checks remain deferred.

| Planned template | Current state | Evidence still needed |
| --- | --- | --- |
| T1 — Send a link | Implemented in the existing comment-to-DM panel. Requires a real HTTPS URL; `{لینک}` is substituted before sending. | Controlled provider send and receipt. |
| T2 — Send a resource | Implemented as a DM with a user-hosted HTTPS download URL and editable description; the app does not upload/host the resource. | Controlled download-link delivery and receipt. |
| T3 — Notify team | Implemented as a keyword-matched comment rule in the existing Automations page. Tags the open Inbox thread, sets high priority, assigns an eligible default if unassigned, and privately notifies its admin/editor assignee. | Controlled comment ingestion and notification receipt with a real account. |
| T4 — Tag unanswered | Implemented on newly ingested open comment threads. The `unanswered` tag is removed after an outbound reply or resolution. | Controlled comment, reply, and tag-state check with a real account. |
| T5 — Reply-window reminder | Implemented as a worker scan of assigned, unanswered comment threads near the seven-day private-reply deadline. One private in-app reminder per thread links to the existing Inbox; answered threads are excluded. Inbox now offers a separately labeled, confirmed private DM action on eligible Zernio comment threads. | Controlled clock/window, recipient, and private-send receipt check with a real account. |

The worker runs only these three validated Inbox definitions; arbitrary definitions in the advanced editor remain draft-only. T1/T2 remain in the existing comment-to-DM panel. T3–T5 create idempotent `AutomationRun` records and operate on already-ingested Inbox comments, not provider sends. Do not mark the five-template acceptance item complete until all five pass the controlled live-account checks.

Safety checks: link placeholder without URL is rejected on create/edit; legacy matching rules without a URL are skipped with `missing_template_link` in run history; the read-only rules panel cannot toggle, edit or delete rules. T3–T5 additionally require a reply-capable recipient, respect the kill switch, pause, dry-run and hourly cap, and use unique event claims. Code-level tests do not replace provider/webhook validation.

The Inbox comment composer remains a **public** comment reply. Its separate private DM action sends only plain text, checks the original comment's seven-day window, and shares `CommentDmLog` claims with comment-to-DM automation. One attempted private reply per comment or commenter/post is enforced locally; an ambiguous provider outcome stays blocked until manually verified. The private action has not been exercised against a live non-tester account.
