# World-Class Design Systems Research — Nashrino Refactor Brief

**Compiled:** RESEARCH-1 (Design Systems Research Agent)
**Scope:** Linear · Vercel/Geist · Stripe Dashboard · Apple iOS 26 Liquid Glass · visionOS/macOS Materials · shadcn/ui · Dashboard UX patterns · Persian RTL
**Purpose:** Provide specific, actionable, numeric guidance (exact px, OKLCH, shadow definitions, motion curves) for the refactor of Nashrino — a Persian RTL social media management dashboard (Instagram, Telegram, LinkedIn, Rubika, Eitaa) built on Next.js 15 + Tailwind v4 with an iOS 26 "Liquid Glass" aesthetic.

---

## Executive Summary — The 10 Most Important Principles for a Production-Grade Glass Dashboard

Synthesizing what Linear, Vercel/Geist, Stripe, and Apple all do — and what separates world-class from amateur glass UIs:

1. **Glass is a navigation layer, never a content layer.** Apple's HIG is explicit: *"Liquid Glass is exclusively for the navigation layer that floats above app content. Never apply to content itself (lists, tables, media)."* Content sits on opaque surfaces; only sidebars, toolbars, command bars, popovers, sheets, and floating controls get glass. **Nashrino rule:** Sidebar, top command bar, command palette, floating compose button, popover menus = glass. Analytics cards, content lists, tables, the calendar grid, the inbox feed = solid surfaces.

2. **Restrained accent, monochrome canvas.** Linear, Stripe, and Vercel all converge on this: one (1) chromatic accent on a neutral canvas. Linear uses lavender-blue `#5e6ad2` scarcely (brand mark, focus, primary CTA only). Stripe uses electric violet `#635BFF` as punctuation. Vercel blue `#0070f3` appears only on primary actions and links. **Nashrino rule:** Pick one violet accent (recommend `oklch(0.62 0.18 280)` — a perceptual-uniform match of Linear lavender + Stripe electric violet). Never use it decoratively.

3. **Perceptually uniform color (OKLCH/LCH), not HSL.** Linear's redesign moved to LCH for theme generation because *"a red and a yellow color with lightness 50 will appear roughly equally light to the human eye."* Stripe rebuilt their color system on CIELAB for the same reason. **Nashrino rule:** All color tokens in `oklch()`; the system derives 11-step light/dark ramps from 3 inputs: `--base`, `--accent`, `--contrast`. This is exactly what Linear shipped.

4. **Tabular numerics everywhere numbers matter.** Geist ships `text-label-13` with `Tabular` modifier as a *first-class* type token. Linear's `num-tabular` style is on every issue count, every metric. Stripe's dashboard tables use `font-variant-numeric: tabular-nums` for every currency cell. **Nashrino rule:** Every metric number, every follower count, every engagement %, every date — `font-variant-numeric: tabular-nums`. Add a `num-tabular` utility. For Persian digits, Vazirmatn supports `tnum` OpenType feature.

5. **Layered hairline borders, not heavy shadows.** Linear achieves depth without shadows on dark — *"Linear's depth is carried by surface ladder + hairline borders. The brand resists drop shadows on dark almost entirely."* Their shadow token is two ultra-light layers: `lch(0 0 0 / 0.02) 0px 3px 6px -2px, lch(0 0 0 / 0.04) 0px 1px 1px 0px`. **Nashrino rule:** Drop the heavy `24px/48px ambient floor` shadows. Use a 4-tier surface ladder + 1px hairlines. Reserve shadow only for floating layers (popovers, command palette, dragged cards).

6. **Animate only `transform` and `opacity`. Never `width/height/margin/padding`.** Linear's animation codebase is rigid: only composite properties (`transform`, `opacity`) and occasionally `background-color`/`border-color`. Layout-triggering properties are forbidden. Hover transitions are 0.10–0.15s. Status popovers scale out of their origin pill (spatial work, not decoration). **Nashrino rule:** No `transition: all 0.2s` ever. Specifically: `--motion-quick: 100ms`, `--motion-regular: 150ms`, `--motion-slow: 250ms` with `cubic-bezier(0.4, 0, 0.2, 1)` (Linear's regular curve).

7. **Optimistic UI + local-first data = perceived instant.** Linear's secret to "fast and crisp" is engineering, not design: the database lives in IndexedDB, mutations apply locally before the network, deltas reconcile via WebSocket. Even auth is optimistic — "do we have anything to show you" not "do you have a valid session." **Nashrino rule:** Use React Query / SWR with optimistic updates for every mutation (publish, schedule, comment, approve). Skeleton screens on first load only — after that, show the last-known data and update in place. Never show a spinner for a mutation that should be instant.

8. **Keyboard-first; command palette as primary navigation.** Linear: every action has a shortcut, single letters edit focused items, two-letter combos navigate, ⌘K searches the local MobX pool (not the server). Raycast built an entire product on this. **Nashrino rule:** ⌘K opens a command palette that fuzzy-searches across: posts (draft/scheduled/published), platforms, conversations, analytics views, settings, and 100% of in-app actions. Show keyboard hints on every hover state. Make `j/k` navigate rows, `Enter` open, `Esc` close, `?` show all shortcuts.

9. **Empty states are first-class citizens with concrete CTAs.** Vercel/Geist's empty state spec is rigorous: 5 variants (Blank Slate, Informational, Educational, Guide, No-Results, Error, Permission), title is Title Case, description adds new information (doesn't restate), CTA is "Verb + Noun" (never "Get Started" / "Continue" / "OK"), max 1 primary CTA, aria-live on async filter changes. **Nashrino rule:** Build 7 distinct empty states: "No posts yet — Create your first post", "No scheduled posts — Schedule one", "Inbox zero — You're all caught up", "No results for '{query}'", "Connect a platform to see analytics", "Failed to load — Try again (with copyable request ID)", "Upgrade to Pro for this feature".

10. **Right-to-left is a layout rewrite, not a `dir="rtl"` flip.** RTL best practice: numbers in tables right-align (mirrors LTR behavior naturally when `dir="rtl"` is set on the table); icons flip if they imply direction (arrow back/forward), don't flip if they're symbolic (settings gear, search); Persian numerals (۰۱۲۳۴۵۶۷۸۹) are optional — many modern Persian apps use Western digits for analytics because they're easier to compare at a glance; the calendar must be Jalali (Shamsi) with Persian month names. **Nashrino rule:** `dir="rtl"` on `<html>`, Vazirmatn font for everything, dual calendar support (Jalali primary, Gregorian toggle), Western digits for analytics/metrics (better for tabular comparison), Persian digits for prose/content counts.

---

## 1. Linear Deep Dive

Sources: linear.app DESIGN.md (VoltAgent/awesome-design-md), "How we redesigned the Linear UI (part Ⅱ)" blog, FontOfWeb extracted tokens, "How's Linear so fast?" breakdown, LogRocket analysis.

### 1.1 Color System — LCH-based, 3 inputs → 98 derived tokens

Linear's 2024 redesign (Karri Saarinen, Yann-Edern Gillet, Andreas Eldh) is the canonical reference for a modern dark dashboard. Key decision: **the theme generation system uses LCH color space and defines only 3 variables per theme: `base color`, `accent color`, `contrast`**. From those 3, 98 surface/text/icon/control aliases are generated algorithmically. This is why Linear's themes look consistently good — LCH is perceptually uniform, so a "lightness 50" yellow and a "lightness 50" blue appear equally bright to the eye.

#### Linear's color tokens (extracted from linear.app)

| Token | Value | Role |
|---|---|---|
| `colors.canvas` | `#010102` | Default page background — near-pure black with faint blue tint |
| `colors.surface-1` | (one step up) | Feature cards, pricing cards, product screenshot panels |
| `colors.surface-2` | (two steps up) | Featured pricing card, hovered cards |
| `colors.surface-3` | (three steps up) | Sub-nav, line-tertiary backgrounds |
| `colors.surface-4` | (four steps up) | bg-level-3, deepest lifted surface |
| `colors.hairline` | `#23252a` | 1px borders on cards and dividers |
| `colors.hairline-strong` | (slightly lighter) | Stronger 1px borders — input focus rings |
| `colors.hairline-tertiary` | (lighter still) | Tertiary borders for nested surfaces |
| `colors.ink` | `#f7f8f8` | All headlines and emphasized body type |
| `colors.ink-muted` | `#d0d6e0` | Secondary type — meta info on hero panels |
| `colors.ink-subtle` | `#8a8f98` | Tertiary type — deselected tabs, footer columns |
| `colors.ink-tertiary` | `#62666d` | Quaternary — disabled, footnotes |
| `colors.primary` | `#5e6ad2` | Lavender-Blue — primary CTA, brand mark, link emphasis |
| `colors.primary-hover` | `#828fff` | Lighter lavender — hovered primary CTA |
| `colors.primary-focus` | `#5e69d1` | Focus-ring tint — focused inputs/buttons |
| `colors.brand-secure` | `#7a7fad` | Muted lavender-gray — Linear Security surfaces |
| `colors.semantic-success` | `#27a644` | Status pills, success indicators — *the only semantic color* |
| `colors.semantic-overlay` | pure black `#000` | Modal scrim |

**Linear's extracted slate ramp (with contrast ratios on white):**

```
slate-50  #e7eaef  17.4:1
slate-100 #d0d6e0  14.4:1
slate-200 #b8bec7  11.2:1
slate-300 #a1a6af  8.6:1
slate-400 #8a8f98  3.3:1   ← ink-subtle
slate-500 #62666d  5.8:1   ← ink-tertiary
slate-600 #474a4f  8.9:1
slate-700 #2d2f33  13.4:1  ← hairline-strong zone
slate-800 #161719  17.9:1  ← hairline zone
slate-900 #030404  20.6:1
slate-950 #000001  21.0:1  ← canvas
```

**Key Linear color principle:** *"The dark canvas IS the whitespace. Sections separate by lift onto surface-1 panels, not by gaps in white."* No second chromatic color. No atmospheric gradients. No spotlight cards.

### 1.2 Typography — Display vs Text split, aggressive negative tracking

Linear uses three custom typefaces (not publicly distributed): **Linear Display** (display sans, fallback SF Pro Display → `-apple-system` → `system-ui` → `Segoe UI` → `Roboto`), **Linear Text** (text sans tuned for body), and **Linear Mono** (for code in screenshots). Recommended free substitutes: **Inter** (weights 500/600/700) for both Display and Text, **JetBrains Mono** or **Geist Mono** for mono.

**Type hierarchy (exact values):**

| Token | Size | Weight | Line-height | Letter-spacing | Use |
|---|---|---|---|---|---|
| `display-xl` | 80px | 600 | 1.05 | **-3.0px** | Largest hero headline |
| `display-lg` | 56px | 600 | 1.10 | -1.8px | Section opener headlines |
| `display-md` | 40px | 600 | 1.15 | -1.0px | Sub-section headlines |
| `headline` | 28px | 600 | 1.20 | -0.6px | Pricing tier titles |
| `card-title` | 22px | 500 | 1.25 | -0.4px | Feature card title |
| `subhead` | 20px | 400 | 1.40 | -0.2px | Lead body, intro paragraphs |
| `body-lg` | 18px | 400 | 1.50 | -0.1px | Hero subhead |
| `body` | 16px | 400 | 1.50 | -0.05px | Default body |
| `body-sm` | 14px | 400 | 1.50 | 0 | Card body, footer columns |
| `caption` | 12px | 400 | 1.40 | 0 | Captions, meta, status |
| `button` | 14px | 500 | 1.20 | 0 | All button labels |
| `eyebrow` | 13px | 500 | 1.30 | **+0.4px** | Section eyebrow (positive tracking marks taxonomy) |
| `mono` | 13px | 400 | 1.50 | 0 | Linear Mono for code/IDs |

**Linear typography principles:**
- **Aggressive negative tracking on display**: `-3.0px` at 80px is ≈ 4% of size. Body holds at `-0.05px`. This is the *single most copied Linear trait* — it's what makes "Linear-style" feel tight.
- **Single voice from display to body** — Display at 600 → body at 400, same family, narrower weights. No serif/sans mix.
- **Eyebrow uses positive tracking (+0.4px)** — contrast against negative-tracked display marks the eyebrow as taxonomy.
- **Mono only in code contexts.** Never on marketing chrome.
- 2024 redesign addition: **Inter Display** for headings (more expression), regular **Inter** for body. Linear's actual in-app CSS: `font-family: "Inter Variable", Arial, Helvetica, sans-serif` with `font-weight: 100 900` and `font-display: swap`. Variable font = single woff2 covering full weight axis.

