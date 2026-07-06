# External Review Checklist

> Pre-merge checklist for visual + accessibility review. Run every item
> against a staging build of the PR. If any item fails, block merge.

Issues: #300 (visual maturity), #304 (external review).

## 1. WCAG 2.2 AA

Each item applies to **both** light and dark mode.

- [ ] **1.4.3 Contrast (Minimum)** — every text-on-background pair ≥ 4.5:1
  (body text) or 3:1 (large text ≥ 24px or 19px bold). Test with the
  [WAVE extension](https://wave.webaim.org/) + a manual spot-check of:
  - `--muted-foreground` on `--card`
  - `--muted-foreground` on `--muted`
  - Status-badge text on its tinted background
- [ ] **1.4.11 Non-text Contrast** — UI components (borders, focus rings)
  ≥ 3:1 against adjacent colors. Test: focus ring on `--background` and
  on `--muted`.
- [ ] **1.4.13 Content on Hover or Focus** — hover/focus popovers
  (tooltips, hover-cards) are dismissible with ESC, hoverable, and
  persistent.
- [ ] **2.4.7 Focus Visible** — every interactive element has a visible
  focus ring (`ring-2 ring-ring ring-offset-2`). Tab through the page
  and confirm no element is unfocusable or has an invisible ring.
- [ ] **2.5.8 Target Size (Minimum)** — touch targets ≥ 24×24 CSS pixels
  (mobile). Test on a 360px viewport.
- [ ] **3.2.1 On Focus** — focusing an element doesn't trigger a context
  change (no auto-submit, no navigation).
- [ ] **3.3.2 Labels or Instructions** — every form input has a
  programmatically-associated `<label>` or `aria-label`. Error messages
  are linked via `aria-describedby` and have `role="alert"`.
- [ ] **4.1.2 Name, Role, Value** — custom UI (Sheet, Dialog, Popover)
  uses the correct `role`, `aria-modal`, `aria-labelledby`. Test with
  axe DevTools.

## 2. Screen reader walkthrough

Test with **both** NVDA (Windows + Firefox) and VoiceOver (macOS + Safari).

- [ ] **Page title** — every route sets a unique `<title>` (or H1 for
  sheet content) that announces on load.
- [ ] **Heading order** — H1 → H2 → H3, no skipped levels. Use the
  heading-map feature in the browser's accessibility inspector.
- [ ] **Landmarks** — every page has `<header>`, `<main>`, `<footer>` and
  (where applicable) `<nav>` with `aria-label`.
- [ ] **Live regions** — toasts, inline form errors, and "saving…"
  indicators use `aria-live="polite"`. Errors that block action use
  `aria-live="assertive"`.
- [ ] **Lists** — every set of 3+ related items is in `<ul>` / `<ol>`
  with `<li>` children. No `<div>`-based fake lists.
- [ ] **Tables** — data tables use `<thead>` / `<tbody>` / `<th scope>`.
  Layout tables are forbidden — use CSS grid.
- [ ] **Tab order** — visual order matches DOM order. No positive
  `tabindex` (use 0 or -1 only).
- [ ] **Empty states** — empty lists announce their title + helper
  (e.g. "محتوایی ثبت نشده. برای شروع، روی دکمه زیر بزنید").
- [ ] **Charts** — every chart has a `summary` and a data table fallback
  (visually hidden via `sr-only`) OR an `aria-label` that summarizes the
  trend.

## 3. Visual review (manual, 5-minute sweep)

Open the PR's staging build on a 1440px desktop AND a 360px mobile. For
each affected route:

- [ ] **Layout** — no overflow, no clipped content, no horizontal
  scrollbar at any breakpoint between 360 and 1920.
- [ ] **Alignment** — cards in a row are the same height; inputs in a
  form are the same width; buttons in a row are aligned to a grid.
- [ ] **Spacing** — uses the rhythm (4/8/16/24/32). No `gap-3`, `gap-5`,
  `gap-7` (see `VISUAL_LANGUAGE_GUIDE.md` §7).
- [ ] **Typography** — Persian digits where applicable, no Latin digits
  in body copy, no mixed-direction inline text without `<span dir="ltr">`.
- [ ] **Color** — no blue, no indigo, no violet (see
  `VISUAL_IDENTITY.md` §3). Run `bun run lint:design` to enforce.
- [ ] **Dark mode** — switch theme and re-check the page. Every surface,
  text, border, and chart renders correctly. No "white box on black
  background" or "black text on dark background".
- [ ] **Empty state** — navigate to a route with no data and confirm
  the empty state renders (illustration + title + helper + action).
- [ ] **Loading state** — navigate to a route and confirm skeletons (not
  spinners) render in the right shape and don't shift on data arrival.
- [ ] **Error state** — temporarily break a fetch (DevTools → Network →
  block the URL) and confirm the error UI renders with a Persian message
  + retry action.

## 4. Persian-specific checks

- [ ] **Digits** — `workspace.persianDigits` is `true` by default. Every
  number in the UI (counts, dates, currency, IDs) renders in Persian
  digits. Test on a workspace with the flag off to confirm graceful
  fallback.
- [ ] **Calendar** — date pickers default to Jalali (`src/components/ui/
  jalali-picker.tsx`). Confirm the picker renders correctly and
  round-trips a date through the API without timezone drift.
- [ ] **ZWNJ** — Persian compound words (`ثبت‌نام`, `می‌خواهم`) use the
  ZWNJ character (U+200C), NOT a regular space or hyphen. Spot-check in
  copy submitted by forms.
- [ ] **Arabic letter variants** — Persian text fields run through
  `normalizeArabicToPersian` (`src/lib/validations.ts`). Confirm a
  paste of Arabic-typed `ي`/`ك` is normalized to `ی`/`ک` on save.
- [ ] **Direction** — every page sets `dir="rtl"` on `<html>`. Forms
  that mix Latin fields (email, URL) wrap them in `<span dir="ltr">` or
  set `dir="ltr"` on the input.
- [ ] **Font weight** — Vazirmatn renders bold correctly. No faux-bold
  (browser-synthesized) — confirm `font-weight: 700` uses the real
  Vazirmatn-Bold file.

## 5. Motion review

- [ ] **Durations** — every animation uses the tokenized durations (fast
  150ms, base 200ms, slow 300ms). No raw `duration-700`, `duration-1000`.
- [ ] **Easing** — entrances use `ease-out`, exits use `ease-in`, state
  changes use `ease-in-out`.
- [ ] **Reduced motion** — set `prefers-reduced-motion: reduce` in
  DevTools → Rendering. Confirm every animation either disables or
  reduces to a fade. No animation should run > 200ms in reduced-motion
  mode.
- [ ] **No decorative motion** — no auto-playing carousels, no parallax,
  no entrance choreography that delays content. Motion is reserved for
  state changes (see `VISUAL_LANGUAGE_GUIDE.md` §6).

## 6. Sign-off

- Reviewer: ____________________
- Date: ____________________
- PR: ____________________
- Items failed: ____________________
- Verdict: ☐ merge  ☐ block  ☐ merge with follow-up
