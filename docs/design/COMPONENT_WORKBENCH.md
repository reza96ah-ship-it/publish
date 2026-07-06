# Component Workbench

> Canonical reference for every shadcn/ui-based component used in Nashrino.
> Use this as the single source of truth for component states, sizes, and
> token bindings — when in doubt, match what is documented here, not what
> a one-off view does elsewhere.

Issues: #300 (component states), #301 (token reference).

## 1. Why this file exists

Across 20+ views the same `Button`, `Card`, `Badge`, `Dialog`, etc. were
drifting in size, padding, and color usage. This file lists, per component,
the **only** states and prop combinations the design system supports, plus
the design tokens they bind to. New views must use these states verbatim;
deviations need a design review.

## 2. Token reference (from `src/app/globals.css`)

| Token                    | Light value     | Dark value     | Used for                            |
| ------------------------ | --------------- | -------------- | ----------------------------------- |
| `--background`           | `0 0% 100%`     | `240 10% 4%`   | Page background                     |
| `--foreground`           | `240 10% 4%`    | `0 0% 98%`     | Primary text                        |
| `--card`                 | `0 0% 100%`     | `240 10% 6%`   | Card surface                        |
| `--card-foreground`      | `240 10% 4%`    | `0 0% 98%`     | Card text                           |
| `--muted`                | `240 5% 96%`    | `240 4% 16%`   | Muted backgrounds (notes, hover)    |
| `--muted-foreground`     | `240 4% 46%`    | `240 5% 65%`   | Secondary text, captions            |
| `--primary`              | `173 58% 39%`   | `173 58% 45%`  | Brand teal — primary action         |
| `--primary-foreground`   | `0 0% 100%`     | `0 0% 100%`    | Text on primary                     |
| `--destructive`          | `0 72% 51%`     | `0 72% 51%`    | Danger / delete actions             |
| `--border`               | `240 6% 90%`    | `240 4% 16%`   | Hairline borders                    |
| `--ring`                 | `173 58% 39%`   | `173 58% 45%`  | Focus ring                          |

**Forbidden colors:** indigo, blue. Use teal (`--primary`) or warm amber
for warnings. See `VISUAL_IDENTITY.md` for the brand-color rules.

## 3. Button

| Variant       | When to use                                  | Token binding                          |
| ------------- | -------------------------------------------- | -------------------------------------- |
| `default`     | Primary CTA (publish, save, submit)          | `bg-primary text-primary-foreground`   |
| `secondary`   | Secondary action (cancel, dismiss)           | `bg-secondary text-secondary-foreground` |
| `outline`     | Tertiary action in a dense row               | `border border-input bg-background`    |
| `ghost`       | Inline action inside a Card (no chrome)      | `hover:bg-accent hover:text-accent-foreground` |
| `destructive` | Delete / revoke / disconnect                 | `bg-destructive text-white`            |

Sizes: `sm` (h-8, text-xs), `default` (h-9, text-sm), `lg` (h-10, text-base),
`icon` (size-9). **No custom sizes** — if you need a different height, file
a design ticket.

States (every variant must implement):
- **default** — resting
- **hover** — `hover:opacity-90` (default/secondary), `hover:bg-accent` (ghost)
- **focus-visible** — `ring-2 ring-ring ring-offset-2`
- **active** — `active:scale-[0.98]`
- **disabled** — `disabled:opacity-50 disabled:pointer-events-none`
- **loading** — swap label for `<Loader2 className="size-4 animate-spin" />`, keep width via `min-w-`

## 4. Card

Standard padding: `p-6` (desktop) / `p-4` (mobile via `sm:p-6`). Header uses
`flex items-center justify-between gap-4`. Body uses `mt-4 space-y-4`.

States:
- **default** — `rounded-lg border bg-card text-card-foreground shadow-sm`
- **interactive** (clickable card) — add `cursor-pointer transition-colors hover:bg-muted/40`
- **selected** — `ring-2 ring-primary`
- **disabled** — `opacity-60 pointer-events-none`

## 5. Badge

Variants: `default`, `secondary`, `destructive`, `outline`. Sizes: only one
(text-xs, px-2 py-0.5). Status badges in lists use these mappings:

| Status      | Badge variant | Extra classes                         |
| ----------- | ------------- | ------------------------------------- |
| open        | `outline`     | `border-amber-300 text-amber-700`     |
| in_progress | `outline`     | `border-sky-300 text-sky-700` (sky ≠ blue — see identity) |
| resolved    | `outline`     | `border-emerald-300 text-emerald-700` |
| closed      | `outline`     | `border-zinc-300 text-zinc-600`       |
| error       | `destructive` | —                                     |
| success     | `default`     | `bg-emerald-600` (NOT primary teal)   |

## 6. Dialog / Sheet

- **Trigger**: render as a `ghost` Button with a leading icon.
- **Content**: `sm:max-w-lg` (default), `sm:max-w-2xl` (forms), `sm:max-w-4xl` (lists).
- **Header**: title (text-lg) + optional description (text-sm text-muted-foreground).
- **Footer**: right-aligned `flex gap-2`, primary action on the left in RTL.
- **Close**: ESC + click-outside both work; show `ghost` Button labeled `بستن`.

## 7. Form inputs

- **Input / Textarea**: `h-9` (input), `min-h-20` (textarea). Use `aria-describedby` for errors.
- **Select**: same height as Input; chevron from `lucide-react`.
- **Switch**: `size-5` track, `size-4` thumb; label on the right in RTL.
- **Checkbox**: `size-4`; label uses `text-sm`.
- **Field error**: `text-xs text-destructive mt-1` with `role="alert"`.

## 8. Empty states

Every list view ships an empty state with: illustration (`size-16`), title
(`text-sm font-medium`), helper (`text-xs text-muted-foreground`), and an
optional `outline` Button. See `VISUAL_LANGUAGE_GUIDE.md` §3.

## 9. Loading states

- **Skeleton**: `bg-muted animate-pulse rounded`. Match the real layout's
  height/width so the page doesn't shift.
- **Spinner**: `Loader2` from lucide, `size-4 animate-spin`, paired with
  Persian text (`در حال بارگذاری…`).
- **Button loading**: see §3.

## 10. Toasts (Sonner)

- `success` → `bg-emerald-600 text-white`
- `error` → `bg-destructive text-white`
- `info` → `bg-foreground text-background`
- Duration: 4000ms (success), 6000ms (error), 5000ms (info).
- Always Persian; action button on the left in RTL.
