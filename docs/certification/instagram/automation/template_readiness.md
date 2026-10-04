# Comment automation template readiness (issue #354)

This is code-level evidence, not live Instagram certification. The 50 controlled comments and non-tester account checks remain deferred.

| Planned template | Current state | Evidence still needed |
| --- | --- | --- |
| T1 — Send a link | Implemented in the existing comment-to-DM panel. Requires a real HTTPS URL; `{لینک}` is substituted before sending. | Controlled provider send and receipt. |
| T2 — Send a resource | Implemented as a DM with a user-hosted HTTPS download URL and editable description; the app does not upload/host the resource. | Controlled download-link delivery and receipt. |
| T3 — Notify team | Not implemented as a comment-triggered action. | Thread mapping, assignment/notification execution and tests. |
| T4 — Tag unanswered | Not implemented as a comment-triggered action. | Comment-to-thread tagging execution and tests. |
| T5 — Reply-window reminder | Not implemented. | Time-window scheduler, recipient selection and tests. |

The generic automation editor currently stores definitions and run-history structures, but has no runner calling `AutomationsRepository.createRun`. Its action labels are not evidence that T3–T5 execute. The default comment-to-DM UI exposes only the two working templates; a custom DM rule is under Advanced. Do not mark the five-template acceptance item complete until T3–T5 work end-to-end.

Safety checks: link placeholder without URL is rejected on create/edit; legacy matching rules without a URL are skipped with `missing_template_link` in run history; the read-only rules panel cannot toggle, edit or delete rules. Unit and component tests cover these paths.
