# Nashrino — Claude Code Guidelines

## CSS sizing rules

**Fixed `px` only for icons, avatars, and decorations.**

| Use case | Correct pattern |
|---|---|
| Icon / avatar | `size-8`, `size-[18px]` — fine |
| Badge min-width | `min-w-[16px]` — fine |
| Thin decorative line | `w-[2px]`, `h-[2px]` — fine |
| Popover / overlay width | `w-full max-w-[Npx]` or `w-[min(Npx,calc(100vw-2rem))]` |
| Chart panel height (Recharts needs explicit height) | Responsive tiers: `h-[320px] sm:h-[420px] md:h-[460px] lg:h-[500px]` |
| Section / card height | `min-h-*` + content-driven, not fixed `h-[Npx]` |
| Grid columns | Always include a `md:` tier between mobile 1-col and `lg:` multi-col |

**Never introduce a bare `w-[Npx]` or `h-[Npx]` for layout containers.** If Recharts or another chart library requires an explicit height parent, use responsive breakpoint pairs.

## RTL / logical CSS

This is an RTL-first app (`dir="rtl"`). Always use CSS logical properties:

| Physical (❌) | Logical (✓) |
|---|---|
| `ml-`, `mr-` | `ms-`, `me-` |
| `pl-`, `pr-` | `ps-`, `pe-` |
| `left-`, `right-` | `start-`, `end-` |
| `border-l`, `border-r` | `border-s`, `border-e` |
| `rounded-l-*`, `rounded-r-*` | `rounded-s-*`, `rounded-e-*` |

## Tailwind v4

`tailwind.config.ts` is **dead code** — Tailwind v4 never reads it. All tokens live in `src/app/globals.css` inside the `@theme inline` block. Do not add mappings to `tailwind.config.ts`.

## Dark mode

Use `dark:` variants whenever adding color-bearing classes. Check `n-*` semantic tokens first — they already have dark-mode values built in. Raw palette classes (`bg-pink-100`, etc.) always need a `dark:` counterpart.

## Tap targets

All interactive elements must be ≥ 44 × 44px on mobile. Use `min-h-[44px]` on buttons/links inside touch UIs.

## Type scale

Use the semantic type scale — **never** write `text-[Npx]` or `font-[N]` arbitrary values. CI will reject them.

| Token | Size | Use case |
|---|---|---|
| `text-2xs` | 10px | Absolute floor — badge micro-labels, decorative only |
| `text-xs` | 11px | Timestamps, secondary chip labels |
| `text-sm` | 12.5px | Captions, helper text, meta-info |
| `text-base` | 14px | Body copy, form labels |
| `text-lg` | 16px | Section titles, card headings |
| `text-xl` | 20px | View headings |
| `text-2xl` | 26px | Display / KPI numbers |

Font weights: `font-medium` (500) · `font-semibold` (600) · `font-bold` (700) · `font-extrabold` (800). Never use `font-[N]`.

## Design lint gate

`bun run lint:design` (via `scripts/lint-design.sh`) enforces three rules in CI:

1. **No raw palette / hex colors** outside documented exceptions — use `n-*` semantic tokens
2. **No physical direction classes** (`text-right`, `rounded-l-*`) in RTL-first components — use `text-start/end`, `rounded-s-*/e-*`
3. **No arbitrary type sizes** (`text-[14px]`, `font-[500]`) — use the semantic scale above

Run it locally before pushing: `bun run lint:design`

## Visual regression

Baselines live in `tests/e2e/visual.spec.ts-snapshots/` (committed to git).
36 screenshots: 6 views × 3 viewports (375/768/1280px) × 2 themes (light/dark).
Dynamic regions (dates, charts, KPI numbers) are masked so data noise never fails a run.

**To update snapshots** after intentional UI changes:

```bash
bun run test:visual:update   # regenerates all baselines
git add tests/e2e/visual.spec.ts-snapshots/
git commit -m "chore: update visual regression baselines"
```

**CI flow**: the `visual` job runs on ubuntu-latest (Chromium). Diffs upload as `visual-diff-report` artifact on failure. `continue-on-error: true` until baselines are committed — remove that flag once the snapshots directory is in git.
