# Instagram Failure & Duplicate Test Matrix

Test cases for issue [#350](https://github.com/reza96ah-ship-it/publish/issues/350) — Week 3.

## Why this matters
A silently lost accepted publication destroys user trust.
A duplicate external post embarrasses clients and violates Meta rate limits.
An `OUTCOME_UNKNOWN` state that is never resolved leaves a user with no safe action.
These are product-ending failures — this matrix verifies none of them can occur.

## Test case index

### Worker failures
| Test | Description | Status |
|---|---|:---:|
| [TC-FAIL-WORKER-01](TC-FAIL-WORKER-01.md) | Worker stops before provider call | ⬜ |
| [TC-FAIL-WORKER-02](TC-FAIL-WORKER-02.md) | Worker stops after provider call, before local ACK | ⬜ |
| [TC-FAIL-WORKER-03](TC-FAIL-WORKER-03.md) | Queue restart / Redis loss | ⬜ |

### Provider failures
| Test | Description | Status |
|---|---|:---:|
| [TC-FAIL-PROVIDER-01](TC-FAIL-PROVIDER-01.md) | Provider timeout → OUTCOME_UNKNOWN | ⬜ |
| [TC-FAIL-PROVIDER-02](TC-FAIL-PROVIDER-02.md) | Provider 5xx → bounded retry → FAILED | ⬜ |
| [TC-FAIL-PROVIDER-03](TC-FAIL-PROVIDER-03.md) | Provider rate limit (429) + Retry-After | ⬜ |
| [TC-FAIL-PROVIDER-04](TC-FAIL-PROVIDER-04.md) | Expired media URL → ACTION_REQUIRED | ⬜ |
| [TC-FAIL-PROVIDER-05](TC-FAIL-PROVIDER-05.md) | Token revoked at dispatch → RECONNECT_REQUIRED | ⬜ |

### Cancellation
| Test | Description | Status |
|---|---|:---:|
| [TC-FAIL-CANCEL-01](TC-FAIL-CANCEL-01.md) | Cancel before dispatch (clean) | ⬜ |
| [TC-FAIL-CANCEL-02](TC-FAIL-CANCEL-02.md) | Cancel during processing (ambiguous) | ⬜ |

### Retry and duplicate prevention
| Test | Description | Status |
|---|---|:---:|
| [TC-FAIL-DUP-01](TC-FAIL-DUP-01.md) | Manual retry — exactly one external post | ⬜ |
| [TC-FAIL-DUP-02](TC-FAIL-DUP-02.md) | Concurrent workers — fencing prevents double dispatch | ⬜ |

Update status: ✅ PASS · ❌ FAIL · ⚠️ PARTIAL · ⬜ Not run

## Duplicate prevention checklist
- [ ] Stable publication operation identity (same ID across retries)
- [ ] Provider-native idempotency key used where Meta supports it
- [ ] Provider ID checked before retry (if ID exists, do not re-publish)
- [ ] Outbox entry uses atomic lease (prevents concurrent worker processing)
- [ ] Dead-letter queue contains failed entries (no silent loss)
- [ ] Manual reconciliation action available for OUTCOME_UNKNOWN

## Gate: "Publishing: Proven"
All 12 TCs must be completed, with:
- TC-FAIL-WORKER-01, -02, -03: zero known duplicates
- TC-FAIL-PROVIDER-01: `OUTCOME_UNKNOWN` used (not FAILED, not PUBLISHED)
- TC-FAIL-DUP-01, -02: zero unintended external duplicates
