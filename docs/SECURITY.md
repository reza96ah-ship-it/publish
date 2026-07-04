# Security Notes

## Platform Token Encryption

`Platform.tokenSecret` stores bot tokens and OAuth tokens. These values must be
encrypted before they are persisted and decrypted only at the boundary where a
platform API call is made.

Current audit result:

- `POST /api/platforms/[id]/connect` validates the submitted token with the
  platform API, then stores `ensureEncrypted(token)`.
- `POST /api/platforms/[id]/validate` decrypts `tokenSecret` before calling
  Telegram, Bale, or Rubika validation endpoints.
- `GET /api/analytics/real` decrypts `tokenSecret` before platform analytics
  requests.
- `mini-services/publish-worker` decrypts `tokenSecret` before handing the
  account token to channel adapters.
- Existing plaintext tokens remain readable because `decrypt()` returns
  plaintext values unchanged; the next data migration can re-save old tokens via
  `ensureEncrypted()`.

Regression coverage:

- `tests/unit/api/platform-token-encryption.test.ts` verifies a connected
  platform stores ciphertext rather than the submitted plaintext token.
