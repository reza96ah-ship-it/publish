# Visual Identity

> Nashrino's visual identity in one page. Brand color rules, differentiation
> from competitors, and the rationale for the current palette.

Issues: #300 (visual maturity), #303 (brand color rules).

## 1. Current identity at a glance

| Element            | Value                                  |
| ------------------ | -------------------------------------- |
| Primary brand color| Teal `#0F766E` (`tailwindcss` `teal-700`) |
| Accent color       | `#2563EB` (blue-600) — **legacy, being retired** |
| Surface            | White / near-black (dark mode)         |
| Type               | Persian-first, Vazirmatn for fa, Inter for en |
| Radius             | `rounded-lg` (8px) on cards, `rounded-md` (6px) on inputs |
| Voice              | Formal-warm, verb-final, Persian digits |

The default workspace ships with `brandPrimaryColor = #0F766E` (teal) and
`brandAccentColor = #2563EB` (blue). **The accent is being retired** — new
UI must not introduce new blue. See §3.

## 2. Differentiation

Nashrino competes with Iranian social-management tools (SabaVision,
AftabRayaneh's publishing tools) and global ones (Buffer, Hootsuite). The
visual identity differentiates on three axes:

1. **Persian-first typography** — Vazirmatn at every weight, with proper
   Persian digits and ZWNJ handling. Most competitors ship a Latin font
   with Persian as an afterthought.
2. **Teal, not blue** — the Iranian market is saturated with blue (state
   brands, banking). Teal signals "modern publishing tool" without
   picking a fight with the state-blue association.
3. **Editorial density** — global tools (Buffer, Later) optimize for
   marketing teams with 1–2 accounts. Nashrino's density (per-post
   analytics, multi-platform calendar, RTL IG grid) targets agencies
   managing 5+ workspaces.

## 3. Brand color rules (NON-NEGOTIABLE)

### 3.1 Allowed
- **Teal** (`--primary`, `#0F766E`) — primary CTAs, links, focus rings,
  selected states, chart series #1.
- **Warm amber** (`#D97706`, `amber-600`) — warnings, in-progress status,
  chart series #2.
- **Rose** (`#E11D48`, `rose-600`) — destructive actions, error states,
  chart series #3.
- **Emerald** (`#059669`, `emerald-600`) — success, resolved status,
  chart series #4.
- **Zinc** neutrals (`--background`, `--foreground`, `--muted`) — surfaces,
  text, borders.

### 3.2 Forbidden
- **Blue** (`blue-*`, `#2563EB`, `#3B82F6`) — except the legacy
  `brandAccentColor` field on `Workspace`, which is being migrated to teal.
  Do NOT introduce new blue in UI, charts, or illustrations.
- **Indigo** (`indigo-*`) — never. Visual-design lint will fail the PR.
- **Violet / Purple** — reserved for a future "premium" plan indicator; do
  not use elsewhere.
- **Tailwind `sky-*`** — the only exception is the `in_progress` status
  badge, which uses `sky-300/700` (sky is visually distinct from blue at
  small sizes). Do not extend this exception.

### 3.3 White-label override
Each workspace may override `brandPrimaryColor` and `brandAccentColor` via
the agency white-label settings (`/api/agency` PATCH). When the override is
active, ALL primary CTAs, focus rings, and selected states switch to the
override — never partially. Charts keep their series palette (teal/amber/
rose/emerald) so the workspace brand doesn't fight the data.

### 3.4 Contrast
- Brand teal on white: 4.5:1 (AA for body text) ✓
- Brand teal on `--muted`: 4.0:1 — use only for non-text (icons, badges)
- White on brand teal: 4.5:1 ✓
- Always test new color pairings with the WCAG 2.2 AA checker (see
  `EXTERNAL_REVIEW_CHECKLIST.md`).

## 4. Logo lockup

- **Wordmark:** "نشرینو" in Vazirmatn Bold, no icon. Used in the sidebar
  header at `text-xl`.
- **Icon lockup:** a teal rounded square with a stylized "ن" (Persian
  letter noon) in white. Used as the favicon and the auth-page hero.
- **Spacing:** 8px between icon and wordmark; total height 32px in the
  sidebar, 48px on the auth page.
- **Don't:** recolor the logo, add a drop shadow, animate it, or place it
  on a non-solid background.

## 5. Typography scale

| Role           | Size   | Weight  | Line height |
| -------------- | ------ | ------- | ----------- |
| Page title     | text-xl| 700     | 1.4         |
| Section title  | text-lg| 600     | 1.4         |
| Card title     | text-base | 600  | 1.5         |
| Body           | text-sm| 400     | 1.6         |
| Caption / meta | text-xs| 400     | 1.5         |
| Button label   | text-sm| 500     | 1           |
| Code / kbd     | text-xs| 500     | 1           (Vazir Code) |

## 6. What to do if you need a color not listed here

1. Check `VISUAL_LANGUAGE_GUIDE.md` §4 (chart palette) and §1 (icon
   colors) — it may already be allowed there.
2. If not, file a design ticket. The bar for adding a color is:
   - It serves a *semantic* purpose (status, category), not decoration.
   - It passes WCAG 2.2 AA on every surface it will appear on.
   - It doesn't conflict with an existing semantic color.
3. Once approved, add it to `COMPONENT_WORKBENCH.md` §2 (token reference)
   and update the design-lint script (`scripts/lint-design.sh`).
