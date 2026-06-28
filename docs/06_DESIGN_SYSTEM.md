# 06 — Design System & UX Specification

> **Purpose**: The visual and interaction language of Nashrino. This is the contract
> between design and engineering — every screen conforms to the tokens, components, and
> patterns here. Grounded in the existing `src/app/globals.css` token system and the
> shadcn/ui component library already in the prototype.

## Table of Contents

1. [Design Principles](#1-design-principles)
2. [Foundations: Color, Type, Spacing, Radius, Shadow, Motion](#2-foundations)
3. [RTL & Persian-First Rules (the moat)](#3-rtl--persian-first-rules-the-moat)
4. [Jalali Calendar Patterns](#4-jalali-calendar-patterns)
5. [Component Library](#5-component-library)
6. [Layout & App Shell](#6-layout--app-shell)
7. [View Specifications (per nav area)](#7-view-specifications)
8. [Interaction Patterns](#8-interaction-patterns)
9. [Accessibility (WCAG 2.1 AA)](#9-accessibility-wcag-21-aa)
10. [Responsive Breakpoints](#10-responsive-breakpoints)
11. [Content & Voice (Persian UX writing)](#11-content--voice-persian-ux-writing)
12. [Iconography](#12-iconography)

---

## 1. Design Principles

1. **Persian-first, always.** RTL is not a translation of an LTR layout — it is the
   default. Vazirmatn is the voice. Persian digits are the norm.
2. **Calm density.** A social ops tool is data-dense; the design keeps it legible
   through clear hierarchy, generous whitespace at the panel level, and disciplined
   use of color for status (not decoration).
3. **Status as color.** Color carries meaning (success/warning/danger/info + platform
   identity). Never use color decoratively where it could be confused with status.
4. **Glass with structure.** The Nashrino aesthetic uses translucent panels
   (`backdrop-blur` + low-opacity fills) over an ambient mesh background — modern but
   never at the cost of legibility. Text contrast stays AA.
5. **Motion is feedback, not theatre.** Subtle Framer Motion transitions signal state
   change (page enter, hover, focus, job status). Respect `prefers-reduced-motion`.
6. **One source of truth.** The `--n-*` / `app-*` tokens in `globals.css` are the only
   allowed color/spacing/radius source. No hardcoded hex outside the documented
   media-editor exception.

---

## 2. Foundations

### 2.1 Color tokens (from `globals.css`)

The token system maps semantic names to raw OKLCH/RGB values, with light + dark
variants. **Use semantic names, never raw values.**

| Token                                        | Light              | Dark                 | Use                         |
| -------------------------------------------- | ------------------ | -------------------- | --------------------------- |
| `--n-canvas` / `bg-canvas`                   | near-white         | deep slate           | page background             |
| `--n-canvas-elevated` / `bg-canvas-elevated` | white              | elevated slate       | raised surfaces             |
| `--n-text-primary` / `text-ink-primary`      | slate-900 95%      | near-white           | headings, primary text      |
| `--n-text-secondary` / `text-ink-secondary`  | slate-800 68%      | slate-300            | body text                   |
| `--n-text-tertiary` / `text-ink-tertiary`    | slate-700 48%      | slate-400            | captions, meta              |
| `--n-text-disabled` / `text-ink-disabled`    | slate-600 32%      | slate-500            | disabled                    |
| `--n-accent` / `bg-accent`                   | OKLCH blue-violet  | brighter blue-violet | primary actions, active nav |
| `--n-accent-hover`                           | darker             | —                    | hover                       |
| `--n-accent-soft`                            | low-opacity accent | —                    | subtle fills, selected bg   |
| `--n-success`                                | teal-green         | —                    | success states              |
| `--n-warning`                                | amber              | —                    | warning states              |
| `--n-danger`                                 | red                | —                    | destructive, error          |
| `--n-info`                                   | blue               | —                    | informational               |
| `--n-panel-bg` / `bg-card`                   | white 86%          | elevated             | card/panel fill             |
| `--n-panel-divider` / `border-border`        | slate 7.5%         | —                    | dividers                    |

**Status badge palette** (consistent across the app):

- Success: `text-emerald-700 bg-emerald-50 border-emerald-200`
- Warning: `text-amber-600/700 bg-amber-50 border-amber-200`
- Danger: `text-rose-600/700 bg-rose-50 border-rose-200`
- Info: `text-blue-600 bg-blue-50 border-blue-200`
- Neutral: `text-slate-600 bg-slate-50 border-slate-200`

**Platform identity colors** (consistent dots/badges):

- Instagram: pink (`bg-pink-400`, badge `text-pink-600 bg-pink-50 border-pink-200`, label "IG")
- Telegram: sky (`bg-sky-400`, label "TG")
- LinkedIn: blue (`bg-blue-500`, label "LI")
- Rubika: purple (`bg-purple-400`, label "روبیکا")

### 2.2 Typography

- **Font**: Vazirmatn (loaded via `next/font/google`, `--font-sans`), subsets `arabic` +
  `latin`, `display: swap`.
- **Scale** (Persian UI sizes):
  - Display/heading: `text-xl font-bold` (page titles)
  - Section: `text-base font-semibold`
  - Body: `text-sm` (default)
  - Caption/meta: `text-[13px]` / `text-[10px]` (badges)
  - Numeric KPIs: large, `font-[800]`, Persian digits
- **Weight**: 400/500/600/700/800/900 used deliberately; 700+ for emphasis.
- **Line-height**: tight on headings (leading-tight), relaxed on body.
- **Numerals**: always Persian digits in the UI (via `toPersianDigits`); ASCII digits
  only inside code/identifiers/URLs.

### 2.3 Spacing & layout

- Shell gutter: `clamp(12px, 1.35vw, 24px)`; gap: `clamp(12px, 1vw, 18px)`.
- Sidebar width: `288px` expanded, `88px` compact (P3).
- Content max-width: `1600px` (dashboard), `1800px` stage max.
- Panel padding: `p-4` (compact) / `p-6` (default); gap `gap-4` / `gap-5`.
- Card grid: 12-col on `lg`, stacked on mobile.

### 2.4 Radius

- `--radius-panel: 1.75rem` (panels), `--radius-section: 1.25rem`,
  `--radius-rail: 1.125rem` (nav items), `--radius-control: 1rem` (buttons/inputs),
  `--radius-small: 0.75rem`.

### 2.5 Shadow

- `--shadow-panel`, `--shadow-floating`, `--shadow-control` — soft, layered (not
  harsh). Translucent panels rely on blur + low-opacity fill more than shadow.

### 2.6 Motion

- Easing: `--ease-fluid: cubic-bezier(0.22, 1, 0.36, 1)` (primary),
  `--ease-snappy: cubic-bezier(0.2, 0.8, 0.2, 1)`.
- Page transition: opacity 0→1, y 20→0, 400ms fluid (already in `secondary-views.tsx`).
- Hover/focus: 200ms color/transform transitions.
- `prefers-reduced-motion`: disable all non-essential motion.

### 2.7 Ambient background

- The app shell renders an ambient mesh (`AmbientMesh` component): soft colored blobs
  (`--n-blob-blue/violet/mint/rose`) over the canvas, with translucent panels floating
  above via `backdrop-blur-[28px] saturate-[1.2]`. This is the signature Nashrino look.

---

## 3. RTL & Persian-First Rules (the moat)

This section is non-negotiable — it is the core differentiator (see
[01 §6 Gap 1](./01_BENCHMARK_ANALYSIS.md#6-strategic-gaps-nashrino-will-exploit)).

### 3.1 Root setup

- `<html lang="fa" dir="rtl">` (already in `layout.tsx`).
- All layouts use logical properties (`ms-`/`me-`/`ps-`/`pe-`, `start`/`end`) — never
  `ml-/mr-/pl-/pr-` which break in RTL.
- Flexbox/Grid mirror automatically in RTL; verify icons and directional affordances
  (chevrons, back/forward) mirror semantically.

### 3.2 Bidirectional text

- The composer's caption editor must handle mixed Persian/English/URLs/@handles with
  correct cursor movement, selection, and paragraph direction (Unicode bidi algorithm).
- Insert directional marks around inserted variables/URLs where needed.
- Hashtag input: ASCII `#` + Persian/latin text; render left-to-right within the
  otherwise RTL line.

### 3.3 Numbers & dates

- All displayed numbers → Persian digits (`toPersianDigits`).
- All dates → Jalali (see §4).
- Counts in badges, KPIs, progress %, table cells — all Persian digits.

### 3.4 Iconography mirroring

- Directional icons (arrow back/forward, chevron, send) mirror in RTL.
- Non-directional icons (settings, search, bell) do not mirror.
- Use Lucide's natural mirroring via `dir` awareness; audit each.

### 3.5 Focus order

- Tab order follows visual RTL reading order (top-right → bottom-left).
- Focus rings appear on the correct side; `focus-visible:ring-2`.

### 3.6 Punctuation

- Use Persian punctuation in Persian copy: ، (comma) ؛ (semicolon) ؟ (question) ٪
  (percent). Avoid mixing English commas in Persian sentences.

### 3.7 Token audit gate

- CI runs a token audit (`npm run token:audit`) that fails on hardcoded colors outside
  the documented exception (`media-image-editor.tsx` allowed for on-canvas pixel work).

---

## 4. Jalali Calendar Patterns

### 4.1 Calendar primitives

- `lib/jalali.ts`: `gregorianToJalali`, `jalaliToGregorian`, month names
  (فروردین…اسفند), weekday names (شنبه…جمعه — **week starts Saturday**).
- Iranian holiday data (official + common observances) overlaid on the calendar.

### 4.2 Rendering

- Month grid: 7 columns, **Saturday first**; weekday headers in Persian; Persian-digit
  day numbers; today highlighted; holidays marked (red dot or tinted cell).
- Work-week shading: Saturday–Wednesday default working; Thursday/Friday (weekend)
  lightly shaded.
- Week/Day views: Sat-first week; day timeline in local time (Asia/Tehran default).
- Date pickers: dropdown year/month (Jalali year + month), day grid; Persian digits.

### 4.3 Date axes on charts

- Recharts `XAxis` formatted with Jalali short date (`۱۴۰۴/۰۳/۱۵` or `۱۵ خرداد`).
- Tooltip shows full Jalali date + weekday.

### 4.4 Scheduling semantics

- All `scheduled_at` stored as UTC timestamp; rendered/edited in workspace timezone
  (default Asia/Tehran) via Jalali picker; conversion happens at the API boundary.

---

## 5. Component Library

### 5.1 Base: shadcn/ui (New York style)

The prototype already includes the full shadcn/ui set in `src/components/ui/` (button,
card, dialog, sheet, tabs, table, select, command, popover, etc.). **Use these; do not
rebuild.** Customize via tokens, not by forking.

### 5.2 Nashrino-specific components

| Component                       | Location                 | Notes                                                                              |
| ------------------------------- | ------------------------ | ---------------------------------------------------------------------------------- |
| `AppShell`                      | `shell/app-shell.tsx`    | Sidebar + content + ambient mesh; sticky footer behavior.                          |
| `Sidebar`                       | `shell/sidebar.tsx`      | 10-item nav, theme toggle (روشن/تاریک), user profile, brand header.                |
| `CommandBar`                    | `shell/command-bar.tsx`  | Desktop global search/quick-actions (cmd+k).                                       |
| `AmbientMesh`                   | `shell/ambient-mesh.tsx` | Background blobs.                                                                  |
| `OperationalSummary`            | `dashboard/`             | Dashboard top strip.                                                               |
| `PublishingPulse`               | `dashboard/`             | Live jobs list with progress.                                                      |
| `ActionCenter`                  | `dashboard/`             | Critical action items.                                                             |
| `ExecutiveMetrics`              | `dashboard/`             | KPI cards w/ sparklines.                                                           |
| `CampaignsPanel`                | `dashboard/`             | Campaign health list.                                                              |
| `PlatformsPanel`                | `dashboard/`             | Channel status.                                                                    |
| `StatusBadge`                   | (shared)                 | published/draft/scheduled/review/confirmed/pending/ready/high/medium/low variants. |
| `PlatformBadge` / `PlatformDot` | (shared)                 | Per-platform identity.                                                             |
| `SectionTitle`                  | (shared)                 | Icon + title + optional badge.                                                     |

### 5.3 Component conventions

- **Buttons**: `bg-accent text-white` primary; `bg-accent-soft text-accent` secondary;
  outline/ghost variants for tertiary. Min height 40px (mobile 44px touch target).
- **Cards**: `bg-card` (`--n-panel-bg`) + `border` (`--n-panel-divider`) +
  `shadow-panel` + `rounded-[--radius-panel]`; padding `p-4`/`p-6`.
- **Tables**: zebra optional; sticky header on long lists; `max-h-96 overflow-y-auto`
  with custom scrollbar for long lists.
- **Forms**: labels above inputs; helper text below; error text in `text-danger`;
  inline validation on blur.
- **Dialogs/Sheets**: RTL-aware; close button top-left (mirrored); focus trap.

### 5.4 Long-list handling

- Lists > ~10 rows: `max-h-96 overflow-y-auto` + custom thin scrollbar
  (`no-scrollbar` utility or styled `::-webkit-scrollbar`).
- Tables: virtualization for >100 rows (TanStack Virtual) — P2.

---

## 6. Layout & App Shell

### 6.1 Root structure

```
<body min-h-dvh overflow-hidden>  (shell handles internal scroll)
  <ThemeProvider>
    <AppShell>                     // flex; sidebar + main
      <Sidebar />                  // 288px, RTL right-side
      <main flex-1 overflow-y-auto>
        <header CommandBar />      // desktop only, sticky top
        <content />                // max-w-[1600px] mx-auto, p-4/6
        <footer mt-auto />         // sticky-to-bottom when short
      </main>
    </AppShell>
  </ThemeProvider>
```

### 6.2 Sticky footer rule (mandatory)

- Root wrapper: `min-h-screen flex flex-col` (or `min-h-dvh`).
- `main` is `flex-1`; `footer` uses `mt-auto`.
- On short pages, footer sits at viewport bottom; on long pages, it pushes down
  naturally — never overlays content.

### 6.3 Mobile

- Sidebar collapses to a drawer (`isMobileMenuOpen`); hamburger in a top bar.
- Bottom tab bar optional (P3) for the 5 most-used views.
- Touch targets ≥ 44px.

---

## 7. View Specifications

Each view's detailed design lives in Figma; the spec here captures the structure,
data, and states. (The prototype already implements these against fixtures; the work is
to wire to the backend.)

### 7.1 Dashboard (`/`)

- **Command bar** (desktop, top): global search + quick actions.
- **Operational summary**: health + counts (today/queued/failed/pending approval/inbox
  unread/SLA risk).
- **Publishing pulse** (8/12 col) + **Action center** (4/12 col), 500px tall desktop;
  on mobile, action center moves above pulse (400px).
- **Executive metrics**: 4 KPI cards with sparklines + trend.
- **Campaigns panel** (8/12) + **Platforms panel** (4/12), 460px.
- Grid: `grid-cols-1 lg:grid-cols-12 gap-4 md:gap-5`.
- Loading: skeletons matching layout; error: empty-state with retry.

### 7.2 Compose (`/compose`)

- Step rail (right in RTL): محتوا → رسانه → پلتفرم → زمان‌بندی.
- Two-column: rail (1/3) + step content (2/3); live preview pinned.
- Per-platform preview cards (IG feed/story, TG channel, Rubika, LI).
- Readiness issues panel; schedule actions (Post now / Schedule / Queue / Submit for
  approval).

### 7.3 Calendar (`/calendar`)

- View switcher: ماه / هفته / روز / برنامه (agenda); channel swimlane toggle.
- Month grid (Jalali) with chips; drag-reschedule; queue sub-tab.
- Click empty slot → quick-create sheet.

### 7.4 Campaigns (`/campaigns`)

- Portfolio list (cards) with health; click → command center.
- Command center tabs: نمای کلی / تقویم / پست‌ها / رسانه / گزارش.

### 7.5 Content (`/content`)

- Filter bar (status/campaign/platform/tag) + search; list/grid toggle.
- Item row: title, status badge, platforms, campaign, updated; actions menu.

### 7.6 Media (`/media`)

- Folder sidebar + tag filter; grid of thumbnails; upload FAB.
- Click → detail drawer; "ویرایش" opens the Persian-first image editor (full-screen).

### 7.7 Inbox (`/inbox`) — P2

- Three-pane: list (filterable) | thread | detail/compose.
- Automation events log tab; SLA timers; saved-replies popover.

### 7.8 Analytics (`/analytics`)

- Period filter; KPI row; charts (Recharts) with Jalali axis; platform/campaign
  breakdown; logs sub-tab (publish_attempts table).

### 7.9 Channels (`/channels`)

- Per-platform sections; connect/disconnect; health; breadcrumbs to detail.

### 7.10 Settings (`/store`)

- Tabs: نمای کلی / برند / تیم / صورت‌گیری (billing) / اعلان‌ها.
- Brand kit form (colors, voice, CTA, hashtags, footer, guidelines); live preview.

---

## 8. Interaction Patterns

### 8.1 Loading states

- Skeletons matching final layout (not generic spinners) for above-the-fold.
- Inline spinners for button actions; disable button + show spinner on submit.
- Optimistic updates for low-risk actions (e.g., mark read) with rollback on error.

### 8.2 Empty states

- Every list has an empty state: icon + Persian copy + primary CTA.
- Example (content library empty): "هنوز محتوایی نساخته‌اید" + "ساخت محتوای جدید".

### 8.3 Error states

- Inline (form): red helper text + icon.
- Page/route: friendly error card with "تلاش مجدد" + error code for support.
- API errors: toast (sonner) in Persian; never raw stack traces.

### 8.4 Toasts (sonner)

- Success (green), error (red), info (blue); Persian copy; auto-dismiss 4s; action
  button where relevant (e.g., "بررسی" on publish-failed).

### 8.5 Confirmations

- Destructive actions (delete, disconnect): `AlertDialog` with clear Persian warning +
  destructive button (`bg-danger text-white`).

### 8.6 Drag-and-drop

- Calendar reschedule: `@dnd-kit` (already a dependency); visual drop indicator;
  confirm-on-drop for cross-day moves.

### 8.7 Command palette (cmd+k)

- `CommandBar` opens a `cmdk` palette: search content/media/campaigns, quick actions
  (compose, go to view, connect channel). RTL-aware.

### 8.8 Realtime feedback

- Job status changes animate (progress bar fill, status badge transition) without
  refresh via WebSocket events.

---

## 9. Accessibility (WCAG 2.1 AA)

- **Semantic HTML**: `main`, `header`, `nav`, `section`, `article`, `footer`.
- **ARIA**: roles/labels on interactive non-native widgets; `aria-live` for realtime
  updates (job status, toasts).
- **Keyboard**: all actions reachable; visible focus (`focus-visible:ring-2`); logical
  RTL tab order; skip-to-content link.
- **Screen readers**: `sr-only` for icon-only buttons' labels; tested with NVDA +
  VoiceOver on key flows (login, compose, calendar, inbox).
- **Contrast**: all text ≥ 4.5:1 (3:1 large text); token combinations audited.
- **Motion**: `prefers-reduced-motion` disables non-essential animation.
- **Forms**: label association; error association (`aria-describedby`); instructions
  before the field.
- **Tables**: `<th scope>`; caption where helpful.
- **Color not sole signal**: status always has text/icon in addition to color.

---

## 10. Responsive Breakpoints

Mobile-first; Tailwind prefixes.

| Breakpoint | Width   | Layout behavior                                                    |
| ---------- | ------- | ------------------------------------------------------------------ |
| base       | <640px  | Single column; sidebar drawer; stacked panels; 44px touch targets. |
| `sm:`      | ≥640px  | 2-col grids where helpful.                                         |
| `md:`      | ≥768px  | Tablet; 2–3 col; sidebar still drawer.                             |
| `lg:`      | ≥1024px | Desktop; sidebar visible; 12-col grids; command bar visible.       |
| `xl:`      | ≥1280px | Expanded density; side panels.                                     |
| `2xl:`     | ≥1536px | Max stage width 1800px.                                            |

**Mandatory**: every view tested at 360px, 768px, 1280px+ in E2E visual checks.

---

## 11. Content & Voice (Persian UX writing)

- **Tone**: professional, warm, concise. Persian (Farsi), not formal/literary —
  business-casual.
- **Pronouns**: informal "شما" (polite). Avoid "تو".
- **Action verbs first**: "ساخت محتوا", "زمان‌بندی انتشار", "اتصال اینستاگرام".
- **Status copy** (consistent glossary):
  - pending → "در انتظار"
  - processing → "در حال پردازش"
  - live → "در حال انتشار"
  - success → "منتشر شد"
  - failed → "ناموفق"
  - action needed → "نیازمند اقدام"
  - ready → "آماده انتشار"
  - draft → "پیش‌نویس"
  - review → "در حال بررسی"
  - approved → "تأیید شد"
- **Error messages**: actionable + Persian. "اتصال اینستاگرام قطع شده. دوباره
  متصل کنید." not "Error 401".
- **Empty states**: encouraging + CTA.
- **Dates**: "امروز، ۱۰:۳۰" / "دیروز، ۱۸:۰۰" / "فردا، ۰۹:۰۰" / full Jalali for older.

---

## 12. Iconography

- **Library**: Lucide (`lucide-react`), already in the prototype.
- **Size**: 18px (nav), 16px (inline), 20–24px (section titles), 5–8px (status dots).
- **Stroke**: 2 (default); 1.5 for dense UI.
- **Directional mirroring**: audit per icon in RTL (e.g., `ChevronDown` stays; `ArrowRight`
  for "back" should point right in RTL → use `ArrowLeft` semantically and let RTL mirror).
- **Platform marks**: use a consistent badge/dot (§2.1) rather than raw logos for
  trademark safety; real logos only in the Channels hub where explicit.

---

## Appendix A — Token quick-reference (from `globals.css`)

```css
:root {
  /* light */
  --n-canvas: oklch(0.976 0.008 255);
  --n-accent: oklch(0.61 0.19 263);
  --n-success: oklch(0.62 0.17 153);
  --n-warning: oklch(0.72 0.16 76);
  --n-danger: oklch(0.61 0.22 27);
  --n-info: oklch(0.64 0.16 240);
  --radius-panel: 1.75rem;
  --radius-control: 1rem;
  --shell-gutter: clamp(12px, 1.35vw, 24px);
  --sidebar-expanded: 288px;
  --ease-fluid: cubic-bezier(0.22, 1, 0.36, 1);
}
.dark {
  /* dark variants — deeper canvas, brighter accent */
}
```

Map: `bg-canvas`, `bg-canvas-elevated`, `text-ink-primary/secondary/tertiary`,
`bg-accent`, `text-accent`, `bg-accent-soft`, `bg-success/warning/danger/info`,
`bg-card`, `border-border`, `shadow-panel`.

## Appendix B — Do / Don't

| Do                                                           | Don't                                        |
| ------------------------------------------------------------ | -------------------------------------------- |
| Use `ms-`/`me-`/`ps-`/`pe-`                                  | Use `ml-`/`mr-`/`pl-`/`pr-`                  |
| Render all numbers in Persian digits                         | Show "142.5K" raw in Persian UI              |
| Use Jalali dates everywhere                                  | Show Gregorian dates to Persian users        |
| Use semantic color tokens                                    | Hardcode hex (except media-editor exception) |
| Use shadcn/ui components                                     | Rebuild basic components from scratch        |
| Keep panels `p-4`/`p-6`, gaps `gap-4`/`gap-5`                | Inconsistent padding/spacing                 |
| `max-h-96 overflow-y-auto` + custom scrollbar for long lists | Let lists grow the page unbounded            |
| Sticky footer (`mt-auto`) on short pages                     | Floating/overlapping footer                  |

---

_End of design system. Component-level API docs live with each component in code; this
document is the contract they conform to._
