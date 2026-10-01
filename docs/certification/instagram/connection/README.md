# Instagram connection certification

The supported customer route is **invite-only account creation → isolated workspace → Zernio Instagram connect**. Run [the Zernio customer route plan](ZERNIO-CUSTOMER-ROUTE.md) before marking issue [#347](https://github.com/reza96ah-ship-it/publish/issues/347) complete. Zernio recommends [one profile per customer](https://docs.zernio.com/multi-tenant); this app stores one `zernioProfileId` per workspace and verifies the callback account against that profile.

The existing `TC-CONN-01` through `TC-CONN-12` files describe the **legacy direct-Meta OAuth route** (`/api/platforms/oauth/*`). Their Meta app credentials, token scopes, token-expiry, and `subscribed_apps` expectations do **not** apply to a Zernio connection. Retain those cases only if direct-Meta support is separately certified. Do not use their statuses to claim that customer onboarding through Zernio works.

## Current release gate: customer connection proven

All of these must be evidenced in a deployed environment:

1. The invite-only signup route is deployed; an unauthorized user cannot issue invitations, a link cannot be replayed, and an expired/revoked link cannot create an account.
2. A genuinely non-tester **Business** owner receives a private invitation, creates their own app credentials, signs in, and connects their own account through Zernio. Record the visible username/profile photo and the Zernio account/profile IDs. Do not request Instagram credentials.
3. Repeat with a distinct, genuinely non-tester **Creator** owner and a distinct workspace/Zernio profile.
4. Verify cross-workspace access is denied, callback flow-cookie mismatch is denied, and no account or message data crosses workspaces.
5. Verify a fresh inbound message and comment where permitted, plus sync/webhook health. Mark a limitation if provider permissions or account eligibility prevent a subfeature.

Until both real owners complete consent and evidence is attached, the gate remains **NOT RUN**, even if unit tests and the existing @couchlet test account pass.
