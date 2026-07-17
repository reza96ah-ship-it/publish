# TC-RES-05: Export package for manual publishing

| Field | Value |
|---|---|
| Test ID | TC-RES-05 |
| Date | |
| Commit SHA | |
| Environment | Staging or Production |

## Steps
1. Open the publishing queue (dashboard)
2. Find any job in `scheduled`, `live`, `action`, or `failed` state
3. Click the "⋮" actions menu on the row
4. Click "دانلود برای انتشار دستی" (Download for manual publishing)
5. Confirm a `.zip` file is downloaded

## Expected
- ZIP file downloaded with filename `nashrino-export-<title>-<id>.zip`
- ZIP contains:
  - `caption.txt` — full Persian caption, UTF-8 encoded
  - `hashtags.txt` — hashtag string (or "(بدون هشتگ)" if empty)
  - `schedule.txt` — Jalali date + UTC ISO timestamp
  - `metadata.json` — structured JSON with job/platform/campaign info
  - `media/` folder — numbered media files in publish order
- No claim in the ZIP that it will auto-publish to Instagram
- `metadata.json` contains `warning` field: "این فایل برای انتشار دستی است"

## Actual
<!-- Fill in -->

## Result
<!-- PASS / FAIL / PARTIAL -->

## Evidence

**ZIP filename downloaded:**

**ZIP contents listing (run: `unzip -l <filename>.zip`):**

```
# paste output here
```

**`metadata.json` content:**

```json
# paste metadata.json here
```

**`caption.txt` content (confirm UTF-8 Persian renders correctly):**

**Media files included (count and types):**

## Notes
- If media URLs are unreachable at export time, a `media/SKIPPED.txt` is included
  with the list of skipped URLs — this is expected behavior under connectivity issues
- The export is a fallback tool, not a publish path — confirm no UI anywhere
  claims this export will post to Instagram automatically

## Related issue
[#351](https://github.com/reza96ah-ship-it/publish/issues/351)