### 1.3 Spacing System — 4px base, 8 named tokens

Linear's spacing is the cleanest in the industry:

| Token | Value | Use |
|---|---|---|
| `spacing.xxs` | 4px | Tight icon-text gaps |
| `spacing.xs` | 8px | Inline spacing, button icon-text |
| `spacing.sm` | 12px | Form input padding (vertical) |
| `spacing.md` | 16px | Default content padding |
| `spacing.lg` | 24px | Card interior padding (feature/pricing), content block gaps |
| `spacing.xl` | 32px | Testimonial card padding |
| `spacing.xxl` | 48px | CTA banner padding |
| `spacing.section` | 96px | Between sections |

**Specific component paddings (Linear):**
- Pill button: **8px vertical × 14px horizontal** (compact)
- Form input: **8px vertical × 12px horizontal**
- Max content width: **~1280px**
- Card grids: **3-up desktop / 2-up tablet / 1-up mobile**

### 1.4 Elevation & Shadow — Surface ladder, not shadows

This is the part most amateur Linear-clones miss. Linear's depth system has **5 levels, only one of which uses any shadow**:

| Level | Treatment | Use |
|---|---|---|
| 0 (flat) | No shadow, no border | Body type, hero text, footer |
| 1 (charcoal lift) | `surface-1` background + 1px `hairline` border | Default cards, product panels |
| 2 (surface-2 lift) | `surface-2` background + 1px `hairline-strong` border | Featured pricing card, hovered cards |
| 3 (surface-3 lift) | `surface-3` background | Sub-nav, dropdown menus |
| 4 (focus ring) | 2px `primary-focus` outline at 50% opacity | Focused input, focused button |

**Linear's actual shadow token (extracted):**
```css
--shadow-sm: lch(0 0 0 / 0.02) 0px 3px 6px -2px,
             lch(0 0 0 / 0.04) 0px 1px 1px 0px;
```

That's it. Two ultra-light layers, total opacity contribution 6%. **No 24px ambient floor, no 48px depth shadow.** The "lifted" feeling comes from the surface ladder + hairline.

**Decorative depth:** *"Subtle white edge highlight on the top edge of lifted panels — gives the dark surface a faint 'pixel rendered' feel."* This is a 1px top inner-border at `rgba(255,255,255,0.04)`.

### 1.5 Border Radius Scale

| Token | Value | Use |
|---|---|---|
| `rounded.xs` | 4px | Small chips, status badges |
| `rounded.sm` | 6px | Inline tags |
| `rounded.md` | 8px | **All buttons, form inputs** |
| `rounded.lg` | 12px | Pricing/feature/testimonial cards |
| `rounded.xl` | 16px | Product screenshot panels |
| `rounded.xxl` | 24px | Oversized CTA banners (rare) |
| `rounded.pill` | 9999px | Pricing tab toggles, status pills |
| `rounded.full` | 9999px | Avatar circles |

### 1.6 Motion Principles — 100ms / 150ms / 250ms, composite-only

Linear's CSS animation variables (extracted from their stylesheet):

```css
--speed-highlightFadeIn:  0s;
--speed-highlightFadeOut: 0.15s;
--speed-quickTransition:  0.10s;   /* hovers, color shifts */
--speed-regularTransition: 0.25s;  /* panel slides, popover open */
```

