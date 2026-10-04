# Zernio Inbox reply with an unknown outcome

An Instagram DM or comment reply can be accepted upstream even if Zernio returns a timeout or 500. **Do not automatically retry** such a send. Zernio's `Idempotency-Key` protects a lost successful response, but [its changelog](https://docs.zernio.com/changelog) explicitly says it cannot guarantee safety after an upstream-accepted failure.

The Inbox records one active `InboxReplyAttempt` per thread. A confirmed provider receipt and the local outbound message are committed together. A 4xx rejection is marked `rejected`; a timeout, 409, 5xx, or local receipt-write failure is `unknown`. While an attempt is pending or unknown, another send to that thread is blocked—even from another tab or team member.

## Recovery

1. Open the conversation in Instagram itself and check whether the exact response appeared. Do not infer non-delivery merely because the local Inbox lacks the message; sync can lag.
2. In Nashrino's existing Inbox, an admin selects the affected thread. The warning displays two explicit resolution choices. Choose **sent** only if the response is visible in Instagram; choose **not sent** only after verifying it is absent. The confirmation records an audit event and releases the thread for future replies. Editors cannot resolve ambiguous sends.
3. Refresh the Inbox to let Zernio sync any provider-side outbound message and delivery status. If the evidence remains ambiguous, leave the attempt unresolved and escalate; do not guess or change the database manually.

`accepted` in the UI means Zernio returned a receipt, not that the recipient received or read the reply. The message list may later show `sent`, `delivered`, `read`, or `failed` from Zernio's [message status fields](https://docs.zernio.com/messages/get-inbox-conversation-messages).
