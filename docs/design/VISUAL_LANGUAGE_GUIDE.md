# Visual Language Guide

> Rules for iconography, illustrations, empty states, chart grammar, Persian
> UI tone, and motion. This is the canonical reference for the "feel" of the
> product — every screen should read as Nashrino within 2 seconds.

Issues: #300 (visual maturity), #302 (Persian UI tone).

## 1. Iconography

**Library:** `lucide-react` (1.5px stroke, 24×24 viewbox). No other icon
libraries.

**Sizes (only these three):**
- `size-3.5` — inline within dense table cells / badges
- `size-4` — default (buttons, form labels, list items)
- `size-5` — section headers, empty-state illustrations

**Color binding:**
- Inside `Button` → inherit `currentColor`
- Standalone in a row → `text-muted-foreground`, hover `text-foreground`
- Status indicators → `text-emerald-600` (success), `text-rose-600` (error),
  `text-amber-600` (warning), `text-primary` (info)

**Forbidden:**
- Emoji as icons (inconsistent across Persian/Arabic fonts)
- Custom SVG icons outside `/public/icons` (use lucide or commission a set)
- Color-tinted icons that aren't status-related

## 2. Illustrations

**Style:** flat, single-color line art on a `bg-muted/40` circle. Stroke
matches `--muted-foreground`. No gradients, no characters.

**Usage:**
- Empty states only (never decorative on a populated screen)
- `size-16` (40×40 in CSS pixels) centered above the empty-state title
- Picked from `src/components/dashboard/illustrations.tsx`

**Forbidden:**
- Stock photos
- 3D / isometric renders
- Animated illustrations (motion is reserved for state changes — see §6)
- Mascots

## 3. Empty states

Every empty state has four parts, top to bottom:

1. **Illustration** — `size-16`, muted foreground color
2. **Title** — `text-sm font-medium`, Persian, sentence case
3. **Helper** — `text-xs text-muted-foreground`, explains *what to do next*
4. **Action** — optional `outline` Button, primary verb (`+ محتوای جدید`)

Persian copy rules:
- Title is a noun phrase, not a sentence (`هیچ محتوایی وجود ندارد` ✗ →
  `محتوایی ثبت نشده` ✓)
- Helper starts with a verb in imperative (`برای شروع، روی دکمه زیر بزنید`)
- Action button label is verb + object (`+ محتوای جدید`, `+ کمپین جدید`)

## 4. Chart grammar

**Library:** `recharts` via `src/components/ui/chart.tsx`. No raw SVG charts.

**Chart-type → use-case matrix:**

| Data shape                          | Chart type        | When to use                       |
| ----------------------------------- | ----------------- | --------------------------------- |
| Time series (1 metric)              | Line              | Engagement over 30 days           |
| Time series (2+ metrics)            | Stacked area      | Reach vs impressions              |
| Categorical (≤5 items)              | Donut             | Channel distribution              |
| Categorical (6–12 items)            | Horizontal bar    | Top posts by engagement           |
| Categorical (>12 items)             | Top-10 horizontal bar + "و …" | Top hashtags         |
| Distribution (single)               | Histogram         | Caption length distribution       |
| Pre/post comparison                 | Grouped bar       | Benchmark vs competitor           |

**Axis rules:**
- X-axis: Persian digits (`fa-IR` locale via `Intl.NumberFormat('fa-IR')`)
- Y-axis: compact notation (`۱.۲ هزار`, `۳.۴ میلیون`)
- Grid lines: `stroke-border` at 50% opacity, dashed
- Tooltip: `bg-popover text-popover-foreground`, Persian date label

**Color palette (chart series, in order):**
1. `--primary` (teal)
2. `--chart-2` (amber)
3. `--chart-3` (rose)
4. `--chart-4` (emerald)
5. `--chart-5` (zinc)

Never use blue/indigo for chart series — see `VISUAL_IDENTITY.md`.

## 5. Persian UI tone

Nashrino speaks **formal but warm Persian** (کتابی نزدیک به محاوره).

| Do ✓                                     | Don't ✗                                  |
| ---------------------------------------- | ---------------------------------------- |
| `ذخیره شد`                               | `با موفقیت ذخیره شد`                     |
| `خطا در ذخیره‌سازی. دوباره تلاش کنید.`    | `عملیات ناموفق بود`                      |
| `در حال بارگذاری…`                       | `Loading…`                               |
| `+ محتوای جدید`                          | `محتوای جدید بسازید`                     |
| `آیا مطمئن هستید؟`                       | `Are you sure?`                          |

Rules:
- **Verbs come last** in Persian — keep the natural word order.
- **Digits are Persian** (`۰۱۲۳۴۵۶۷۸۹`), enabled by `workspace.persianDigits`.
- **Numbers with units** keep the unit in Persian (`۳.۴ هزار`, not `3.4K`).
- **Dates** use Jalali (`fa-IR` calendar via `Intl.DateTimeFormat`).
- **Punctuation**: Persian comma `،`, Persian question mark `؟`. No `،` at line end.
- **No mixed-direction inline text** — wrap Latin strings (URLs, emails) in
  `<span dir="ltr">`.

## 6. Motion

**Library:** Framer Motion. Tokenized durations in `src/lib/motion.tsx`.

**Durations (only these three):**
- `fast` — 150ms (hover, focus, small UI feedback)
- `base` — 200ms (sheets, dialogs, dropdowns)
- `slow` — 300ms (page transitions, large list reorders)

**Easing:** `ease-out` for entrances, `ease-in` for exits, `ease-in-out` for
state changes within a single element.

**Allowed motion:**
- Hover/focus scale on Buttons (`active:scale-[0.98]`)
- Slide-in for Sheets/Drawers (`translate-x` only, no fade)
- Fade for Dialogs (opacity + small `scale-95 → scale-100`)
- List reordering (layout animation, 200ms)

**Forbidden motion:**
- Parallax
- Auto-playing carousels
- Decorative animations on first paint (entrance choreography that delays content)
- Anything that runs > 400ms

**Reduced motion:** every animation must respect `prefers-reduced-motion:
reduce`. The `motion.tsx` helper does this automatically — never write
`animate-[...]` Tailwind utilities that bypass it.

## 7. Spacing rhythm

Base unit: 4px (`gap-1`). All spacing uses Tailwind's spacing scale:
- `gap-1` (4px) — within a tight cluster (icon + label)
- `gap-2` (8px) — within a row of related items
- `gap-4` (16px) — between cards in a section
- `gap-6` (24px) — between sections
- `gap-8` (32px) — between major page regions

**No `gap-3`, `gap-5`, `gap-7`** — they break the rhythm. If you find
yourself reaching for one, the layout is probably wrong.

## 8. Density modes

Nashrino ships one density (comfortable). A "compact" mode is on the roadmap
but until then:
- Table rows: `h-12` minimum (touch-friendly)
- List items: `py-3` minimum
- Touch targets: 44×44px minimum (mobile)