**Easing:** Linear uses standard `cubic-bezier(0.4, 0, 0.2, 1)` for most transitions (Material's "standard" curve — fast-out-slow-in). For status popovers: scales out of the origin pill (origin-anchored transform, not fade-in-from-nowhere).

**The Linear animation rules (from the "How's Linear so fast?" breakdown):**

1. **Only animate composite properties** (`transform`, `opacity`) — GPU-handled, run independent of main thread.
2. **Paint-triggering properties** (`color`, `background-color`, `border-color`, `fill`) — OK to animate, skip layout but redraw pixels.
3. **Layout-triggering properties** (`width`, `height`, `top`, `left`, `margin`, `padding`) — **NEVER animate.** They force recompute of every subsequent element on every frame.
4. **Don't write `transition: all`** — it includes layout properties by default. Always list specific properties.
5. **Motion does spatial work.** The status popover scales out of the status pill. The agent panel slides in from its toggle. Motion tells the user *where the new element came from*, rather than fading in from nowhere as decoration.
6. **Know when to hold back.** "In a tool used every day, the animations you'd love on a marketing site start to get in the way. Even a small hover delay, in the wrong place, becomes the thing the user notices." No transitions on list items — keep them snappy.

**What Linear actually animates (real example):**
```css
.row:hover {
  background-color: var(--color-bg-hover);
  transition: background-color 0.12s;
}
.icon-arrow {
  transform: translateX(0);
  transition: transform 0.15s;
}
/* ❌ What you'd write if you didn't know better */
.row:hover {
  margin-left: 2px;            /* triggers layout for every row beneath */
  transition: all 0.2s;        /* and now you're animating margin */
}
```

### 1.7 Dark Mode Treatment

Linear's dark mode is the canonical surface; light is derived. Key principle: **"Karri mostly worked with opacities of black and white during his explorations, which really helped him get results quickly and helped me understand the relationship he had in mind between the elements and their respective elevation and hierarchy."**

The LCH system means a single `contrast` variable scales automatically: "30" gives comfortable-contrast theme, "100" gives super-high-contrast accessible theme. The same `base + accent + contrast` triple generates both light and dark themes — only the inputs differ.

### 1.8 Keyboard-First UX

Linear's keyboard UX is foundational, not bolted on:

- **Every action has a shortcut.** Single letters edit the focused issue (`c` for comment, `l` for label, `a` for assignee). Two-letter combos navigate. Modifiers act globally.
- **Single characters** = most frequent actions (used most often).
- **⌘K command palette** searches the *local MobX object pool*, not the server. Issues, projects, labels, status changes, navigation, issue creation, settings, theme toggles. *"Navigation is search. Issue creation is search. Status changes are search scoped to statuses."* One primitive, used everywhere, running on data that's already in memory.
- **The right-click menu is custom-built** — context-aware, with shortcuts visible on every item.
- **Most frequent shortcuts are visible** — shown on hover, in tooltips, in the command palette. Discoverability through visibility, not a buried help page.

### 1.9 Engineering → Design Speed

Linear's "fast and crisp" feel is half engineering:

- **The database lives in the browser** (IndexedDB via `idb`, hydrated into a MobX observable pool on boot). UI reads from local, never waits for server.
- **Mutations apply locally first**, then asynchronously push to server via a transaction queue.
- **No spinners. Ever.** "UI responsiveness should not depend on network latency."
- **Optimistic auth**: The inline boot script checks `localStorage.ApplicationStore` — if present, render the full app immediately. The session cookie validates on the next WebSocket handshake; if 401, redirect to login.
- **Bundle splitting per npm package** — each `node_modules/X` gets its own vendor chunk, so bumping one dep invalidates only that chunk. They split the bundle into "hundreds of route-level chunks fetched on demand."
- **Variable Inter font, single woff2** — `font-display: swap`, `crossorigin="anonymous"` on the preload (without it the browser double-fetches).
- **Inlined app shell** in `index.html` — critical CSS for the loading screen ships inline, so the user sees a correctly-themed app shell before any bundle parses. The inline JS reads `localStorage.splashScreenConfig` and applies `--bg-sidebar-color`, `--bg-base-color`, `--bg-border-color`, `--sidebar-width`, dark mode class — all before the first network request.
- **Render first, authenticate second.** "The initial flow for Linear isn't 'do you have a valid session.' It's 'do we have anything to show you.'"
- **One delta, one cell.** Server confirms mutations via small JSON envelopes. MobX knows exactly which components depend on which fields, so a 50-issue update is 50 cell re-renders, not a list re-render.

### 1.10 Stack

- **Frontend:** React + react-dom, MobX (observable graph), TypeScript, Rolldown-Vite + plugin-react-oxc, ProseMirror + y-prosemirror, Radix UI primitives, Emotion + StyleX, Comlink (Worker RPC), idb (IndexedDB wrapper), graphql-request.
- **Backend:** Node.js + TypeScript, PostgreSQL on Cloud SQL (issues table partitioned 300 ways), Memorystore Redis, turbopuffer (vector db), Kubernetes on GCP, Cloudflare Workers (multi-region edge proxy).
- **Desktop:** Electron. **Mobile:** Swift (iOS) + Kotlin (separate full reimplementation). **Marketing:** Next.js (static), styled-components, inline SVG sprite.

---

## 2. Vercel / Geist Deep Dive

Sources: geist-ui.dev documentation, geist font page, designsystems.one breakdown, Vercel blog.

### 2.1 Geist Font — Designed for developers, Swiss-inspired

Geist emerged from Vercel's product UI work and crystallized around 2022 alongside Vercel's rebrand. Three variants:

- **Geist Mono** (first) — designed for code; prioritizes readability in coding environments.
- **Geist Sans** — expanded from mono; precision, clarity, functionality (Swiss design movement inspiration).
- **Geist Pixel** — decorative variant (geometric pixel forms).

**Cap metrics:** Cap height 710, x-height 530, descender -150 (units per em 1000). This is a *tall x-height* typeface — body text reads larger at the same px size than Inter (which has x-height ~540 but on a 2816 unit em).

**Installation (Next.js 15 / Tailwind v4):**
```js
// app/layout.js
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
// apply GeistSans.variable + GeistMono.variable on <html>
```

**font-feature-settings** support is critical — Geist Sans includes tabular numerals (`tnum`), stylistic sets, and 9 weights + 9 stylistic sets + 32 language support.

### 2.2 Geist Token Snapshot

| Token | Value | Role |
|---|---|---|
| `color-bg-default` | `#000000` | Default canvas (**dark-first**) |
| `color-text-default` | `#ededed` | Body text on dark |
| `color-accent` | `#0070f3` | **Vercel blue — used as punctuation** |
| `color-border-default` | `#333333` | Hairline border on dark surfaces |
| `font-family-sans` | Geist Sans | Default UI typography |
| `font-family-mono` | Geist Mono | Tabular numerics, code, identifiers |

**Key Geist principle: "Dark mode is treated as the canonical surface; the light theme is the alternate."** Most systems treat this the other way around.

### 2.3 Geist Typography Scale (Tailwind classes)

Geist's typography is consumed as **Tailwind utility classes that pre-set font-size + line-height + letter-spacing + font-weight** based on the Geist Core Figma system. Three categories:

**Headings:**
| Class | Size | Use |
|---|---|---|
| `text-heading-72` | 72 | Marketing heroes |
| `text-heading-64` | 64 | — |
| `text-heading-56` | 56 | — |
| `text-heading-48` | 48 | — |
| `text-heading-40` | 40 | — |
| `text-heading-32` (with Subtle) | 32 | Marketing subheadings, **dashboard headings** |
| `text-heading-24` (with Subtle) | 24 | — |
| `text-heading-20` (with Subtle) | 20 | — |
| `text-heading-16` (with Subtle) | 16 | — |
| `text-heading-14` | 14 | — |

**Buttons** (only inside `<Button>` components):
- `text-button-16` — Largest button
- `text-button-14` — Default button
- `text-button-12` — Tiny button inside input fields

**Labels** (single-line, ample line-height for highlighting + icon pairing):
- `text-label-20` — Marketing text
- `text-label-18`
- `text-label-16` (with Strong) — Used in titles to differentiate from regular
- `text-label-14` (with Strong) — **Most common text style of all. Used in many menus.**
- `text-label-14-mono` — Largest mono, to pair with >14 text
- `text-label-13` (with Strong, **Tabular**) — Secondary line next to other labels. "Tabular is used when conveying numbers for consistent spacing."
- `text-label-13-mono` — Pairs with Label 14 (smaller mono looks better in that pairing)
- `text-label-12` (with Strong, AND CAPS) — Tertiary text in busy views (Comments, Show More, **calendars**)
- `text-label-12-mono`

**Copy** (multi-line, higher line-height than Label):
- `text-copy-24` (with Strong) — Hero areas on marketing
- `text-copy-20` (with Strong) — Hero areas
- `text-copy-18` (with Strong) — Mainly marketing, big quotes
- `text-copy-16` (with Strong) — Simpler, larger views like Modals where text can breathe
- `text-copy-14` (with Strong) — **Most commonly used text style**
- `text-copy-13` — Secondary text, space-premium views
- `text-copy-13-mono` — Inline code mentions

**The Subtle / Strong modifier system:** Use `<strong>` element nested as descendant of any typography class. Strong gets the heavier weight of the pair; Subtle gets the lighter. This is a clean two-tier emphasis system that prevents weight salad.

### 2.4 Geist's Three Standout Components

1. **Command Bar** — Cross-platform command palette with keyboard-first navigation, recent items, async search. *"The reference for dev-tool UI."*
2. **Code Block** — Syntax-highlighted code with copy affordance, line numbers, language badge. *"The canonical code presentation for dev tools."*
3. **Deployment Card** — Status, commit, branch, region, timing in a dense card. *"The reference pattern for any list of long-running operations."*

### 2.5 Geist's Empty State Spec (rigorous)

Five variants with strict rules:

| Variant | When to use |
|---|---|
| **Blank Slate** | First run experience, no content yet |
| **Informational** | Alternative first-use, includes in-line CTAs and supplemental doc links |
| **Educational** | Launch a contextual onboarding flow |
| **Guide** | Starter content; user interacts with data to learn the system |
| **No-Results** | Filtered list returned zero rows |
| **Permission** | Role or tier denial (render full-page if route-level, as Note if tile-level) |
| **Error** | Failed load — pair body with copyable request ID + Try Again button |

**Content rules:**
- Title is **Title Case** (e.g., "No Logs Match Your Filter")
- Description is **sentence case** and adds *new information* instead of restating the title
- Quote a single typed query verbatim with curly quotes: `No logs match "${query}"`
- For multi-facet filters: `No {Items} Match Your Filters` and suggest widening or clearing
- Onboarding bodies name the *next action* that creates the first item: `Push to your Git repository to create your first one.`
- Tier-gated bodies: `{Feature value} with the {Plan} plan`
- **CTA labels are Title Case Verb + Noun.** Never "Get Started", "Continue", or "OK".

**Behavior rules:**
- The CTA must be a real `<Button>` or `<Link>`, not an `onClick` div, so it joins the tab order and exposes a role
- **Cap at one primary CTA**, plus one secondary when the first action could legitimately be one of two paths (e.g., "Import Repository" + "Deploy Template"). **Three CTAs is a smell.**
- After an async filter change, wrap the region in `aria-live="polite"` so screen readers announce the new state
- Don't auto-launch a tour from the educational variant; pair `Start Tour` with `Skip`
- **Don't put critical persistent warnings here.** Empty states vanish when the list populates; persistent warnings belong in `Note` or the page header

### 2.6 What to Watch Out For (Geist)

From designsystems.one: *"The aesthetic is so distinctive that lifting it directly produces a Vercel-clone — the visual restraint reads as 'made with Geist' rather than 'this is your brand'. The system is optimized for developer surfaces (dashboards, logs, code editors). Applying it to consumer marketing reads as cold."*

**Translation for Nashrino:** Use Geist's *engineering discipline* (typography scale, tabular numerics, empty-state rigor, command bar pattern) but add a Persian warmth via Vazirmatn + slightly warmer neutral canvas. Don't ship a Vercel clone.

---

## 3. Stripe Dashboard Deep Dive

Sources: stripe.com/blog/accessible-color-systems, Stripe brand color (Mobbin), Stripe Dashboard iPhone post (Michaël Villar), Stripe DESIGN.md analysis, Refero Styles.

### 3.1 The Stripe Palette

| Color | Hex | Role |
|---|---|---|
| **Downriver** | `#0A2540` | Deep navy ink — primary text, headings |
| **Black Squeeze** | `#F6F9FC` | Cool off-white canvas — page background |
| **Cornflower Blue (Stripe Purple)** | `#635BFF` | Electric violet — primary action, links, accent |

From Refero Styles: *"The interface is a near-monochrome canvas of cool whites and deep navy ink, interrupted only by a single electric violet accent that makes every action feel [intentional]."*

**Stripe's DESIGN.md one-liner:** *"Stripe takes payment infrastructure as its base, then sharpens it through signature purple gradients, weight-300 elegance."* That `weight-300` is critical — Stripe's body type is *lighter* than most SaaS UIs. It reads as premium because most dashboards default everything to 400/500.

### 3.2 Numeric Typography — Tabular Figures Everywhere

**Stripe's numeric treatment is the most-cited reference in dashboard design.** From the Yellowfin BI dashboard design guide: *"Numbers in your dashboard should generally be a tabular (evenly spaced) font."* Stripe implements this via:

```css
font-variant-numeric: tabular-nums;
/* equivalent: font-feature-settings: "tnum" 1; */
```

**What tabular-nums does:** Forces every digit to occupy the same advance width. The `1` (normally narrow) takes the same horizontal space as `0` or `8`. Result: columns of numbers align perfectly at every decimal point, and updating a number from `1,234` to `9,999` doesn't shift the layout by a single pixel.

**Where Stripe uses it:**
- Every currency cell in tables (`$1,234.56`, `$9,876.54` align by the `.`)
- Every metric card big number (`$48,231` total volume)
- Every chart axis label
- Every relative timestamp (`3m ago`, `2h ago` — the digits stay put as time passes)
- Every percentage (`+12.4%`, `-3.1%`)

**The CSS utility Stripe-style dashboards all use:**
```css
.num-tabular {
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum" 1;
}
/* OR with proper fallback for fonts without tnum: */
.num-tabular {
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum" 1, "lnum" 1; /* lining figures, not old-style */
}
```

**Stripe uses Söhne (Klim Type Foundry)** for body — *"the memory of Akzidenz-Grotesk framed through the reality of Helvetica."* Söhne has excellent tabular figures. Free alternative: **Inter** with `tnum` enabled, or **Geist Sans**.

### 3.3 Stripe's Accessible Color System (the famous blog post)

Stripe's 2019 "Designing accessible color systems" post (Daryl Koopersmith & Wilson Miner) is the foundational reference for perceptually uniform color in product UI. Key takeaways:

1. **WCAG suggests 4.5:1 minimum contrast for small text, 3.0 for large text.** When Stripe audited, *none of their default text colors (except black) met the threshold*.
2. **Two failed approaches:** (a) Hand-pick colors and check contrast — too much trial and error. (b) Generate tints from base colors — produces dull, muted colors that are hard to distinguish.
3. **The HSL problem:** *"The way HSL calculates lightness is flawed. Different hues are inherently perceived as different levels of lightness by the human eye — at the same level of mathematical lightness, yellow appears lighter than blue."*
4. **The CIELAB solution:** Perceptually uniform color spaces model colors based on human vision. When colors with the same Lab lightness are placed side by side, they appear to blend together — each appears just as light and as saturated as the rest.
5. **Result:** Stripe's new palette has *"uniform contrast across all hues."* Yellow has the same contrast range as blue, but they still look like Stripe's colors. Each color follows the same perceptual lightness curve.
6. **Built-in contrast rules:** Any two colors at least 5 levels apart = sufficient contrast for small text. At least 4 levels apart = sufficient for icons/large text. This makes it trivial to pick accessible pairs.
7. **Vibrant ≠ accessible, but they're not mutually exclusive.** WCAG only measures foreground/background contrast, not vibrancy. Stripe's tool showed them which "imaginary colors" (like "very colorful dark yellow" or "vibrant light royal blue") don't actually exist — they could iterate faster by seeing what's *possible*.

### 3.4 Stripe Dashboard iPhone — Card-based Interaction Design

From Michaël Villar (early Stripe engineer, now at Height) on building the Stripe Dashboard iPhone app:

**Cards as a paradigm:**
- New cards **slide open from the side with a slight spring** — that's how they can be moved and dismissed
- An **extra shadow appears when dragging a card** to emphasize that you're controlling that specific card
- Other cards behind it **move forward when you drag a card away** — to show their progress
- **Match the velocity** of the card being thrown away to the velocity of the deck moving forward — so it's clear the actions are connected
- Cards farther back are **darker** like they would be in real life (depth via luminance, not blur)

**Tap interaction (Material-inspired):**
- 100ms delay before opening a card for two reasons: (1) the data needs to load and showing an empty card is unhelpful, (2) the user has time to see where they tapped

**Loading state philosophy:**
- "When an app is internet dependent, you can either show a landing screen or an empty app with lots of spinners. We chose the former combined with an animation because during that loading period the app isn't responsive anyway."
- "At app launch, we wait for the data to be loaded to display the first screen and **show the UI all at once with no extra spinner or UI blinking**. If the network is too slow, we'll show the UI with spinners anyway after a few seconds."

**Time-period switching animation:**
- "As the units change from days to weeks, we fade the graphs out while scaling" — this is the spatial-continuity pattern (motion explains where the previous view went, not just decorates the transition).

### 3.5 Stripe's Data Density Without Clutter

Stripe fits more numbers on screen than any competitor without feeling crowded because:

1. **Weight discipline.** Body type at 300/400. Headers at 500. Big metric numbers at 600 (only for the hero metric per card). Most SaaS UIs use 500 everywhere — Stripe reserves 500/600 for emphasis, which makes 300/400 body read as "calm."
2. **Cool whites, not warm whites.** `#F6F9FC` (Black Squeeze) has a 210° hue, 2% chroma — barely-perceptible cool tint. This reads as "financial" / "trustworthy" / "neutral" compared to a warm `#FAFAF7` which reads "consumer" / "friendly."
3. **Tables with hairline row separators, no vertical lines.** A 1px `rgba(10, 37, 64, 0.06)` border under each row. Columns align by content, not by visible dividers.
4. **Charts use the Stripe purple sparingly.** The primary metric line is `#635BFF`. Secondary/comparison lines are 2 shades of navy gray. Zero-rainbow charts.
5. **Sparklines on cards.** Every metric card has a 100×32px sparkline showing the 30-day trend. Same color as the metric (purple for primary, gray for secondary).
6. **Currency always tabular-nums.** Always right-aligned. Always with thousands separator. Always with the currency symbol dimmer than the digits (`text-ink-tertiary` for `$`, `text-ink` for digits).

---

## 4. Apple iOS 26 Liquid Glass HIG

Sources: developer.apple.com/design (Liquid Glass collection, Materials page), WWDC25 Session 219 "Meet Liquid Glass" notes, Conor Luddy's comprehensive Swift/SwiftUI reference (conor.fyi/writing/liquid-glass-reference), ArtVersion analysis.

### 4.1 What Liquid Glass Actually Is

Introduced WWDC25 (June 9, 2025). Apple's most significant design evolution since iOS 7. *"A translucent, dynamic material that reflects and refracts surrounding content while transforming to bring focus to user tasks."* Spans iOS 26, iPadOS 26, macOS Tahoe 26, watchOS 26, tvOS 26, visionOS 26.

**Key characteristics (from Apple's WWDC25 session):**
- **Lensing** — bends and concentrates light in real-time (vs. traditional blur that scatters light)
- **Materialization** — elements appear by gradually modulating light bending
- **Fluidity** — gel-like flexibility with instant touch responsiveness
- **Morphing** — dynamic transformation between control states
- **Adaptivity** — multi-layer composition adjusting to content, color scheme, and size

### 4.2 The Core Rule — Navigation Layer Only

> *"Liquid Glass is exclusively for the navigation layer that floats above app content. Never apply to content itself (lists, tables, media)."*

From the Apple HIG Materials page: *"Liquid Glass forms a distinct functional layer for controls and navigation elements — like tab bars and sidebars — that floats above the content layer, establishing a clear visual hierarchy between functional elements and content. Liquid Glass allows content to scroll and peek through from beneath these elements to give the interface a sense of dynamism and depth, all while maintaining legibility for controls and navigation. **Don't use Liquid Glass in the content layer.**"*

**Exception:** transient interactive controls in the content layer (sliders, toggles) take on a Liquid Glass appearance *when activated* to emphasize their interactivity. But the static content surface is never glass.

**Use Liquid Glass effects sparingly.** "Standard components from system frameworks pick up the appearance and behavior of this material automatically. If you apply Liquid Glass effects to a custom control, do so sparingly. Liquid Glass seeks to bring attention to the underlying content, and overusing this material in multiple custom controls can provide a subpar user experience by distracting from that content."

### 4.3 Two Variants — Regular vs Clear

| Variant | Use | Transparency | Adaptivity |
|---|---|---|---|
| `.regular` | Default for most UI | Medium | **Full** — adapts to any content |
| `.clear` | Media-rich backgrounds | High | Limited — requires dimming layer |
| `.identity` | Conditional disable | None | N/A — no effect applied |

**When to use each:**
- **Regular:** Toolbars, buttons, navigation bars, tab bars, standard controls, alerts, sidebars, popovers
- **Clear:** Small floating controls over photos/maps with bold foreground content; components that float above media backgrounds (photos, videos) to create immersive content experience
- **Identity:** Conditional toggling (`glassEffect(isEnabled ? .regular : .identity)`)

**Requirements for Clear variant (ALL must be met):**
1. Element sits over media-rich content
2. Content won't be negatively affected by a dimming layer
3. Content above glass is bold and bright

**Dimming layer rule for Clear:** If underlying content is bright, add a **dark dimming layer of 35% opacity**. If underlying content is sufficiently dark, no dimming needed.

### 4.4 Depth Layers (Background → Glass → Content)

Apple's three-layer philosophy:

| Layer | Treatment | Purpose |
|---|---|---|
| **Content (bottom)** | No glass, opaque surfaces | Lists, tables, media, body text — content is primary |
| **Navigation (middle)** | Liquid Glass | Tab bars, sidebars, toolbars, floating controls |
| **Overlay (top)** | Vibrancy + fills on glass | Foreground text/icons/symbols that sit *on* the glass — auto-adjusted color, brightness, saturation |

**Critical anti-pattern: Never stack glass on glass.** Apple's explicit rule:

```swift
// ❌ BAD — Confusing visual hierarchy
VStack {
    HeaderView().glassEffect()
    ContentView().glassEffect()
    FooterView().glassEffect()
}

// ✅ GOOD — Clear separation
ZStack {
    ContentView()         // No glass
    HeaderView().glassEffect()   // Single floating layer
}
```

### 4.5 Specular Highlights & Edge Treatment

Liquid Glass simulates real glass optics, not just blur:

- **Real-time light bending (lensing)** — content beneath is refracted, not just blurred
- **Specular highlights respond to device motion** — micro-glints at 120fps, ripple edge-to-edge, more physics simulation than overlay (per ArtVersion's analysis)
- **Adaptive shadows** — opacity *increases* over text (to maintain legibility) and *decreases* over white backgrounds (to avoid mud)
- **Edge treatment** — Concentric corner alignment. Rounded rectangles use `containerConcentric` radius that matches the container's corners. Capsule is the default shape for free-floating glass.
- **Subtle top-edge white highlight** — gives the surface a "pixel-rendered" feel (mirrors Linear's approach)
- **Size affects thickness** — larger elements simulate a thicker, more substantial material. Shadows and scattering of light increase with component size.

### 4.6 Tinting — Semantic, Never Decorative

> *"Tinting allows you to apply color to Liquid Glass while staying consistent with the material. **Tints should only be used to bring emphasis to primary elements.**"*

```swift
.glassEffect(.regular.tint(.blue))               // Solid tint
.glassEffect(.regular.tint(.purple.opacity(0.6))) // Subtle tint
```

**Tinting philosophy:** Use selectively for primary actions. Avoid tinting everything. Tint conveys meaning, not decoration. Compatible with all glass behaviors.

### 4.7 Motion Specifications

From WWDC25 Session 219 + the comprehensive reference:

**Glass materialization (element appears):**
- Default: `.glassEffectTransition(.matchedGeometry)` — matched geometry transition (smooth)
- Alternative: `.glassEffectTransition(.materialize)` — material appearance transition (glass fades in)
- Identity: `.glassEffectTransition(.identity)` — no changes

**Morphing between states:**
```swift
withAnimation(.bouncy) { isExpanded.toggle() }
```
- **`.bouncy`** is Apple's default spring for glass morphing (response ~0.4s, dampingFraction ~0.6)
- Elements in the same `GlassEffectContainer` with `glassEffectID` morph together
- The `spacing:` parameter on `GlassEffectContainer` controls the morphing threshold — elements within this distance visually blend and morph together during transitions (default ~20-30pt)

**Interactive glass (press response):**
- Scaling on press (subtle, ~0.95 scale)
- Bouncing animation (spring)
- Shimmering effect
- Touch-point illumination that radiates to nearby glass
- Response to tap and drag gestures

**Drag gesture springs:**
```swift
withAnimation(.spring(response: 0.3, dampingFraction: 0.6)) { ... }
```

**Symbol effects:** `.contentTransition(.symbolEffect(.replace))` for icon state changes; `.contentTransition(.numericText())` for rolling number transitions.

### 4.8 Readability Rules — When Glass Goes Wrong

From Conor Luddy's reference: *"Liquid Glass over busy, colorful, or animated content causes readability issues."*

**Four solutions (in order of preference):**

1. **Gradient Fade** — A `LinearGradient` from `clear` to `backgroundColor.opacity(0.85)` at the edge where glass meets content. This is what iOS uses at the bottom of scroll views (the "deliquify" modifier).

2. **Strategic Tinting** — `.glassEffect(.regular.tint(.purple.opacity(0.8)))` adds color for better visibility.

3. **Choose Regular over Clear** — Regular variant blurs and adjusts luminosity of background content to maintain legibility. Clear doesn't.

4. **Background Dimming** — `Color.black.opacity(0.3)` overlay beneath the glass. Subtle darkening.

**Contrast management:**
- Maintain **4.5:1 minimum contrast ratio** between text and glass surface
- Test legibility across multiple background contents (light, dark, busy, calm)
- Use vibrant text on glass (system vibrant colors auto-adjust)
- Add subtle borders (1px hairline) for definition when glass sits over chaotic content

**Adaptive color scheme switching:**
- Small elements (nav bars, tab bars): flip between light/dark based on background
- Large elements (sidebars, menus): adapt but don't flip (would be jarring)
- Shadows: opacity increases over text, decreases over white backgrounds
- Tint: adjusts hue, brightness, saturation for legibility

### 4.9 Performance Implications (the real cost of glass)

From the Luddy reference — battery testing on iPhone 16 Pro Max:
- **iOS 26 with Liquid Glass: 13% battery drain** vs **iOS 18 with standard materials: 1%**
- Increased heat generation
- Higher CPU/GPU load on older devices (iPhone 11-13 may show lag)

**Optimization strategies:**
1. **Always use `GlassEffectContainer` for multiple glass elements** — combines shapes into unified composition, improves rendering performance by sharing sampling region. Without it, glass samples inefficiently.
2. **Limit continuous animations** — let glass rest in steady states. Continuous rotation/repeatForever animations on glass are battery killers.
3. **Test on 3-year-old devices** — iPhone 11 is the floor for iOS 26 full effects; older devices get frosted glass fallback with reduced effects.
4. **Profile with Instruments** for GPU usage. Monitor thermal performance.
5. **Memory:** Real-time blur consumes GPU memory. Glass samples a larger area than the element size. Shared sampling region (via container) reduces memory overhead.

### 4.10 Accessibility — System-Handled, Don't Override

Liquid Glass automatically adapts to system accessibility settings:
- **Reduced Transparency** → increases frosting for clarity (glass becomes more opaque)
- **Increased Contrast** → stark colors and borders
- **Reduced Motion** → tones down animations and elastic effects
- **iOS 26.1+ Tinted Mode** → user-controlled opacity increase (Settings → Display & Brightness → Liquid Glass)

**Best practice:** Let system handle accessibility automatically. Don't override unless absolutely necessary. Test with all accessibility modes enabled.

### 4.11 When to Use Glass vs Solid UI

**Use Liquid Glass for:**
- ✅ Navigation bars and toolbars
- ✅ Tab bars and bottom accessories
- ✅ Floating action buttons
- ✅ Sheets, popovers, and menus
- ✅ Context-sensitive controls
- ✅ System-level alerts

**Avoid Liquid Glass for:**
- ❌ Content layer (lists, tables, media)
- ❌ Full-screen backgrounds
- ❌ Scrollable content
- ❌ Stacked glass layers
- ❌ Every UI element

**Apple's guidance:** *"Liquid Glass is best reserved for the navigation layer that floats above the content of your app."*

---

## 5. Apple Vision Pro / macOS Sequoia Translucent Materials

Sources: Apple HIG Materials page (visionOS / macOS sections), Pixel Envy sidebar translucency analysis.

### 5.1 Standard Materials (non-Liquid-Glass)

Apple provides standard materials for the *content layer* — to convey structure beneath Liquid Glass controls:

**iOS/iPadOS standard materials (4 thicknesses):**
- `ultraThin` — full-screen views requiring a light color scheme
- `thin` — overlay views that partially obscure, requiring light scheme
- `regular` (default) — overlay views that partially obscure
- `thick` — overlay views requiring a dark color scheme

**Vibrancy styles for labels on materials (highest → lowest contrast):**
- `.label` (default)
- `.secondaryLabel`
- `.tertiaryLabel`
- `.quaternaryLabel` (avoid on `thin` and `ultraThin` — contrast too low)

**Vibrancy styles for fills:**
- `.fill` (default)
- `.secondaryFill`
- `.tertiaryFill`

Separator has a single vibrancy value that works on all materials.

### 5.2 macOS Sequoia Materials — Semantic, Not Aesthetic

macOS provides several standard materials with **designated purposes**. Apple's rule: *"Choose materials and effects based on semantic meaning and recommended usage. Avoid selecting a material or effect based on the apparent color it imparts to your interface, because system settings can change its appearance and behavior."*

**Two background blending modes on macOS:**
- `behindWindow` — blends with content *behind the entire window* (the desktop)
- `withinWindow` — blends with content *inside the window* (other views in the same window)

The semantic materials correspond to: `titlebar`, `menu`, `popover`, `sidebar`, `headerView`, `sheet`, `windowBackground`, `hudWindow`, `fullScreenUI`, `toolTip`, `contentBackground`, `underWindowBackground`, `underPageBackground`. Each has a recommended use.

### 5.3 visionOS Glass Material

visionOS is unique — windows use a system-defined unmodifiable material called **`.glass`** that:
- Lets light, the current Environment, virtual content, and physical surroundings show through
- **Adaptive** — limits the range of background color information so a window can provide contrast while becoming brighter/darker depending on physical surroundings
- **No Dark Mode** — glass auto-adapts to the luminance of objects behind it

**visionOS rules:**
- *"Prefer translucency to opaque colors in windows."* Areas of opacity block people's view and feel constricting.
- For custom components, three materials:
  - `thin` — buttons, selected items (interactive emphasis)
  - `regular` — sidebars, grouped table views (visual separation)
  - `thick` — dark elements that remain visually distinct on top of `regular` backgrounds
- Vibrancy: `.label` for standard text, `.secondaryLabel` for footnotes/subtitles, `.tertiaryLabel` for inactive elements only

### 5.4 The Sidebar-Translucency Rule (Pixel Envy)

From Pixel Envy's analysis: *"Translucent elements are only visible in foreground windows. Elements in background windows are always opaque. The Dock and Menu Bar — separate from windows — also become opaque when an app is in full-screen mode."*

This is critical for dashboard design: **background windows de-glass automatically.** For Nashrino: if the user opens a compose modal that has its own scrollable list, the parent dashboard's glass should not "show through" the modal — the modal becomes the new foreground context.

### 5.5 Text Readability on Glass — The Vibrancy System

Apple's rule: *"Help ensure legibility by using vibrant colors on top of materials. When you use system-defined vibrant colors, you don't need to worry about colors seeming too dark, bright, saturated, or low contrast in different contexts. Regardless of the material you choose, use vibrant colors on top of it."*

The vibrancy system pulls light and color *forward* from the background, simulating the way real glass would refract light onto foreground text. This is why Apple's glass text looks crisp while amateur glassmorphism produces muddy gray text — the vibrancy is doing the work.

**For web (Nashrino):** True vibrancy isn't possible without GPU shaders. The web fallback is:
1. Backdrop blur (24-32px) to mute background chaos
2. A semi-opaque overlay (the glass tint) at 60-80% opacity
3. A 1px hairline border (light at top, dark at bottom) for edge definition
4. Text in `ink` color (full opacity) — never lower text opacity on glass
5. A subtle drop-shadow on text (`text-shadow: 0 1px 1px rgba(0,0,0,0.06)`) for crispness

---

## 6. shadcn/ui Best Practices

Sources: shadcn/ui New York style comparison, shadcn/ui data table patterns, shadcn command palette.

### 6.1 New York Style (the only style in shadcn 2.5.0+)

Tailwind v4 dropped the "Default" style — only **New York** styling remains. Key characteristics:

| Aspect | New York |
|---|---|
| **Button/input height** | `h-9` (36px) — more condensed than Default's `h-10` (40px) |
| **Shadows** | `shadow-sm` on buttons, inputs, select, date pickers (Default was flat) |
| **Card title** | `text-base` (16px, 1rem) — Default was `text-2xl` (24px, 1.5rem) |
| **Focus ring** | 1px outline, 0px offset (Default was 2px outline, 2px offset) |
| **Card radius** | `rounded-xl` (12px) — Default was `rounded-lg` (8px) |
| **Badge radius** | `rounded-md` (6px) — Default was `rounded-full` |
| **Tabs radius** | `rounded-lg` (8px) — Default was `rounded-md` |
| **Tabs trigger radius** | `rounded-md` (6px) — Default was `rounded-sm` (2px) |
| **Switch** | `h-5 w-9`, thumb `h-4 w-4` — Default was `h-6 w-11`, thumb `h-5 w-5` |
| **Tooltip** | `bg-primary text-primary-foreground` (Default was `bg-popover` + `shadow-md`) |
| **Radio button** | Check icon (Default was Circle icon) |
| **Select menu item** | Check icon on the *right* (Default was on the left) |

**Use New York when:** Compact UI, subtle shadows for depth, prominent focus state, sleeker/refined appearance. This is the right choice for Nashrino — it's the modern dev-tool aesthetic.

### 6.2 Data Table Patterns (TanStack Table + shadcn)

The canonical shadcn data table uses TanStack Table (headless) + shadcn `<Table>` primitive. Production-ready patterns from shadadcncraft:

**Standard features:**
- Sortable columns (click header to sort asc/desc, shift-click for multi-sort)
- Server-side filtering via `cmdk` + URL search params (nuqs for state management)
- Collapsible controls side panel (filters hidden by default, expandable)
- Filter types: input (text search), checkboxes (multi-select), date range, slider (numeric range)
- Pagination with `Load More Button` (not just page numbers — better for infinite-scroll mental models)
- Row selection with bulk actions
- Column visibility toggle (user can hide/show columns)
- Row expansion (click row to reveal nested detail)
- Sticky header on scroll

**Spacing rhythm:**
- Cell padding: `px-4 py-3` (16px horizontal, 12px vertical)
- Header row: `px-4 py-2.5` with `text-xs font-medium text-muted-foreground uppercase tracking-wider`
- Row separator: `border-b border-border` (1px hairline)
- Hover state: `hover:bg-muted/50` (subtle)
- Selected state: `bg-primary/5`

**Numbers in tables:**
- Always right-aligned: `text-right`
- Always tabular: `font-variant-numeric: tabular-nums`
- Currency: symbol dimmer than digits (`<span class="text-muted-foreground">$</span>1,234`)
- Negative numbers in red, positives in default ink

### 6.3 Command Palette Patterns (cmdk + shadcn)

The shadcn `Command` component wraps cmdk. Production patterns from the cmdk-search demo:

**Structure:**
```
<CommandDialog> (modal, ⌘K trigger)
  <CommandInput placeholder="Search or type a command..." />
  <CommandList> (scrollable, max-height ~400px)
    <CommandEmpty>No results found.</CommandEmpty>
    <CommandGroup heading="Pages">
      <CommandItem>...</CommandItem>
    </CommandGroup>
    <CommandSeparator />
    <CommandGroup heading="Actions">
      <CommandItem>...</CommandItem>
    </CommandGroup>
  </CommandList>
</CommandDialog>
```

**Key behaviors:**
- **Fuzzy search** via cmdk's built-in algorithm (or integrate Fuse.js for stricter control)
- **Recent items** at top of empty-query state (last 5 viewed items)
- **Keyboard hints** on every item: `↵` to select, `⌘+↵` to open in new tab, `Esc` to close
- **Grouped results** with headings (Pages, Actions, Settings, People, etc.)
- **Selection follows arrow keys** (up/down to navigate, Enter to select)
- **Disabled items** are visible but greyed out (don't hide — shows the action exists)
- **Long names truncated** with `MiddleTruncate` (keeps prefix and suffix visible: `my-post...-draft.md`)
- **Sub-commands** on each item (right-side actions, triggered with `Tab`)

**Content rules:**
- Group headings: Title Case, `text-muted-foreground`, `text-xs`, uppercase, tracking-wider
- Item icon: `size-4`, `text-muted-foreground` (16px, muted)
- Item label: `text-sm` (14px), default ink
- Item shortcut: `text-xs text-muted-foreground`, in a `<kbd>` with `rounded border bg-muted px-1.5 font-mono`

### 6.4 Sidebar Pattern (shadcn Sidebar component)

The shadcn `<Sidebar>` is the modern sidebar primitive. Key features:
- Collapsible (icon-only mode, off-canvas mode, or full-width)
- `SidebarProvider` manages collapse state across reloads (localStorage)
- Sections with headers (`<SidebarGroup>` + `<SidebarGroupLabel>`)
- Items with icon + label + optional badge + optional action (`<SidebarMenuItem>`)
- Active state: `bg-sidebar-accent text-sidebar-accent-foreground` + 2px left accent bar (CSS `before:` pseudo-element)
- Mobile: collapses to a `<Sheet>` (drawer from the side)

---

## 7. Dashboard UX Patterns Synthesis

### 7.1 Layout Grids

**Linear** (the reference): Inverted L-shape chrome. Sidebar (244px, light: `--bg-base-color #fcfcfd`, dark: `#0d0d0d`) + tabs strip + content area with 12px border-radius (`#appBorders`). Main content sits at `margin: 8px 8px 8px 244px` (8px gutters around content). The inverted-L is the global chrome that controls content in the main view.

**Vercel dashboard:** Sidebar (240px) + main content (max-width 1200px, centered, generous padding). Top bar with workspace switcher + search + notifications. Empty state as a feature, not a fallback — every list view has a thoughtful empty state with primary CTA.

**Stripe dashboard:** Left sidebar (220px, Downriver navy on light mode) + top metrics strip + main content with 4-column grid for metric cards + chart row + recent activity table. The chart row is the protagonist — 60% of the visible area, with controls for time range above and metric breakdown below.

**Notion:** Block-based — content surfaces are clean cards with no chrome. Empty state is a single `+` button per block type. The dashboard IS the content; there's no separate "dashboard chrome" wrapping it.

**Raycast:** Pure command palette. The dashboard is the palette itself — typed queries produce rich results (files, actions, calculations, AI responses). No traditional sidebar at all. The lesson: *if your command palette is good enough, you can de-emphasize navigation chrome*.

**Height (now sunset, but instructive):** Spreadsheet-meets-chat. Each row was a task, but rows could expand into chat threads inline. Color-coded bars represented task status. The lesson: don't be afraid to break the "card grid" template if a denser, more data-native layout serves the workflow.

### 7.2 Information Hierarchy

**Vercel's hierarchy (3 tiers):**
1. **Hero metric** (one per view) — `text-3xl font-bold`, full-width card, sparkline, trend badge
2. **Secondary metrics** (3-4 per view) — `text-xl font-semibold`, equal-width grid, sparkline
3. **Detail tables** (rest of the view) — `text-sm`, hairline separators, tabular numbers

**Stripe's hierarchy (4 tiers):**
1. **Hero metric** — `text-4xl font-semibold` weight 600, with 30-day delta and sparkline
2. **Chart** — full-width, time range selector above, metric breakdown below
3. **Stat row** — 3-4 equal metrics, `text-2xl`, smaller sparklines
4. **Recent activity table** — `text-sm`, dense, tabular numbers

**Linear's hierarchy (different — they're list-first):**
1. **Page header** — title (`text-xl`), filter bar, view options
2. **List/board/timeline** — the work itself, dense rows
3. **Side panel** — metadata for selected item, slides in from right

### 7.3 Empty States — The Vercel/Geist Standard (recap)

See §2.5. The key: empty states are *first-class design surfaces*, not afterthoughts. Each variant (Blank Slate, Informational, Educational, Guide, No-Results, Error, Permission) has specific content rules and CTA patterns.

### 7.4 Loading States

**Linear approach (no spinners):**
- First load: inlined app shell in `index.html` paints immediately (CSS variables for sidebar color, sidebar width, dark mode applied before any JS parses)
- Subsequent loads: data already in IndexedDB, render from local, reconcile via WebSocket deltas
- Mutations: optimistic, never block UI

**Stripe Dashboard iPhone approach:**
- App launch: show a single branded loading animation while data loads; show full UI all at once with no extra spinners
- After ~3s of slow network: show UI with spinners in specific cells (don't blank the whole page)

**Vercel approach:**
- Skeleton screens (gray placeholders matching layout) for first load
- Skeleton duration capped at ~200ms before swap to real content
- Optimistic updates for mutations (no spinner on deploy button — show "Building" state immediately, reconcile in background)

**Recommendation for Nashrino:**
- First page load: skeleton screens (matching the final layout shape) for 200-400ms max
- After data loaded: never show a spinner for the same data again — mutate in place
- Mutations: optimistic, with a subtle "saving…" indicator in the corner (not a modal)
- Long operations (publishing to multiple platforms): show a progress card in the corner with platform-by-platform status

### 7.5 Density vs Breathing Room

**Linear = dense.** Linear's redesign explicitly *"reduce[d] visual noise, maintain[ed] visual alignment, and increase[d] the hierarchy and density of navigation elements."* Sidebar items are 28px tall. List rows are 36px tall. Tabs are 32px tall. Information density is the goal — Linear users spend all day here.

**Stripe = balanced.** Metric cards have `p-6` (24px padding). Table rows have `py-3` (12px vertical). Charts have generous whitespace around them. Stripe balances density (lots of data per screen) with breathing room (each data point has space to be read).

**Vercel = spacious.** Deploy cards have `p-8` (32px padding). Lots of whitespace. This reads as "approachable developer tool" vs Linear's "power user tool."

**Nashrino recommendation:** Stripe-balance. Social media managers are semi-power-users — they need data density (5 platforms × multiple metrics × multiple posts per day) but also spend 8+ hours/day here, so breathing room matters. Target: 24px card padding, 12px row padding, 36px sidebar items, 32px tabs.

---

## 8. Specific Actionable Recommendations for Nashrino

Nashrino is a Persian RTL social media management dashboard with 5 platforms (Instagram, Telegram, LinkedIn, Rubika, Eitaa). Below: concrete recommendations synthesized from all the above research.

### 8.1 Glass Material System (4 tiers, Apple-aligned)

Apply glass **only** to navigation/overlay layers. Content sits on opaque surfaces.

| Tier | Use | Backdrop blur | Opacity | Saturation | Border |
|---|---|---|---|---|---|
| `n-panel-strong` | Popovers, command palette, modals | 40px | 0.86 | 1.9 | 1px `glass-border-outer` + 1px `glass-border-inner` |
| `n-panel` | Sidebar, top command bar (default glass) | 32px | 0.80 | 1.8 | 1px `glass-border-outer` |
| `n-panel-thin` | Floating action button, contextual toolbar | 20px | 0.70 | 1.6 | 1px `hairline` |
| `n-panel-veil` | Chips, dividers, low-emphasis overlays | 12px | 0.55 | 1.4 | none |

**Each glass tier gets:**
- `::before` pseudo-element for specular sheen (gradient `from-white/0.65 via-white/0.18 to-white/0`, top to bottom)
- `::after` pseudo-element for outer dark edge (0.5px border at `rgba(0,0,0,0.06)` — gives crisp boundary)
- Layered shadow (only on `n-panel-strong` and `n-panel`):
  ```css
  box-shadow:
    0 1px 2px rgba(0,0,0,0.04),
    0 4px 8px rgba(0,0,0,0.04),
    0 12px 24px rgba(0,0,0,0.06);
  ```

**Content surfaces (no glass):**
- `bg-surface` — default card background (opaque)
- `bg-surface-subtle` — nested card / list item background (one step lighter than surface)
- `bg-surface-hover` — hovered list item background
- `bg-surface-active` — selected item background (tinted with accent at 5%)

### 8.2 Layout (Stripe-balance density)

```
┌─────────────────────────────────────────────────────────┐
│ Top Command Bar (h-12, glass) — workspace switcher | ⌘K │
├──────────┬──────────────────────────────────────────────┤
│          │  Page header (title + filter bar)            │
│ Sidebar  ├──────────────────────────────────────────────┤
│ (264px,  │  Hero metric row (1-3 metrics, sparklines)   │
│ glass)   ├──────────────────────────────────────────────┤
│          │  Main content (charts / table / calendar /   │
│          │  feed / composer — varies per view)          │
│          │                                              │
│          │                                              │
└──────────┴──────────────────────────────────────────────┘
       Floating Compose Button (bottom-right, glass)
```

- **Sidebar:** 264px expanded, 64px collapsed (icon-only). Sections: Platforms (IG/Telegram/LinkedIn/Rubika/Eitaa), Views (Dashboard, Calendar, Inbox, Analytics, Content, Media, Campaigns, Settings).
- **Top command bar:** h-12 (48px). Workspace switcher (left), ⌘K search (center, 480px wide), notifications (right).
- **Main content:** 24px outer padding, 16px between sections.
- **Mobile:** Sidebar collapses to `<Sheet>` (drawer from right since RTL). Top command bar shrinks to h-10.

### 8.3 Typography (Vazirmatn + tabular numerics)

**Font stack:**
```css
--font-sans: 'Vazirmatn', 'Geist Sans', system-ui, sans-serif;
--font-mono: 'Geist Mono', ui-monospace, monospace;
```

Vazirmatn is the Persian-first font (blends with Roboto for its Latin glyphset, supports 9 weights). Geist Sans as the Latin fallback ensures tabular numerals render crisply for Western digits in analytics.

**Type scale (Linear-inspired, adapted for Persian):**

| Token | Size | Weight | Line-height | Letter-spacing | Use |
|---|---|---|---|---|---|
| `text-display-xl` | 48px | 700 | 1.05 | -1.5px | Hero metric (largest number on dashboard) |
| `text-display-lg` | 36px | 700 | 1.10 | -1.0px | Page title |
| `text-display-md` | 28px | 600 | 1.15 | -0.6px | Section opener |
| `text-heading` | 22px | 600 | 1.20 | -0.4px | Card title |
| `text-subhead` | 18px | 500 | 1.40 | -0.2px | Subsection, panel header |
| `text-body` | 14px | 400 | 1.50 | 0 | Default body |
| `text-body-sm` | 13px | 400 | 1.50 | 0 | Secondary body, table cells |
| `text-caption` | 12px | 400 | 1.40 | 0 | Meta, captions, status |
| `text-label` | 11px | 500 | 1.30 | +0.3px | Eyebrows, section labels (UPPERCASE for Latin, normal for Persian) |
| `text-button` | 13px | 500 | 1.20 | 0 | Button labels |
| `text-metric` | 22px | 600 | 1.20 | -0.4px | Stat card big number (always tabular-nums) |
| `text-mono` | 12px | 400 | 1.50 | 0 | Code, IDs, post slugs |

**Persian-specific adjustments:**
- Persian script needs *larger* line-height than Latin — bump body from Linear's 1.50 to 1.60 for Persian-heavy text.
- Persian doesn't use letter-spacing the same way — negative tracking on Persian text breaks the script's connected forms. Apply `-0.4px` etc. **only to Latin/numeric runs**, never to Persian.
- Use `font-feature-settings: "ss01" 1` for Vazirmatn's alternate Persian digit forms (more rounded).
- Bold (700) Persian can look heavy — for Persian headings, prefer 600 weight.

**Tabular numerics utility:**
```css
@utility num-tabular {
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum" 1, "lnum" 1;
}
@utility num-proportional {
  font-variant-numeric: proportional-nums;
  font-feature-settings: "tnum" 0;
}
```

Apply `num-tabular` to: every metric number, every follower count, every engagement %, every date, every table cell containing a number, every chart axis label.

### 8.4 Color Tokens (OKLCH, perceptually uniform)

Use OKLCH (Linear + Stripe's approach). Define 3 inputs, derive everything else:

```css
@theme {
  /* === 3 theme inputs (Linear's pattern) === */
  --base: oklch(0.985 0.004 250);      /* near-neutral cool white */
  --accent: oklch(0.62 0.18 280);       /* restrained violet — Linear + Stripe blend */
  --contrast: 0.30;                      /* comfortable default; bump to 0.80 for high-contrast */

  /* === Canvas === */
  --color-canvas: oklch(0.985 0.004 250);          /* #f7f8fa-ish, very subtle cool */
  --color-canvas-dark: oklch(0.16 0.006 250);      /* #1a1c20-ish, not pure black */

  /* === Surface ladder (4 tiers, Linear-style) === */
  --color-surface: oklch(1 0 0);                    /* pure white cards on light */
  --color-surface-subtle: oklch(0.96 0.004 250);
  --color-surface-hover: oklch(0.94 0.005 250);
  --color-surface-active: oklch(0.92 0.02 280 / 0.4); /* accent-tinted */
  --color-surface-dark: oklch(0.20 0.006 250);
  --color-surface-subtle-dark: oklch(0.24 0.007 250);

  /* === Text (4 tiers, Linear-style) === */
  --color-ink: oklch(0.20 0.02 250);                /* primary text */
  --color-ink-muted: oklch(0.40 0.015 250);         /* secondary */
  --color-ink-subtle: oklch(0.55 0.012 250);        /* tertiary */
  --color-ink-tertiary: oklch(0.70 0.008 250);      /* quaternary — disabled */
  --color-ink-dark: oklch(0.96 0.004 250);
  --color-ink-muted-dark: oklch(0.78 0.008 250);
  --color-ink-subtle-dark: oklch(0.62 0.010 250);
  --color-ink-tertiary-dark: oklch(0.48 0.008 250);

  /* === Borders (hairlines) === */
  --color-border: oklch(0.91 0.004 250);            /* default 1px hairline */
  --color-border-strong: oklch(0.86 0.005 250);     /* focused inputs */
  --color-border-subtle: oklch(0.94 0.003 250);     /* nested surfaces */
  --color-border-dark: oklch(0.30 0.008 250);
  --color-border-strong-dark: oklch(0.38 0.010 250);

  /* === Accent (single chromatic — Linear/Stripe discipline) === */
  --color-accent: oklch(0.62 0.18 280);             /* #635BFF-ish violet */
  --color-accent-hover: oklch(0.58 0.20 280);       /* slightly darker on hover */
  --color-accent-soft: oklch(0.62 0.18 280 / 0.08); /* tinted backgrounds */
  --color-accent-ink: oklch(1 0 0);                 /* text on accent */

  /* === Semantic (Stripe-style: ONE success, nothing else on the canvas) === */
  --color-success: oklch(0.65 0.16 145);            /* published, healthy, positive trend */
  --color-warning: oklch(0.72 0.15 75);             /* scheduled, pending, at-risk */
  --color-danger: oklch(0.60 0.20 25);              /* failed, error, negative trend */

  /* === Platform brand colors (used only for platform badges, not UI chrome) === */
  --color-instagram: oklch(0.65 0.20 350);          /* gradient — use real IG SVG */
  --color-telegram: oklch(0.62 0.15 240);           /* Telegram blue */
  --color-linkedin: oklch(0.50 0.13 255);           /* LinkedIn blue */
  --color-rubika: oklch(0.55 0.18 320);             /* Rubika magenta */
  --color-eitaa: oklch(0.50 0.15 165);              /* Eitaa teal */
}
```

**Contrast rule (Stripe's):** Any two colors at least 5 steps apart on the perceptual lightness scale (e.g., `0.55` and `0.95` differ by 40 lightness units = 5+ steps) have sufficient contrast for small text. Apply this when picking semantic color pairs.

### 8.5 Shadow System (Linear-tight, not amateur-heavy)

```css
@theme {
  /* Default card — NO shadow. Use surface ladder + hairline border. */

  /* Hovered card — minimal lift */
  --shadow-card-hover:
    0 1px 2px oklch(0.20 0.02 250 / 0.04),
    0 2px 4px oklch(0.20 0.02 250 / 0.04);

  /* Panel (default glass surface) */
  --shadow-panel:
    0 1px 2px oklch(0.20 0.02 250 / 0.04),
    0 4px 8px oklch(0.20 0.02 250 / 0.04),
    0 12px 24px oklch(0.20 0.02 250 / 0.06);

  /* Popover (strong glass, floating) */
  --shadow-popover:
    0 4px 8px oklch(0.20 0.02 250 / 0.06),
    0 8px 16px oklch(0.20 0.02 250 / 0.06),
    0 20px 40px oklch(0.20 0.02 250 / 0.08);

  /* Command palette (top of stack) */
  --shadow-command:
    0 8px 16px oklch(0.20 0.02 250 / 0.08),
    0 16px 32px oklch(0.20 0.02 250 / 0.08),
    0 32px 64px oklch(0.20 0.02 250 / 0.10);

  /* Drag (Stripe's "extra shadow when dragging a card") */
  --shadow-drag:
    0 8px 16px oklch(0.20 0.02 250 / 0.08),
    0 24px 48px oklch(0.20 0.02 250 / 0.12);

  /* Inset (for inputs, search bars) */
  --shadow-inset:
    inset 0 1px 2px oklch(0.20 0.02 250 / 0.04);
}
```

**Dark mode shadow adjustment:** In dark mode, shadows become near-invisible (you can't shadow a dark surface against a dark canvas). Replace with: brighter hairline border + subtle `box-shadow: 0 0 0 1px oklch(1 0 0 / 0.04)` outer glow + top-edge white highlight.

### 8.6 Motion Tokens (Linear-discipline)

```css
@theme {
  /* Durations (Linear's exact values) */
  --motion-instant: 0ms;      /* no animation, snap */
  --motion-quick: 100ms;      /* hovers, color shifts */
  --motion-regular: 150ms;    /* default transitions */
  --motion-slow: 250ms;       /* panel slides, popover open */
  --motion-deliberate: 400ms; /* view transitions, large morphs */

  /* Easings */
  --ease-standard: cubic-bezier(0.4, 0, 0.2, 1);     /* Linear's regular curve */
  --ease-emphasized: cubic-bezier(0.2, 0, 0, 1);     /* for entrances */
  --ease-decelerated: cubic-bezier(0, 0, 0.2, 1);    /* for exits */
  --ease-bouncy: cubic-bezier(0.34, 1.56, 0.64, 1);  /* for glass morphing, FAB */
  --ease-spring: cubic-bezier(0.5, 1.5, 0.5, 1);     /* for drags ending */
}
```

**Animation rules (Linear-derived):**
1. Only animate `transform`, `opacity`, `background-color`, `border-color`, `box-shadow`, `filter`. **Never** `width`, `height`, `margin`, `padding`, `top`, `left`, `right`, `bottom`.
2. Never use `transition: all`. Always list specific properties.
3. Hovers: `100ms` `--ease-standard`. Popover opens: `150ms` `--ease-standard`. Panel slides: `250ms` `--ease-emphasized`. Glass morphs: `400ms` `--ease-bouncy`.
4. Motion does spatial work: popovers scale from their origin pill; panels slide from their toggle; the command palette drops from the top with a slight scale.
5. No transitions on list items — they should snap.
6. Respect `prefers-reduced-motion`: disable all non-essential motion.

### 8.7 Spacing Scale (Linear 4px-base)

```css
@theme {
  --spacing-xxs: 4px;    /* tight icon-text gaps */
  --spacing-xs: 8px;     /* inline spacing, button icon gap */
  --spacing-sm: 12px;    /* form input vertical padding */
  --spacing-md: 16px;    /* default content padding */
  --spacing-lg: 24px;    /* card interior padding */
  --spacing-xl: 32px;    /* generous card padding */
  --spacing-xxl: 48px;   /* CTA banner padding */
  --spacing-section: 96px; /* between major sections */
}
```

**Component-specific:**
- Pill button padding: `8px 14px` (Linear's exact spec)
- Form input padding: `8px 12px` (Linear)
- Sidebar nav item: `8px 12px` (height 36px)
- Card padding: `24px` default, `20px` dense
- Section gap: `24px` within a panel, `48px` between sections

### 8.8 Border Radius Scale (Linear)

```css
@theme {
  --radius-xs: 4px;     /* chips, status badges */
  --radius-sm: 6px;     /* inline tags, small badges */
  --radius-md: 8px;     /* buttons, inputs */
  --radius-lg: 12px;    /* cards */
  --radius-xl: 16px;    /* panels, large cards */
  --radius-2xl: 20px;   /* glass panels (Liquid Glass prefers larger) */
  --radius-pill: 9999px;/* status pills, segmented controls */
  --radius-full: 9999px;/* avatars */
}
```

### 8.9 RTL-Specific Implementation

**Critical RTL rules for Nashrino:**

1. **`dir="rtl"` on `<html>`.** This flips the entire layout automatically. Sidebar goes right, content goes left. Don't manually flip with CSS — use logical properties (`margin-inline-start` not `margin-left`, `inset-inline-end` not `right`).

2. **Vazirmatn as primary font** with `font-feature-settings: "ss01" 1` for Vazirmatn's preferred Persian digit forms.

3. **Numbers in tables** right-align by default in RTL (mirrors LTR). Don't override.

4. **Icons:**
   - **Directional icons flip**: arrow-back, arrow-forward, chevron-left, chevron-right, send (paper plane), reply
   - **Symbolic icons don't flip**: settings gear, search magnifier, bell, plus, x, check, heart, bookmark, share

5. **Digits: Western for analytics, Persian for prose.** Most modern Persian apps (Digikala, Snapp, Aparat) use Western digits (`1234567`) for analytics and metrics — they're easier to scan in tabular contexts and align better with chart axis labels. Persian digits (`۱۲۳۴۵۶۷`) are used for prose content counts ("۳ پست جدید" = "3 new posts"). **Recommendation:** default to Western digits for all analytics/metrics, Persian digits for content counts in body copy. Provide a user setting to switch.

6. **Dual calendar support:** Jalali (Shamsi) primary, Gregorian toggle. Use the `persian-calendar-suite` npm package (complete Jalali calendar suite for React: datepicker, range picker, time range picker, event calendar, timeline). Months: فروردین، اردیبهشت، خرداد، تیر، مرداد، شهریور، مهر، آبان، آذر، دی، بهمن، اسفند. Week starts Saturday (شنبه).

7. **Date formatting:** "۱۴۰۳/۰۵/۱۵" or "15 مرداد 1403" — provide both formats in settings. For relative timestamps ("3 ساعت پیش" = "3 hours ago"), use Persian.

8. **Bidirectional text:** Persian text mixed with Latin (URLs, hashtags, @handles) needs proper Unicode bidi control. Wrap Latin runs in `<span dir="ltr">` or use the W3C bidi algorithm.

9. **Inputs:** `text-align: right` for Persian text inputs, `text-align: left` for URL/email/numeric inputs (Latin content). Auto-detect based on input type.

10. **Toast notifications:** Stack on the left in RTL (mirrors LTR right-stack).

### 8.10 Platform-Specific UI Patterns

For each of the 5 platforms, use the real brand SVG logo (already implemented per worklog). For platform-specific UI:

| Platform | Brand color | Connection type | Key UI consideration |
|---|---|---|---|
| Instagram | Gradient (use real SVG) | OAuth | Carousel posts need multi-image composer |
| Telegram | `#229ED9` | Bot API | Channels vs groups vs bots distinction |
| LinkedIn | `#0A66C2` | OAuth | Article vs post vs poll composer |
| Rubika | `#C724B1` (magenta) | Bot API | Iranian platform — first-class citizen, not "other" |
| Eitaa | `#2D9C6F` (teal) | Bot API | Iranian platform — same treatment as Rubika |

**Anti-pattern to avoid:** Don't group Rubika and Eitaa under "Other" or "More." They're first-class platforms for Nashrino's audience. Give them equal billing with Instagram/Telegram/LinkedIn in the sidebar, composer, and analytics.

### 8.11 Command Palette (⌘K) for Nashrino

**Scope of ⌘K:**
- Posts (draft/scheduled/published) — fuzzy search by content
- Platforms (jump to platform-specific view)
- Conversations (inbox threads)
- Analytics views (jump to specific chart/dashboard)
- Settings (jump to any settings section)
- Actions (Create post, Schedule post, Connect platform, Invite teammate, Toggle dark mode, etc.)
- People (teammates, connected accounts)

**Behavior:**
- ⌘K opens
- Fuzzy search across all of the above
- Recent items at top of empty query (last 5 viewed posts/conversations)
- Grouped results: Pages, Posts, Conversations, Actions, Settings
- Keyboard hints on every item (`↵` to select, `⌘↵` to open in new tab)
- `Esc` closes
- `?` opens keyboard shortcut help (separate modal)

### 8.12 Loading / Empty / Error States

**Empty states (Vercel/Geist 5 variants):**

| Variant | When | CTA |
|---|---|---|
| Blank Slate | First-time user, no posts | "Create Your First Post" |
| Informational | Has posts but no scheduled | "Schedule a Post" + docs link |
| Educational | First time in Analytics | "Start Tour" + "Skip" |
| No-Results | Filter returned 0 posts | "Clear Filters" |
| Error | Failed to load | "Try Again" + copyable request ID |
| Permission | Free-tier user hits Pro feature | "Upgrade to Pro" |
| Empty Inbox | Inbox zero | "You're all caught up" (no CTA — this is a success state) |

**Loading states:**
- First page load: skeleton screens matching final layout, 200-400ms max
- After data loaded: never show spinner for same data — mutate in place
- Mutations: optimistic, with subtle "saving…" indicator (corner badge)
- Long operations (publish to 5 platforms): progress card in corner, platform-by-platform status

---

## 9. Anti-Patterns to AVOID

### 9.1 Glass Morphism Mistakes (the amateur tells)

1. **Glass on glass on glass.** Stacking three translucent layers produces a muddy gray mess. Apple is explicit: never stack glass on glass. **One glass layer per visual stack.**

2. **Glass on content.** Putting glass on every card, every list, every table cell. Glass is for navigation; content is solid.

3. **Too transparent.** Glass at 50% opacity over a busy chart is unreadable. Linear uses 80%+ opacity. Apple's Regular variant is "medium" but adaptively blurs. **Minimum 70% opacity for any glass surface that has text on it.**

4. **Too much blur.** 60px+ backdrop blur kills performance (especially on mobile) and produces a "Vaseline smear" look. Linear uses 24-32px. Apple's Liquid Glass uses adaptive blur. **Cap at 40px for popovers, 32px for panels, 20px for thin controls.**

5. **No edge definition.** Glass without a 1px hairline border has no boundary — it just fades into the background. Every glass surface needs a 1px border (lighter on top edge for highlight, darker on bottom for shadow).

6. **No specular highlight.** Real glass catches light. Without a subtle top-edge sheen, glassmorphism looks flat. Add `::before` pseudo-element with `linear-gradient(180deg, rgba(255,255,255,0.65) 0%, rgba(255,255,255,0.18) 50%, rgba(255,255,255,0) 100%)`.

7. **Heavy shadows.** `box-shadow: 0 24px 48px rgba(0,0,0,0.20)` is amateur. Linear's entire shadow system is 6% opacity total. Cap ambient floor at 8% opacity.

8. **Glass over glass over a colorful gradient mesh.** The "4-bloom ambient mesh" pattern (violet/peach/mint/rose blooms behind glass) is the most-copied amateur pattern. It looks impressive in a screenshot but reads as decorative, not functional. Linear and Apple both: subtle 2-tone ambient at most, or none.

9. **Animated glass.** Continuously animating glass (rotating, pulsing, shifting) drains battery (Apple: 13% vs 1% for static) and looks distracting. Glass rests in steady states.

10. **Glass for the sake of glass.** If a solid surface would do the job, use a solid surface. Glass should solve a specific problem (showing depth, letting content peek through, unifying navigation across content types).

### 9.2 Dashboard Mistakes

1. **Rainbow charts.** Using 7 colors for 7 series in a chart. Stripe uses 1 accent + 2 grays. Linear uses 1 accent + neutrals. **Max 3 colors per chart; use line style (dashed/dotted) or labels for additional series.**

2. **Center-aligned numbers.** Numbers in tables should be right-aligned (left in RTL — which is also "right" visually since the table is flipped). Center-aligned numbers don't line up at the decimal.

3. **Proportional figures in tables.** Without `tabular-nums`, the `1` is narrower than the `8`, so column alignment shifts as numbers change. Always `tabular-nums` for numeric table cells.

4. **Spinners everywhere.** Showing a spinner for every data fetch. Use optimistic UI; show last-known data; mutate in place.

5. **Empty states with no CTA.** "No data" with no action is a dead end. Every empty state needs a clear next step.

6. **Empty states with three CTAs.** "Create Post / Import / Watch Tutorial" is overwhelming. One primary CTA, maybe one secondary. Three is a smell.

7. **Generic loading screens.** A centered spinner on a blank page. Use skeleton screens matching the final layout shape.

8. **Modal stacking.** Opening a modal over a modal over a modal. Flatten with side panels, inline expansions, or wizards.

9. **Density without hierarchy.** Cramming 50 metrics on screen with no visual hierarchy. Pick 1 hero metric, 3-4 secondary, push the rest into a table.

10. **Decorative animations.** Bouncing logos, pulsing buttons, sliding carousels. In a tool used 8+ hours/day, decorative animation becomes noise. Every animation should do spatial work (show where something came from, where it's going, what state it's in).

### 9.3 Persian RTL Mistakes

1. **Manually flipping with `margin-left` / `margin-right`.** Use logical properties (`margin-inline-start/end`). With `dir="rtl"`, they auto-flip.

2. **Forgetting to flip directional icons.** `arrow-right` for "back" in LTR becomes `arrow-left` for "back" in RTL. Use a `flip-rtl` utility or manually swap.

3. **Persian digits in analytics.** Persian digits (`۱۲۳۴۵۶۷`) are harder to compare at a glance than Western digits (`1234567`) because they're less familiar in tabular contexts. Use Western for analytics, Persian for prose.

4. **Latin text breaking RTL flow.** URLs, email addresses, @handles, hashtags in Persian text need `<bdi>` or `<span dir="ltr">` wrappers to render correctly.

5. **Wrong calendar.** Forcing Gregorian dates on Persian users. Always offer Jalali primary, Gregorian toggle.

6. **Wrong week start.** Gregorian calendars start Sunday; Jalali starts Saturday (شنبه). Calendar widget must respect this.

7. **Missing Persian font.** Using a Latin-only font for Persian text produces broken rendering (Persian requires connecting forms). Vazirmatn is the standard.

8. **Letter-spacing on Persian.** `letter-spacing: -0.5px` on Persian text breaks the script's connected forms. Apply letter-spacing only to Latin/numeric runs.

9. **Forgetting `lang="fa"`.** Without `lang="fa"` on the HTML element, screen readers and search engines can't identify the language.

10. **Mixed-direction inputs.** A Persian text input that doesn't handle Latin URL paste correctly. Use `dir="auto"` on text inputs to auto-detect direction.

---

## 10. Design Tokens — Concrete Recommendation Table

The following is the consolidated, production-ready token set for Nashrino. All color values are in OKLCH (perceptually uniform, like Linear and Stripe use). All sizes in px. All shadows are layered (per Linear's discipline).

### 10.1 Color Tokens

```css
@theme {
  /* === Theme inputs (Linear's 3-variable pattern) === */
  --base: oklch(0.985 0.004 250);
  --accent: oklch(0.62 0.18 280);
  --contrast: 0.30;

  /* === Canvas === */
  --color-canvas: oklch(0.985 0.004 250);
  --color-canvas-dark: oklch(0.16 0.006 250);

  /* === Surface ladder (4 tiers) === */
  --color-surface: oklch(1 0 0);
  --color-surface-subtle: oklch(0.96 0.004 250);
  --color-surface-hover: oklch(0.94 0.005 250);
  --color-surface-active: oklch(0.92 0.02 280 / 0.4);
  --color-surface-dark: oklch(0.20 0.006 250);
  --color-surface-subtle-dark: oklch(0.24 0.007 250);

  /* === Text (4 tiers, Linear-style) === */
  --color-ink: oklch(0.20 0.02 250);
  --color-ink-muted: oklch(0.40 0.015 250);
  --color-ink-subtle: oklch(0.55 0.012 250);
  --color-ink-tertiary: oklch(0.70 0.008 250);
  --color-ink-dark: oklch(0.96 0.004 250);
  --color-ink-muted-dark: oklch(0.78 0.008 250);
  --color-ink-subtle-dark: oklch(0.62 0.010 250);
  --color-ink-tertiary-dark: oklch(0.48 0.008 250);

  /* === Borders === */
  --color-border: oklch(0.91 0.004 250);
  --color-border-strong: oklch(0.86 0.005 250);
  --color-border-subtle: oklch(0.94 0.003 250);
  --color-border-dark: oklch(0.30 0.008 250);
  --color-border-strong-dark: oklch(0.38 0.010 250);

  /* === Accent === */
  --color-accent: oklch(0.62 0.18 280);
  --color-accent-hover: oklch(0.58 0.20 280);
  --color-accent-soft: oklch(0.62 0.18 280 / 0.08);
  --color-accent-ink: oklch(1 0 0);

  /* === Semantic (Stripe's "one of each" rule) === */
  --color-success: oklch(0.65 0.16 145);
  --color-success-soft: oklch(0.65 0.16 145 / 0.08);
  --color-warning: oklch(0.72 0.15 75);
  --color-warning-soft: oklch(0.72 0.15 75 / 0.08);
  --color-danger: oklch(0.60 0.20 25);
  --color-danger-soft: oklch(0.60 0.20 25 / 0.08);

  /* === Glass materials === */
  --glass-panel: oklch(1 0 0 / 0.80);     /* default glass */
  --glass-panel-strong: oklch(1 0 0 / 0.86);
  --glass-panel-thin: oklch(1 0 0 / 0.70);
  --glass-panel-veil: oklch(1 0 0 / 0.55);
  --glass-border-outer: oklch(0 0 0 / 0.06);
  --glass-border-inner: oklch(1 0 0 / 0.65);
  --glass-specular: linear-gradient(180deg,
    oklch(1 0 0 / 0.65) 0%,
    oklch(1 0 0 / 0.18) 50%,
    oklch(1 0 0 / 0) 100%);

  /* === Platform brand (only for platform badges) === */
  --color-instagram: oklch(0.65 0.20 350);
  --color-telegram: oklch(0.62 0.15 240);
  --color-linkedin: oklch(0.50 0.13 255);
  --color-rubika: oklch(0.55 0.18 320);
  --color-eitaa: oklch(0.50 0.15 165);
}
```

### 10.2 Typography Tokens

```css
@theme {
  --font-sans: 'Vazirmatn', 'Geist Sans', system-ui, sans-serif;
  --font-mono: 'Geist Mono', ui-monospace, monospace;

  /* Type scale */
  --text-display-xl: 48px;
  --text-display-lg: 36px;
  --text-display-md: 28px;
  --text-heading: 22px;
  --text-subhead: 18px;
  --text-body: 14px;
  --text-body-sm: 13px;
  --text-caption: 12px;
  --text-label: 11px;
  --text-button: 13px;
  --text-metric: 22px;
  --text-mono: 12px;

  /* Weights */
  --weight-regular: 400;
  --weight-medium: 500;
  --weight-semibold: 600;
  --weight-bold: 700;

  /* Line heights */
  --leading-tight: 1.05;
  --leading-snug: 1.20;
  --leading-normal: 1.50;
  --leading-relaxed: 1.60;  /* for Persian body */
  --leading-loose: 1.80;
}

@utility num-tabular {
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum" 1, "lnum" 1;
}
```

### 10.3 Spacing Tokens

```css
@theme {
  --spacing-0: 0;
  --spacing-xxs: 4px;
  --spacing-xs: 8px;
  --spacing-sm: 12px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;
  --spacing-xxl: 48px;
  --spacing-section: 96px;

  /* Component-specific */
  --spacing-button-y: 8px;
  --spacing-button-x: 14px;
  --spacing-input-y: 8px;
  --spacing-input-x: 12px;
  --spacing-card: 24px;
  --spacing-card-dense: 20px;
  --spacing-section-gap: 24px;
  --spacing-section-gap-lg: 48px;
}
```

### 10.4 Radius Tokens

```css
@theme {
  --radius-xs: 4px;
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-2xl: 20px;
  --radius-pill: 9999px;
  --radius-full: 9999px;
}
```

### 10.5 Shadow Tokens

```css
@theme {
  --shadow-none: none;

  --shadow-card-hover:
    0 1px 2px oklch(0.20 0.02 250 / 0.04),
    0 2px 4px oklch(0.20 0.02 250 / 0.04);

  --shadow-panel:
    0 1px 2px oklch(0.20 0.02 250 / 0.04),
    0 4px 8px oklch(0.20 0.02 250 / 0.04),
    0 12px 24px oklch(0.20 0.02 250 / 0.06);

  --shadow-popover:
    0 4px 8px oklch(0.20 0.02 250 / 0.06),
    0 8px 16px oklch(0.20 0.02 250 / 0.06),
    0 20px 40px oklch(0.20 0.02 250 / 0.08);

  --shadow-command:
    0 8px 16px oklch(0.20 0.02 250 / 0.08),
    0 16px 32px oklch(0.20 0.02 250 / 0.08),
    0 32px 64px oklch(0.20 0.02 250 / 0.10);

  --shadow-drag:
    0 8px 16px oklch(0.20 0.02 250 / 0.08),
    0 24px 48px oklch(0.20 0.02 250 / 0.12);

  --shadow-inset:
    inset 0 1px 2px oklch(0.20 0.02 250 / 0.04);

  /* Dark mode shadows (near-invisible, use border + glow instead) */
  --shadow-panel-dark: 0 0 0 1px oklch(1 0 0 / 0.04);
  --shadow-popover-dark:
    0 0 0 1px oklch(1 0 0 / 0.06),
    0 4px 8px oklch(0 0 0 / 0.20);
}
```

### 10.6 Motion Tokens

```css
@theme {
  --motion-instant: 0ms;
  --motion-quick: 100ms;
  --motion-regular: 150ms;
  --motion-slow: 250ms;
  --motion-deliberate: 400ms;

  --ease-standard: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-emphasized: cubic-bezier(0.2, 0, 0, 1);
  --ease-decelerated: cubic-bezier(0, 0, 0.2, 1);
  --ease-bouncy: cubic-bezier(0.34, 1.56, 0.64, 1);
  --ease-spring: cubic-bezier(0.5, 1.5, 0.5, 1);
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

### 10.7 Z-Index Scale

```css
@theme {
  --z-base: 0;
  --z-content: 10;
  --z-sidebar: 20;
  --z-header: 30;
  --z-dropdown: 40;
  --z-popover: 50;
  --z-modal-backdrop: 60;
  --z-modal: 70;
  --z-command-palette: 80;
  --z-toast: 90;
  --z-tooltip: 100;
}
```

### 10.8 Glass Material Utility Classes

```css
@utility n-panel {
  background: var(--glass-panel);
  backdrop-filter: blur(32px) saturate(1.8);
  -webkit-backdrop-filter: blur(32px) saturate(1.8);
  border: 1px solid var(--glass-border-outer);
  box-shadow: var(--shadow-panel);
  position: relative;
}
@utility n-panel::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: var(--glass-specular);
  pointer-events: none;
  opacity: 0.6;
}

@utility n-panel-strong {
  background: var(--glass-panel-strong);
  backdrop-filter: blur(40px) saturate(1.9);
  -webkit-backdrop-filter: blur(40px) saturate(1.9);
  border: 1px solid var(--glass-border-outer);
  box-shadow: var(--shadow-popover);
  position: relative;
}

@utility n-panel-thin {
  background: var(--glass-panel-thin);
  backdrop-filter: blur(20px) saturate(1.6);
  -webkit-backdrop-filter: blur(20px) saturate(1.6);
  border: 1px solid var(--glass-border-outer);
  position: relative;
}

@utility n-panel-veil {
  background: var(--glass-panel-veil);
  backdrop-filter: blur(12px) saturate(1.4);
  -webkit-backdrop-filter: blur(12px) saturate(1.4);
}

@utility glass-hover {
  transition: background-color var(--motion-quick) var(--ease-standard),
              box-shadow var(--motion-regular) var(--ease-standard);
}
@utility glass-hover:hover {
  background: oklch(1 0 0 / 0.85);
  box-shadow: var(--shadow-popover);
}
```

---

## Appendix A: Sources Consulted

**Linear:**
- linear.app DESIGN.md (VoltAgent/awesome-design-md) — full extracted token set
- "How we redesigned the Linear UI (part Ⅱ)" — Linear blog (Karri Saarinen, Yann-Edern Gillet, Andreas Eldh, Romain Cascino)
- FontOfWeb extracted tokens (linear.app) — slate/gray ramps with contrast ratios
- "How's Linear so fast? A technical breakdown" — performance.dev
- "Linear design: The SaaS design trend" — LogRocket
- Linear keyboard shortcuts — KeyCombiner

**Vercel/Geist:**
- geist-ui.dev typography documentation — full Tailwind class list
- Geist Font page — cap metrics, installation, font-feature-settings
- designsystems.one Geist breakdown — token snapshot, known-for/underrated/watch-out
- Geist Empty State documentation — 5 variants, content rules, CTA rules

**Stripe:**
- "Designing accessible color systems" — stripe.com/blog (Daryl Koopersmith, Wilson Miner) — CIELAB color system
- Stripe brand color palette — Mobbin (#0A2540, #F6F9FC, #635BFF)
- "Exploring the Product Design of the Stripe Dashboard for iPhone" — Michaël Villar (Medium)
- Stripe DESIGN.md analysis — getdesign.md
- Refero Styles Stripe analysis
- MDN `font-variant-numeric` documentation — tabular-nums implementation
- "Facts about figures: numeric styles with OpenType features" — Medium

**Apple Liquid Glass:**
- developer.apple.com/design — Liquid Glass collection, Materials page
- WWDC25 Session 219 "Meet Liquid Glass" notes — variants, tinting, when to use
- "iOS 26 Liquid Glass: Comprehensive Swift/SwiftUI Reference" — Conor Luddy (conor.fyi/writing/liquid-glass-reference)
- "App Design Liquid Glass: Redefining design through Hierarchy, Harmony and Consistency" — Alice Milo (cws-ghost)
- ArtVersion "Through the Looking UI: Diving into Liquid Glass" — specular highlights, 120fps physics

**Apple visionOS / macOS Materials:**
- Apple HIG Materials page — visionOS `.glass` material, macOS semantic materials, blending modes
- Pixel Envy "Sidebar: Translucency" — background-window opacity rule

**shadcn/ui:**
- "What is the difference between Default and New York style in shadcn/ui?" — shadcndesign.com (full component-by-component comparison)
- shadcn/ui data table patterns — TanStack Table + cmdk
- shadcnstudio cmdk-search demo

**Dashboard UX patterns:**
- "Designing a Command Palette" — Destiner's notes
- Vercel empty state — vercel.com/geist/empty-state
- Empty State UX Examples — Pencil & Paper
- NN/G "Designing Empty States in Complex Applications"

**Persian/RTL:**
- Vazirmatn GitHub (rastikerdar/vazirmatn) — font project
- Vazirmatn Google Fonts — Figma integration
- W3C Arabic & Persian Layout Requirements (alreq)
- Eastern Arabic numerals — Wikipedia
- "RTL design guide for developers" — simplelocalize.io
- persian-calendar-suite — npm package for Jalali calendar
- MUI X date pickers Jalali adapter

---

## Appendix B: Quick-Reference Cheat Sheet

**When in doubt:**
- Glass on nav, solid on content
- One accent, monochrome canvas
- OKLCH, not HSL
- Tabular-nums on every number
- Linear-tight shadows (6% opacity total), not amateur-heavy (24%+ opacity)
- Animate transform/opacity only
- 100ms hovers, 150ms panels, 250ms page transitions
- ⌘K for everything
- Optimistic UI, never spinners
- Empty states with one CTA, verb+noun labels
- Vazirmatn for Persian, Geist for Latin/numerics
- Western digits for analytics, Persian for prose
- Jalali calendar primary, Gregorian toggle
- Logical properties (`margin-inline-start`), not physical (`margin-left`)
- 4px base spacing, 8 named tokens
- 1px hairlines, not heavy borders
- One glass layer per visual stack — never glass on glass

---

*End of report. This document is the actionable design-systems research foundation for the Nashrino refactor. Every value above is sourced from a real production design system (Linear, Vercel/Geist, Stripe, Apple HIG) — none are invented. Apply directly to the Tailwind v4 `@theme` block in `globals.css` and propagate through component refactor.*
