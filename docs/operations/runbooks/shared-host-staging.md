# Shared Netherlands-host staging (not yet deployed)

The Netherlands VPS already runs Xray, the webhook relay, and host Caddy for
`hooks.odooshoping.ir`. On 2026-10-04 it had 1 GB RAM, 24 GB disk, no Docker,
and Caddy owned ports 80/443. **Do not run the application stack on that size.**
Resize first (8 GB RAM and 40 GB disk recommended; 4 GB RAM is a tight minimum),
then verify free memory and disk again before installing Docker.

## Isolation design

- Point DNS-only `staging.odooshoping.ir` at the Netherlands VPS. Keep the
  existing `hooks.odooshoping.ir` record and Caddy site untouched.
- Use `/opt/nashrino-staging` with staging-only `.env.production` (mode 0600),
  separate secrets, a fresh PostgreSQL volume, and no production data copy.
- Run Compose with project name `nashrino-staging` and both
  `compose.production.yaml` and `compose.staging.yaml`. The overlay reduces the
  app to one replica, binds the app/realtime only to loopback ports 3004/3005,
  and excludes the Compose Caddy service. Do not run the base Compose file alone
  on this shared host: it would try to claim ports 80/443.
- Extend the **host** Caddy configuration with a separate
  `staging.odooshoping.ir` site that proxies `/socket.io/*` to
  `127.0.0.1:3005` and everything else to `127.0.0.1:3004`. Validate the
  complete Caddyfile before reloading; leave the existing hooks site in place.
- The GitHub staging workflow must fail when its SSH/domain secrets are absent,
  fetch the exact selected commit, and use the staging overlay. Do not interpret
  a skipped deployment as a passed staging test.

## Before a first run

1. Resize the VPS and confirm Xray, the webhook relay, and `hooks.odooshoping.ir`
   remain healthy. Install Docker Engine and the Compose plugin only after
   confirming capacity. Reserve enough disk for images, the database, and backups.
2. Prepare the isolated checkout and staging-only environment. Set
   `NEXTAUTH_URL=https://staging.odooshoping.ir`, strong unique auth/database
   secrets, and the provider configuration required by `.env.example`. Do not
   reuse production tokens, database credentials, or a production webhook
   destination. Set `PLATFORM_OWNER_EMAIL` to the operator's staging app email;
   the invite API remains closed until that owner rotates the initial password
   and enrolls in MFA. Never run the demo account seed in staging.
3. Add the DNS record and host-Caddy site, validate Caddy, then reload it. Do
   not replace or restart the existing Xray/webhook services.
4. Configure the GitHub `staging` environment secrets named in
   `.github/workflows/deploy-staging.yml`. Run the workflow manually for the
   exact reviewed commit; verify the image tag and deployed SHA match.
5. After migrations succeed, bootstrap the one initial owner in the **empty**
   staging database. The one-time script is shipped in the migrate image and
   refuses the production URL or any database with users/workspaces. From the
   isolated staging checkout on the VPS, enter a strong temporary **app**
   password without echoing it or placing it in shell history:

   ```bash
   read -r -s -p 'Temporary staging app password: ' STAGING_BOOTSTRAP_PASSWORD
   printf '\n'
   printf '%s\n' "$STAGING_BOOTSTRAP_PASSWORD" | docker compose -p nashrino-staging \
     -f compose.production.yaml -f compose.staging.yaml run --rm -T --no-deps \
     -e STAGING_OWNER_BOOTSTRAP_CONFIRM=create-on-empty-staging-only \
     migrate bun run scripts/bootstrap-staging-owner.ts
   unset STAGING_BOOTSTRAP_PASSWORD
   ```

   Confirm the command reported creation of one staging workspace. If it
   refuses a non-empty database, inspect that database; do not reset it or run
   the demo seed to work around the refusal.

6. Confirm HTTPS health, readiness, login, separate staging volumes, and no
   regressions to the hooks endpoint. Complete `docs/STAGING_ACCEPTANCE.md`,
   adapting its database backup/restore steps to the isolated staging database.
   Do not run `scripts/rollback.sh` on this shared host: it uses the base
   Compose file, which would start a second Caddy on 80/443. Instead, rehearse
   `scripts/rollback-staging.sh staging-<previous-commit-sha>` against a
   disposable staging state before inviting real customers. It only reverts
   app/worker/realtime images; database migrations are not reversed, so the
   prior code must be schema-compatible.
   Only then rotate the staging owner app password, sign in again, enroll MFA,
   and issue private customer invitations.

The connected `@couchlet` Business account is a tester account. It cannot
certify non-tester onboarding. Use distinct non-tester Business and Creator
owners for `docs/certification/instagram/connection/ZERNIO-CUSTOMER-ROUTE.md`.
Do not request or store their Instagram passwords.
