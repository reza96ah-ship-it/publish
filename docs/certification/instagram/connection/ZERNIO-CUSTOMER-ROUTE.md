# Zernio customer onboarding and connection test plan

Status: **NOT RUN on non-tester accounts**. Do not substitute the existing test Instagram account for the Business or Creator checks.

## Setup and boundaries

- Deploy the candidate commit to HTTPS only after normal backup/rollback checks. Set `PLATFORM_OWNER_EMAIL` to the operator's existing app email. The owner can enroll in MFA on `/settings/customer-invites`, save the one-time backup codes, and use the optional TOTP field on the sign-in page for later logins. The environment value may be omitted to disable new-customer invitations.
- The operator opens `/settings/customer-invites` and issues one invitation per customer. Each invitation creates a separate empty workspace and expires after seven days. Send its one-time link privately to the matching email. Do not put links in screenshots, tickets, analytics, or logs.
- The customer opens the link, enters their invited email/name, chooses a new app password, then signs in. This **does not** ask for an Instagram password. A recipient already registered in the app needs a separate existing-user workflow; this new-account route rejects that email.
- The customer opens `/channels`, selects Zernio Instagram connect, and gives consent on the provider/Instagram page. [Zernio says Instagram requires a Business or Creator professional account](https://docs.zernio.com/platforms/instagram); personal accounts are unsupported.
- Record only redacted evidence: app workspace ID, Zernio profile/account ID, Instagram username, consent result, UI screenshot of profile info, timestamps, and account type evidence from the owner's Instagram settings. The documented Zernio list-accounts response does not establish Business versus Creator type, so do not infer it from our `accountKind='professional'` field.
- Never collect Instagram usernames/passwords as login credentials, raw access tokens, Zernio API keys, or invitation tokens in this document.

## Cases

| ID | Action | Pass condition | Result / evidence |
|---|---|---|---|
| ZC-01 | Unauthenticated and non-owner user POST `/api/auth/customer-invites` | 403; no workspace or invite created | NOT RUN |
| ZC-02 | Operator without MFA attempts issue | 403; no workspace or invite created | NOT RUN |
| ZC-03 | MFA-enabled owner issues invite to new email | One new empty workspace, admin invitation, hashed token only, seven-day expiry; link shown once | NOT RUN |
| ZC-04 | Recipient creates app account with the invite | Admin membership in exactly their new workspace; signup link removed from browser URL; no access to operator workspace | NOT RUN |
| ZC-05 | Reuse, expire, revoke, wrong email, or tamper with invite | No second account or membership; generic failure | NOT RUN |
| ZC-06 | Distinct non-tester Business owner completes Zernio consent | `zernio_success=1`; one active platform in own workspace; exact username/profile information visible in `/channels`; profile ID belongs only to this workspace | NOT RUN |
| ZC-07 | Distinct non-tester Creator owner completes Zernio consent | Same as ZC-06 with a different workspace/profile/account; Creator type independently evidenced | NOT RUN |
| ZC-08 | Personal account attempts connection | Provider rejects or app leaves no active professional platform; capture provider behavior | NOT RUN |
| ZC-09 | Tamper callback `flow`, omit cookie, change `profileId`/`accountId`, or replay after cookie cleared | Callback rejected; no foreign platform imported | NOT RUN |
| ZC-10 | Business user attempts to read Creator's channel/inbox/sync records and vice versa | 401/403/404 without revealing cross-workspace account data; no records changed | NOT RUN |
| ZC-11 | Disconnect/reconnect and repeat connect | No duplicate active platform; account remains bound to correct Zernio profile; audit events present | NOT RUN |
| ZC-12 | Send a fresh external DM/comment to each eligible account; check sync/webhook | Events appear only in owner's workspace with provider-supported fields; record missing permissions/data honestly | NOT RUN |

For ZC-06 and ZC-07, record: date, deployed commit, tester (without credentials), Instagram account type evidence, workspace ID, Zernio profile ID, provider account ID, UI screenshot, result, and any provider errors. For ZC-09, use the Zernio callback (`/api/platforms/zernio/instagram/callback`), **not** the old direct-Meta callback. For ZC-12, use the existing Zernio webhook/worker health checks; the app never owns Meta token scopes or `subscribed_apps` on this route.

## Exit decision

Mark **PASS** only when ZC-01 through ZC-12 pass or each unsupported provider capability is explicitly scoped out, and both non-tester owners have completed their own consent. Unit tests prove local code paths, not third-party account eligibility or provider approval.
