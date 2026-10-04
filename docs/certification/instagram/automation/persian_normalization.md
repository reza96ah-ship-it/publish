# Comment-to-DM matching policy

This documents the implemented policy in `src/modules/automation/comment-dm-shared.ts` and the worker copy in `mini-services/publish-worker/lib/persian-match.ts`. It is code-level evidence for issue #354, not a claim that the 50 live-comment certification has passed.

## Normalization

- Matching is case-insensitive. Arabic `ي` and `ك` become Persian `ی` and `ک`; `ة` becomes `ه`. Common Arabic alef/hamza variants and presentation forms are also folded.
- Persian and Arabic-Indic digits become ASCII digits. Arabic diacritics are removed.
- A zero-width non-joiner becomes a space; right-to-left and left-to-right marks are removed. Repeated whitespace collapses to one space.
- Common Persian/English punctuation becomes a space. Emoji are **preserved**; they are not stripped.
- Exclude keywords take precedence over trigger keywords. Both sides use the same normalization.

## Match and rule precedence

- A normalized trigger is a **substring**, not a whole-word match. Thus `قیمت` matches `قیمت‌گذاری` after normalization. Multi-word phrases stay intact within one keyword.
- Within one rule, the first configured matching keyword is the reported hit. A comma, Persian comma, newline, or pipe separates keywords.
- When multiple rules match one comment, a post-specific rule takes precedence over a workspace-wide rule. Within the same specificity, the newest rule wins. The worker's account-level database claim prevents a second rule or worker from sending another private reply for the same comment, or to the same commenter on the same post.
- A configured frequency cap can suppress later comments from the same sender under the same rule. The account/post/commenter claim remains effective even if that cap is zero.
- Invalid, implausibly future, or seven-day-old comments are skipped before a provider send. An uncertain send is never retried automatically; it stays visible in run history for manual reconciliation.

## Code-level examples to verify

| Input | Keyword | Expected result |
|---|---|---|
| `قيمت؟` | `قیمت` | Match (Arabic yeh + punctuation) |
| `كمك` | `کمک` | Match (Arabic kaf) |
| `  قیمت  ` | `قیمت` | Match (whitespace) |
| `🔥قیمت🔥` | `قیمت` | Match (emoji retained around keyword) |
| `قیمت‌گذاری` | `قیمت` | Match (substring policy) |
| `قیمت گران` | `قیمت`, exclude `گران` | Excluded |

The remaining live certification requires 50 controlled comments, including duplicate webhook delivery, worker restart, provider receipts, and native Instagram comparison. No live pass/fail result is recorded here.
