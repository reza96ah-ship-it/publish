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
