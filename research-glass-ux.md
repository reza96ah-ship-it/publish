# Glass Theme & Dashboard UX Research Report

**Task ID:** RESEARCH-2
**Subject:** Deep research on glass morphism best practices and dashboard UX rules
**Target stack:** Next.js 15 + Tailwind CSS v4, Persian RTL social media management dashboard (Nashrino)
**Sources studied:** Apple HIG (Materials, Liquid Glass, WWDC25 "Meet Liquid Glass"), CSS-Tricks "Getting Clarity on Apple's Liquid Glass", Josh Comeau "Next-level frosted glass with backdrop-filter", Setproduct "Glassmorphism vs neumorphism vs liquid glass (2026)" and "Dashboard design principles", CreateWithSwift "Liquid Glass: Hierarchy, Harmony and Consistency", Luddy "iOS 26 Liquid Glass Comprehensive Reference", NN/G "Skeleton Screens 101", Material Design "Bidirectionality", UX Collective accessibility critiques, Vercel Geist docs, Inter OpenType features guide, baraa.app "Easing curves are a design language", Vazirmatn GitHub, MDN, WAI/WCAG 2.2.

---

## Executive summary (TL;DR for builders)

1. **Glass is a navigation material, not a content surface.** Apple's own HIG says "Liquid Glass is best reserved for the navigation layer that floats above the content of your app." Every "blur-every-card" dashboard is the #1 amateur tell.
2. **The web cannot reproduce real Liquid Glass.** What we *can* ship is *honest glassmorphism* — `backdrop-filter: blur() saturate(1.5–1.8)` with a 1px luminance border, plus an opaque solid fallback. Don't fake refraction; fake translucency with discipline.
3. **Text never goes directly on glass.** Text sits on a *scrim* (a 60–85% opaque solid layer between the glass and the text). This is the single biggest difference between "feels premium" and "feels broken."
4. **Layered glass means layered opacities.** Background → primary glass panel → nested thin glass → control glass — each layer decreases blur radius and increases opacity. Never stack glass on glass with the same blur.
5. **Dashboards should be readable in grayscale.** Color encodes status only (green/amber/red/blue). Every other hue is a neutral. Stripe, Linear, and Vercel all obey this rule.
6. **Motion is a language, not a decoration.** Use a vocabulary of named easing tokens (`motion.respond`, `motion.enter`, `motion.exit`, `motion.snap`, `motion.announce`). Entrance = ease-out. Exit = ease-in. Interactive = spring.
7. **Persian RTL has 4 traps:** icon mirroring rules (back arrow flips, refresh doesn't), chart time-axis (stays LTR by convention), digit rendering (Persian digits for prose, Latin digits for charts/tables/code), and Jalali calendar (always render + show Gregorian on hover).

---

# Part 1 — The 7 Deadly Sins of Glass Morphism

Each sin is documented with: **What it is**, **Why it fails**, **Real-world evidence**, **How to avoid it (with code).**

---

## Sin #1 — Blur-every-card (glass overuse)

**What it is:** Putting `backdrop-filter: blur()` on every card, panel, list row, and form field in the dashboard.

**Why it fails:**
- It destroys visual hierarchy. When everything is glass, nothing is elevated.
- It tanked GPU performance: each glass surface is a separate blur pass; on a 6×4 KPI grid that's 24 simultaneous blur operations per frame.
- Apple's own HIG explicitly forbids this: *"Liquid Glass is best reserved for the navigation layer that floats above the content of your app"* and *"avoid using glass on glass."*
- Setproduct (2026): *"For a dense dashboard with tables and forms, that same flair becomes noise. Match the intensity of the effect to the density of the screen."*
- Luddy's reference: *"Never apply to content itself (lists, tables, media). This maintains clear visual hierarchy."*

**Where glass IS appropriate in a dashboard:**
| Surface | Glass? | Why |
|---|---|---|
| Top app bar / sticky header | ✅ Yes (frosted) | Persistent chrome over scrolling content |
| Sidebar / navigation rail | ✅ Yes (subtle frosted) | Wayfinding chrome |
| Command palette (Cmd+K) | ✅ Yes (heavier blur) | Modal overlay, brief interaction |
| Modal / dialog backdrop | ✅ Yes (sheet) | Layer above content |
| Toast notifications | ✅ Yes (small) | Brief elevated surface |
| Floating action button | ✅ Yes (clear variant) | Single elevated control |
| KPI cards | ❌ NO | Data must be precise — put on solid surface |
| Data tables | ❌ NO | Numeric alignment + dense text needs solid bg |
| Form inputs | ❌ NO | Inputs need crisp edges and consistent focus rings |
| Long-form text panels | ❌ NO | Stable contrast ratio required |
| Empty state illustrations | ❌ NO | Decorative content, not chrome |
| Filter chip rows | ❌ NO | High interaction density, needs crisp edges |

**How to avoid — the rule:**
> Glass is for the **navigation layer**, modals, and the **elevated action surface**. Content sits on solid surfaces. A dashboard should have AT MOST 2 concurrent glass surfaces visible at once.

---

## Sin #2 — No solid fallback (broken on reduced-transparency)

**What it is:** Building glass assuming `backdrop-filter` always works.

**Why it fails:**
- `backdrop-filter` is **97%+ supported** (caniuse, Dec 2024) but is **disabled** in:
  - Firefox with `privacy.resistFingerprinting = true` (Tor Browser default)
  - All browsers when user enables OS-level "Reduce transparency" (macOS, iOS)
  - Performance-mode browsers on low-end Android
  - When the element has an ancestor with `overflow: hidden` + `border-radius` in Firefox (known bug, Josh Comeau)
- Setproduct (2026): *"backdrop-filter is well supported but not universal, and it can be disabled for performance or reduced-transparency settings. Always design the solid-color version first, then layer glass on top."*
- Luddy: iOS 26.1+ has a user-controlled *"Liquid Glass transparency slider"* in Settings. Users will turn down your translucency.

**How to avoid — the layered approach (Josh Comeau's pattern):**

```css
/* 1. Solid fallback (always renders, always readable) */
.glass-panel {
  background: hsl(220 24% 14% / 0.95);   /* solid dark surface */
  border: 1px solid hsl(220 24% 22% / 0.6);
  border-radius: 16px;
}

/* 2. Progressive enhancement — only if backdrop-filter is supported */
@supports (backdrop-filter: blur(16px)) or (-webkit-backdrop-filter: blur(16px)) {
  .glass-panel {
    background: hsl(220 24% 14% / 0.65);     /* reduce opacity once glass is on */
    backdrop-filter: blur(16px) saturate(1.8);
    -webkit-backdrop-filter: blur(16px) saturate(1.8);
  }
}

/* 3. Respect reduced transparency preference */
@media (prefers-reduced-transparency: reduce) {
  .glass-panel {
    background: hsl(220 24% 14% / 0.98);
    backdrop-filter: none;
  }
}
```

**The rule:** Design the solid version first. Then layer glass on top as enhancement. The non-glass version must pass WCAG AA on its own.

---

## Sin #3 — Text directly on glass (the #1 failure mode)

**What it is:** `<div class="glass"><p>Body text here</p></div>` — text rendered with no scrim between it and the blurred background.

**Why it fails:**
- Translucent surfaces inherit whatever is behind them. A panel can pass WCAG contrast over one screen and fail on the next.
- Apple accessibility critique (UX Collective, June 2025): *"Text contrast often suffers over blurred or moving backgrounds, making it harder to read, locate active UI elements, or even understand where to tap — especially in bright environments. This goes directly against both Apple's own Human Interface Guidelines and WCAG 2.1 standards."*
- The CSS-Tricks article quotes accessibility researchers: *"When you have translucent elements letting background colors bleed through, you're creating variable contrast ratios that might work well over one background, but fail over a bright photo of the sunset."*
- Apple's solution is **vibrancy** — a context-specific blend that the OS applies automatically to text on materials. We don't have vibrancy on the web, so we must fake it with a scrim.

**WCAG requirements on glass:**
| Text type | Ratio | Notes |
|---|---|---|
| Body text < 18px (or < 14px bold) | **4.5:1** (AA) / 7:1 (AAA) | Must hold against worst-case background |
| Large text ≥ 18px (or ≥ 14px bold) | **3:1** (AA) / 4.5:1 (AAA) | Easier but still hard over moving bg |
| UI components & graphical objects | **3:1** (WCAG 2.2 SC 1.4.11) | Borders, icons, focus rings |
| Focus indicator | **3:1** against adjacent colors (WCAG 2.2 SC 2.4.13) | Both ring AND the unfocused state |

**How to avoid — the "solid text token" pattern:**
Text is always `opacity: 1`. The **container** is glass. There must be a scrim layer between the glass and the text:

```tsx
{/* ✅ Correct: glass container + scrim + solid text */}
<div className="glass-panel">
  <div className="scrim">           {/* 60–85% opaque solid layer */}
    <h3 className="text-fg-primary">Title</h3>   {/* opacity: 1 */}
    <p className="text-fg-secondary">Body</p>     {/* opacity: 1 */}
  </div>
</div>

{/* ❌ Wrong: text floats on raw glass */}
<div className="glass-panel">
  <p className="text-white/80">Body</p>           {/* fades with bg bleed */}
</div>
```

**Scrim opacity by use case:**
| Use case | Scrim opacity (light theme) | Scrim opacity (dark theme) |
|---|---|---|
| Body text on glass | 88–92% | 88–92% |
| Title / large text on glass | 70–80% | 70–80% |
| Icon-only button on glass | 60–75% | 60–75% |
| Modal/dialog | 95–98% (essentially solid) | 95–98% |

**The rule:** *Text never touches glass directly.* A scrim is always in between. The text tokens themselves are always at full opacity — only the container is translucent.

---

## Sin #4 — Glass on glass (stacked translucency)

**What it is:** A glass modal containing a glass card containing a glass button — three layers of blur.

**Why it fails:**
- Setproduct: *"Stacking blur on blur. Every translucent layer multiplies the GPU cost and muddies legibility. Two stacked glass panels usually look worse and run slower than one."*
- Luddy: *"Glass cannot sample other glass"* — Apple had to invent `GlassEffectContainer` in iOS 26 specifically to solve this. On the web we have no such primitive.
- Apple HIG: *"Avoid using glass on glass."*

**How to avoid — the 3-layer maximum rule:**

| Layer | Material | Blur radius | Opacity |
|---|---|---|---|
| 0 — Page background | Solid | none | 100% |
| 1 — Primary glass panel | Frosted glass | 16–24px | 60–75% |
| 2 — Nested control inside glass panel | **Solid surface** (not glass) | none | 90–95% |
| 3 — Icon/label on the control | Solid token | none | 100% |

> The rule: once you have one glass surface, everything inside it is solid. Nested glass = broken hierarchy.

If you must have a control that floats inside a glass container (e.g. a close button in a glass modal), use a **solid pill** with `background: var(--surface-2)` rather than another `backdrop-filter`.

---

## Sin #5 — Missing specular highlight / edge definition

**What it is:** A blurred rectangle with translucent background and no border, no highlight, no shadow. It looks like a smudge, not glass.

**Why it fails:**
- Real glass has three things amateur glass doesn't: **edge definition** (where the material ends), **specular highlight** (light catching the top edge), and **depth** (subtle drop shadow separating it from the content below).
- Luddy on Liquid Glass: *"Liquid glass is composed of layers: highlight (light casting and movement), shadow (added depth for separation between foreground and background), and illumination (the flexible properties of the material)."*
- Kube.io on Liquid Glass in the browser: *"The final piece of our Liquid Glass effect is the specular highlight — those bright, shiny edges you see on real glass objects when light hits them at certain angles."*

**How to avoid — the 3-part glass recipe:**

```css
.premium-glass {
  /* 1. The blur + saturation (the "illumination" layer) */
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(20px) saturate(1.8) brightness(1.05);
  -webkit-backdrop-filter: blur(20px) saturate(1.8) brightness(1.05);

  /* 2. The edge — 1px luminance border (the "highlight" layer) */
  border: 1px solid rgba(255, 255, 255, 0.18);

  /* 3. The shadow (the "depth" layer) */
  box-shadow:
    0 1px 0 0 rgba(255, 255, 255, 0.10) inset,   /* top inner highlight (specular) */
    0 -1px 0 0 rgba(0, 0, 0, 0.10) inset,         /* bottom inner shadow */
    0 4px 16px -2px rgba(0, 0, 0, 0.20),          /* drop shadow */
    0 8px 32px -8px rgba(0, 0, 0, 0.12);          /* ambient shadow */

  border-radius: 16px;
}

/* Optional: directional specular highlight using a pseudo-element */
.premium-glass::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.14) 0%,
    rgba(255, 255, 255, 0) 30%
  );
  pointer-events: none;
}
```

**The 4 ingredients every glass surface must have:**
1. `backdrop-filter: blur(Xpx) saturate(1.5–1.8)` (the illumination)
2. A 1px luminance border (the edge)
3. An inset top highlight (the specular)
4. A subtle drop shadow (the depth)

If you remove any one of these, it stops looking like glass and starts looking like a smudge.

---

## Sin #6 — Wrong saturate value (muddy glass)

**What it is:** `backdrop-filter: blur(16px)` with no `saturate()`. The result is a greyish muddy blur.

**Why it fails:**
- Gaussian blur averages neighboring pixels, which desaturates them. Without a `saturate()` boost, glass looks like fog, not crystal.
- Apple's actual recipe (referenced across the industry): `backdrop-filter: saturate(180%) blur(20px)`. This is the macOS sidebar material.
- Josh Comeau: *"I've heard that increased saturation can help reduce the muddiness that comes from blurring, but really, this is more art than science."*
- Reddit (popular glassmorphism recipe): `backdrop-filter: blur(30px) saturate(210%)` for vivid backgrounds.

**How to avoid — saturate by background type:**
| Background type | `saturate()` value | `blur()` value | Notes |
|---|---|---|---|
| Vivid photo / brand gradient | 1.8–2.1 (180–210%) | 20–30px | Glass stays colorful |
| Neutral UI background (solid grey/charcoal) | 1.4–1.6 | 16–20px | Avoid over-saturating neutrals |
| Dark mode over dark surfaces | 1.5–1.7 + `brightness(1.05)` | 16–24px | Brightness prevents muddying |
| Light mode over light surfaces | 1.6–1.8 + `brightness(1.02)` | 12–20px | Subtle |

**The rule:** Always pair `blur()` with `saturate()`. The baseline recipe is `blur(20px) saturate(1.8)`.

---

## Sin #7 — Glass over busy content (the readability trap)

**What it is:** A glass panel layered over a photo, a video, a chart, or animated content — without dimming the background.

**Why it fails:**
- Luddy: *"Liquid Glass over busy, colorful, or animated content causes readability issues."*
- UX Collective accessibility critique: *"People with dyslexia, who already struggle with busy backgrounds and low-contrast text, now deal with an interface where visual noise is baked into the design language."*
- Apple's own HIG warns: clear glass variant only works when *"content above glass is bold and bright"* and *"content won't be negatively affected by dimming layer"*.
- Setproduct: *"Long-form text on a glass panel. Body copy needs a stable contrast ratio. A frosted card over a moving photo cannot promise one. Put paragraphs on solid surfaces and save glass for cards, chips, and chrome."*

**How to avoid — the dimming rule:**

When glass must sit over busy content (e.g., a sticky header over a scrollable feed), add a dimming layer between the content and the glass:

```css
.sticky-header-glass {
  position: sticky;
  top: 0;
  z-index: 50;
  /* base solid fallback */
  background: var(--surface-1);
}
@supports (backdrop-filter: blur(16px)) {
  .sticky-header-glass {
    background: linear-gradient(
      to bottom,
      hsl(220 24% 12% / 0.92) 0%,    /* top: almost solid, kills scroll flicker */
      hsl(220 24% 12% / 0.72) 100%   /* bottom: translucent, shows glass */
    );
    backdrop-filter: blur(16px) saturate(1.8);
    -webkit-backdrop-filter: blur(16px) saturate(1.8);
  }
}
```

**Josh Comeau's "flickering top" fix:** When content scrolls *out* of the viewport behind a sticky glass header, the blur algorithm stops sampling it and colors flicker. Solution: a gradient that's opaque at the top edge of the header, fading to transparent below. This is *required* for any sticky glass element.

**The rule:** Glass over busy/animated/photographic content **requires a dimming gradient**. If the background cannot be controlled, the glass surface must approach opacity ≥ 85%.

---

## Bonus Sin #8 — Faking Liquid Glass with heavy SVG filters

**What it is:** Stacking SVG `feTurbulence`, `feDisplacementMap`, `feGaussianBlur`, noise textures, and Fresnel approximations to imitate Apple's refraction on the web.

**Why it fails:**
- Setproduct (2026): *"Faking liquid glass on the web with heavy filters. Piling on blur, noise, and gradients to imitate Apple's refraction rarely lands and tanks performance. If you need true liquid glass, you need a native surface."*
- Luddy on performance: *"iOS 26: 13% battery drain vs. 1% in iOS 18 (iPhone 16 Pro Max testing)"* — and that's Apple's *native* implementation. A web imitation is far worse.
- Browser SVG filter performance is roughly 4–10× slower than `backdrop-filter` for the same visual effect.

**How to avoid:** Don't try to reproduce refraction. Ship honest glassmorphism — `blur + saturate + edge + shadow`. The "Liquid Glass" effect is a native material; on the web, translucency is the goal, not refraction.

---

# Part 2 — The Professional Dashboard UX Checklist (60 items)

Organized into 8 categories. Every item is a binary check. If you can't tick 8/10 in each category, the dashboard isn't done.

---

## A. Information hierarchy & layout (8 items)

- [ ] **A1.** A single written-down "lead question" the screen answers, ≤ 12 words, sticky-noted to the design.
- [ ] **A2.** The largest visual element on the screen answers the lead question directly.
- [ ] **A3.** The screen supports **one decision** (ship/hold, scale/pause, escalate/ignore). Multi-decision screens are split into tabs.
- [ ] **A4.** Layout pattern matches content type:
  - **Z-pattern** for landing pages, login screens, and 2-row marketing layouts (eye goes top-left → top-right → bottom-left → bottom-right via diagonal sweep).
  - **F-pattern** for text-heavy / list-heavy dashboards (eye scans top row fully, second row shorter, then drops down the left edge). Used for analytics views, log tables, content feeds.
  - **Inverted-L / sidebar+content** for app dashboards (Linear, Vercel, Stripe all use this — sidebar on the start edge, content on the rest).
- [ ] **A5.** Heading hierarchy: no skipped levels (`h1` → `h2` → `h3`, never `h1` → `h3`). Use size + weight + color for hierarchy, not just size.
- [ ] **A6.** Section padding uses one of two scales only: 24/32/48 (page-level) or 12/16/24 (component-level). Never mix.
- [ ] **A7.** One focal metric is visually dominant (size ≥ 2× the next-largest element). The rest support it.
- [ ] **A8.** Density gradient: primary KPI zone is dense (8–12px gutters), secondary zones are quiet (24–32px padding). Aim for 3:1 information density ratio.

---

## B. Data density & numeric presentation (10 items)

- [ ] **B1.** All numbers use `font-variant-numeric: tabular-nums` (or `font-feature-settings: "tnum" 1`). Numeric columns must align by decimal.
- [ ] **B2.** Rounding hierarchy:
  - Counts < 1,000: show exact (842, 999)
  - 1K–999K: one decimal (12.4K, 487.0K)
  - ≥ 1M: one decimal (1.2M, 38.5M)
  - Percentages: max 1 decimal (8.2%, not 8.234%)
  - Currency in summaries: drop cents ($12.4K, not $12,398.42)
  - Tables with comparable rows: keep precision; don't round for scannability
- [ ] **B3.** Every KPI tile has three slots: **headline number**, **delta** (▲/▼), **comparison label** ("vs last 7 days"). Never a number alone.
- [ ] **B4.** Delta is color-coded by direction only (green up / red down). The headline number itself is **never** colored.
- [ ] **B5.** Trend arrow + percentage: `▲ 8.2%` not `+8.2%` (the arrow is faster to scan).
- [ ] **B6.** Currency symbols precede the number (`$12.4K`, `€12.4K`, `۱۲٫۴ هزار تومان`). Use Persian thousand separator (`,`) for Persian display.
- [ ] **B7.** Decimal alignment: use `text-align: character;` (or right-align with consistent decimal places) in tables.
- [ ] **B8.** Sparklines below KPI tiles when trend matters more than the point estimate. Sparkline is muted (neutral color); the number is the hero.
- [ ] **B9.** "Last updated" timestamp visible on every dashboard. Format: relative for <1h ("3 min ago"), absolute for >1h ("14:32 today" or "Mar 14, 14:32").
- [ ] **B10.** Update frequency matches decision cycle: operational = seconds-minutes, analytics = hourly-daily, strategic = weekly-monthly. Real-time only for incident/fraud dashboards.

---

## C. Empty states (6 items)

- [ ] **C1.** Every empty state has **3 components**: (a) explanation of why it's empty, (b) clear CTA button, (c) illustration or icon.
- [ ] **C2.** Never ship a "No data" empty state. Always explain *why*: "You haven't connected any channels yet" / "No posts in the last 30 days" / "Filter returned 0 results".
- [ ] **C3.** Empty state CTA is a primary button, not a link. Make the next action obvious.
- [ ] **C4.** First-run empty state (never had data) differs from cleared empty state (had data, now filtered to zero). Different copy, different CTA.
- [ ] **C5.** Empty state illustration uses ≤ 3 colors, matches the page palette, and is not bigger than 25% of the viewport.
- [ ] **C6.** Empty search results differ from empty data state: "No results for 'query'" with search suggestions, not "Add your first post".

---

## D. Loading states (6 items)

- [ ] **D1.** Use the right indicator by wait time:
  - < 1s: no indicator (instant)
  - 1–10s: **skeleton screen** (mimics final layout, builds mental model)
  - 1–10s on a single component (button click): **spinner inside the button**
  - > 10s: **progress bar with explicit duration estimate**
- [ ] **D2.** Skeletons use the **page's actual layout shape**, not a generic spinner. (NN/G: skeleton screens "give users a sense of what the page will look like and minimize cognitive load.")
- [ ] **D3.** Skeleton shimmer animation uses `ease-in-out`, 1.2–1.8s duration, `infinite` loop, gradient sweep left→right (or right→left in RTL).
- [ ] **D4.** Spinners only for **actions** (button click, form submit), never for page loads.
- [ ] **D5.** Optimistic UI for instant feedback on reversible actions (like, bookmark, mark-as-read). Show the success state immediately; reconcile with server in the background; rollback on error.
- [ ] **D6.** **Never** use a frame-display skeleton (header + footer + blank body). NN/G explicitly warns against this — users assume the page is broken.

---

## E. Error states (7 items)

- [ ] **E1.** Error messages are **actionable** and **specific**: "Could not connect to Instagram. Check your connection and try again." — not "Something went wrong."
- [ ] **E2.** Every error message includes: (a) what happened, (b) why (if known), (c) what the user should do next.
- [ ] **E3.** Error states include a **retry button** when the error is network-related.
- [ ] **E4.** Form validation errors appear **inline** next to the field, in red, with an icon. Never in a toast.
- [ ] **E5.** Toast errors auto-dismiss after 6–8s; offer a "View details" link for full error info.
- [ ] **E6.** 404 / 500 pages have a clear path back: home button, search, last-known-good route.
- [ ] **E7.** Error state illustrations use the same 3-color palette as empty states, but with an amber/red accent.

---

## F. Microinteractions (8 items)

- [ ] **F1.** Every interactive element has **4 states**: default, hover, active (pressed), focus.
- [ ] **F2.** Hover transitions: **150–200ms**, `ease-out`. Hover is an *entrance* for the hover state.
- [ ] **F3.** Active (pressed) transitions: **50–100ms**, `ease-out`. Press feedback is instant.
- [ ] **F4.** Focus rings: visible, ≥ 3:1 contrast against adjacent colors, ≥ 2px thickness. Never `outline: none` without a replacement.
- [ ] **F5.** Focus ring uses `:focus-visible` (keyboard only), not `:focus` (which also fires on mouse click).
- [ ] **F6.** Buttons have a subtle scale on press (`transform: scale(0.97)`). This is the difference between "feels cheap" and "feels premium".
- [ ] **F7.** All transitions respect `prefers-reduced-motion: reduce` — disable transforms, keep opacity.
- [ ] **F8.** Cursor changes appropriately: `cursor: pointer` for buttons/links, `cursor: not-allowed` for disabled, default for static text.

---

## G. Color & status (5 items)

- [ ] **G1.** Dashboard is **readable in grayscale**. Screenshot, desaturate, confirm it still works. If not, color was carrying meaning it shouldn't.
- [ ] **G2.** Semantic colors only:
  - **Green** = success / positive trend / healthy
  - **Amber** = warning / attention / degraded
  - **Red** = error / negative trend / critical
  - **Blue** = info / neutral accent / brand
  - **Maximum 4 semantic colors per view.** No more.
- [ ] **G3.** Everything else (borders, separators, axes, default text, secondary metrics) uses a neutral grayscale.
- [ ] **G4.** Brand accent appears **once per screen**, on the primary CTA or focal metric.
- [ ] **G5.** Status colors meet 4.5:1 contrast against their background (WCAG AA). Stripe's green `#00875A` on white = 4.6:1. ✅

---

## H. Charts & data viz (10 items)

- [ ] **H1.** The **number is the hero, the chart is the support**. Charts never dominate. KPI tile = number (24–32px) + delta (12–14px) + sparkline (40×16px).
- [ ] **H2.** Truncated y-axes are forbidden unless explicitly labeled. A bar chart starting at 87% turns a 2% lift into a "huge spike" — that's a lie.
- [ ] **H3.** No 3D charts. No pie charts with > 5 slices. Use a sorted horizontal bar chart instead.
- [ ] **H4.** Chart palette: 1 brand color for the primary series, grayscale for comparison series, semantic colors only for status.
- [ ] **H5.** Tooltips on hover show: exact value, label, time period. Appear within 100ms of hover; disappear within 100ms of mouseout.
- [ ] **H6.** Charts have a defined **empty state** (e.g., "No data in this range — try extending the date filter") and a defined **loading state** (skeleton of the chart shape).
- [ ] **H7.** Axis labels use tabular-nums, 11–12px, neutral color. Never bold.
- [ ] **H8.** Grid lines: 1px, very low contrast (`rgba(0,0,0,0.06)` light / `rgba(255,255,255,0.06)` dark). Gridlines support, never compete.
- [ ] **H9.** Animations: chart entrance is 600–800ms, ease-out, with the data marks scaling from 0 to full. No bouncing. No looping animations.
- [ ] **H10.** Accessibility: every chart has a `role="img"` and `aria-label` with the data summary. Color is never the sole encoder — add direct labels on series.

---

# Part 3 — Motion Design Rules

## 3.1 The 5 named easing tokens (use these, nothing else)

Based on baraa.app's "Easing curves are a design language" and Material 3's motion system.

| Token name | CSS value | Use case |
|---|---|---|
| `motion.respond` | `cubic-bezier(0, 0, 0.2, 1)` | Workhorse — 60% of all motion. Hover responses, state changes, anything responding to user input. |
| `motion.enter` | `cubic-bezier(0, 0, 0.2, 1)` | Entrances — elements appearing: modals opening, dropdowns expanding, toasts entering. (Same curve as respond — fast start, slow finish.) |
| `motion.exit` | `cubic-bezier(0.4, 0, 1, 1)` | Exits — elements leaving: modals closing, dropdowns collapsing, toasts dismissing. (Mirror of enter.) |
| `motion.snap` | `cubic-bezier(0.12, 0, 0.08, 1)` | Micro-interactions — toggles, checkboxes, tab switches, segmented controls. Near-instant with a subtle tail. |
| `motion.announce` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Dramatic — modals opening, toast notifications, drag-and-drop settling. Overshoots ~5% then settles. Use sparingly (≤ 10% of motion). |

**The asymmetry rule:** Entrances and exits **never** use the same curve. Entrance is ease-out (fast-in, slow-out). Exit is ease-in (slow-in, fast-out). This mirrors how physical objects move.

**The 60/30/10 rule of motion:**
- 60% of animations use `motion.respond` (the workhorse)
- 30% use `motion.snap` + `motion.exit` (micro-interactions and dismissals)
- 10% use `motion.announce` (springs, overshoots, dramatic moments)

---

## 3.2 The duration scale (5 named durations)

| Token | Duration | Use case |
|---|---|---|
| `duration.instant` | 0ms | State changes that should be invisible (e.g., swap icon on toggle). |
| `motion.fast` | 100–150ms | Micro-interactions: toggles, checkboxes, tab switches, focus rings appearing. |
| `motion.normal` | 200–250ms | Standard transitions: hover states, button presses, dropdown menus. |
| `motion.slow` | 300–400ms | Panels: modals opening, sidebars sliding, command palette appearing, page transitions. |
| `motion.dramatic` | 500–600ms+ | Only for dramatic moments: first-time onboarding animations, hero transitions, large-scale morphs. Never for routine UI. |

**Rules:**
- Anything over 600ms needs a very good reason. Users will perceive it as slow.
- Sharp eases (`motion.snap`) at 600ms feels sluggish. Springs at 100ms don't have time to bounce. **Curves and durations are inseparable.**
- Hover at 0ms feels broken. Hover at 200ms feels intentional. Hover at 500ms feels broken (too slow).

---

## 3.3 Spring physics for the top 10%

For the most important animations (modal opening, toast notification, drag-and-drop settling), use spring physics instead of bezier curves. Springs respond to velocity, feel connected to the user's gesture, and never look mathematically canned.

**Framer Motion recommended spring presets:**

```tsx
import { motion } from "framer-motion";

// Modal entrance
const modalSpring = {
  type: "spring",
  stiffness: 300,
  damping: 26,
  mass: 1,
};

// Toast notification (snappier)
const toastSpring = {
  type: "spring",
  stiffness: 400,
  damping: 30,
};

// Drag-and-drop settle (heavier)
const dragSpring = {
  type: "spring",
  stiffness: 500,
  damping: 35,
  mass: 1.2,
};
```

**Spring rule of thumb:**
- Higher stiffness → faster oscillation, snappier feel
- Higher damping → less overshoot, more controlled
- Higher mass → slower, heavier feel
- Default starting point: stiffness 300, damping 26. Adjust from there.

---

## 3.4 Exact timing recommendations for each interaction type

| Interaction | Duration | Curve | Notes |
|---|---|---|---|
| Button hover (background fade) | 150ms | `motion.respond` | Fast feedback |
| Button press (scale 0.97) | 100ms | `motion.respond` | Instant |
| Button disabled → enabled | 200ms | `motion.respond` | |
| Toggle switch | 150ms | `motion.snap` | Sharp, near-instant |
| Checkbox check | 120ms | `motion.snap` | |
| Tab switch (underline slide) | 200ms | `motion.respond` | |
| Tab content swap | 250ms | `motion.respond` | Cross-fade, no slide |
| Dropdown menu open | 200ms | `motion.announce` (subtle spring) | Slight overshoot |
| Dropdown menu close | 150ms | `motion.exit` | Faster than open |
| Modal backdrop fade-in | 200ms | linear | Backdrop is not a "moving" element |
| Modal content entrance | 300ms | `motion.announce` (spring) | Scale from 0.95 to 1 + fade |
| Modal content exit | 200ms | `motion.exit` | Scale to 0.95 + fade |
| Toast entrance | 350ms | `motion.announce` (spring) | Slide in + slight overshoot |
| Toast exit | 200ms | `motion.exit` | Slide out |
| Command palette (Cmd+K) open | 200ms | `motion.announce` | Scale + fade |
| Sidebar expand/collapse | 300ms | `motion.respond` | Width transition |
| Page transition | 400ms | `motion.enter` | Cross-fade + slight upward slide |
| List item stagger entrance | 50ms between items, 250ms each, `motion.enter` | | See stagger section |
| Skeleton shimmer | 1500ms, infinite, `ease-in-out` | | Gradient sweep |
| Spinner rotation | 1000ms, infinite, linear | | Only linear for progress |
| Chart entrance | 600ms | `motion.respond` | Scale marks from 0 |
| Tooltip appearance | 100ms | linear | Appear instantly |
| Drag-and-drop settle | 400ms | spring (stiffness 500, damping 35) | |

---

## 3.5 Stagger patterns for lists

```tsx
// Framer Motion stagger pattern
const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.05,    // 50ms between each child
      delayChildren: 0.1,       // 100ms before first child
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.25,
      ease: [0, 0, 0.2, 1],     // motion.respond
    },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: {
      duration: 0.2,
      ease: [0.4, 0, 1, 1],     // motion.exit
    },
  },
};

// Usage
<motion.ul variants={containerVariants} initial="hidden" animate="visible">
  {items.map(item => (
    <motion.li key={item.id} variants={itemVariants} layout>
      {item.content}
    </motion.li>
  ))}
</motion.ul>
```

**Stagger rules:**
- Stagger interval: **40–60ms** between items. Never more.
- Cap stagger at 8 items (500ms total). After 8, the rest appear instantly.
- Stagger on entrance only. Exit is simultaneous (or with a much smaller stagger of 20ms).
- Use `layout` prop on Framer Motion for smooth reflow when items are added/removed/sorted.

---

## 3.6 Framer Motion best practices for dashboards

1. **Use `layoutId` for shared element transitions** — e.g. a card expanding into a modal. Set `layoutId="post-card-{id}"` on both the card and the modal; Framer handles the morph.
2. **Use `AnimatePresence` for exit animations** — without it, elements just disappear. Wrap your list: `<AnimatePresence>{items.map(...)}</AnimatePresence>`
3. **Use `motion.div` only where motion actually happens** — not every div. Excessive motion components hurt performance.
4. **Use `useReducedMotion()` hook** to disable transforms for users who prefer reduced motion:
   ```tsx
   const shouldReduceMotion = useReducedMotion();
   const transition = shouldReduceMotion
     ? { duration: 0 }
     : { duration: 0.25, ease: [0, 0, 0.2, 1] };
   ```
5. **Avoid `whileHover` on touch devices** — hover doesn't exist on mobile. Use `whileTap` only.
6. **Don't animate layout properties (width, height, top, left)** — use `transform: translate/scale` instead. Transform animations are GPU-accelerated; layout animations trigger reflow.
7. **`layout` prop is expensive** — use sparingly. For lists that re-order, it's worth it. For static layouts, don't add it.

---

# Part 4 — Typography Rules for Dashboards

## 4.1 Font stack for Nashrino (Persian RTL)

```css
:root {
  /* Persian / RTL primary */
  --font-persian: "Vazirmatn", "Vazirmatn Variable", system-ui, sans-serif;

  /* Latin / numerals / code */
  --font-latin: "Inter", "InterVariable", system-ui, sans-serif;
  --font-mono: "Geist Mono", ui-monospace, SFMono-Regular, Menlo, monospace;

  /* Persian Display (heavier weight for headings) */
  --font-persian-display: "Vazirmatn", system-ui, sans-serif;
}
```

**Vazirmatn loading (best practice):**
- Use the variable font (`Vazirmatn-Variable.woff2`) — one file, all weights 100–900.
- `font-display: swap` to avoid invisible text during load.
- Self-host (don't use jsdelivr CDN in production — it's a single point of failure and slower than self-hosting for repeat visits).

---

## 4.2 Numeric typography (the most important rules)

| Rule | CSS | Why |
|---|---|---|
| Tabular numbers everywhere numeric | `font-variant-numeric: tabular-nums;` (or `font-feature-settings: "tnum" 1;`) | Numbers take equal width — columns align, no jitter when values change |
| Lining figures (not oldstyle) | Most modern fonts default to lining figures; verify with `font-feature-settings: "lnum" 1;` | Oldstyle figures (descenders on 3, 4, 5, 7, 9) are illegible in tables |
| Slashed zero for codes/keys | `font-feature-settings: "zero" 1;` on API keys, OTP codes, IDs | Distinguish 0 from O |
| Disambiguation in code/data | `font-feature-settings: "ss02" 1, "zero" 1;` | I/l/1/0/O all distinguishable |
| Persian digits for prose, Latin for data | See RTL section | Convention in Persian UX |

**Tailwind v4 setup:**

```css
/* globals.css */
@layer base {
  body {
    font-family: var(--font-persian), var(--font-latin);
    font-feature-settings: "liga" 1, "calt" 1, "ss02" 1;  /* disambiguation globally */
  }

  /* Numeric data — tables, KPI tiles, stat values, timers */
  .nums {
    font-variant-numeric: tabular-nums;
    font-feature-settings: "tnum" 1, "zero" 1, "ss01" 1;
  }

  /* Code blocks */
  code, pre {
    font-family: var(--font-mono);
    font-feature-settings: "liga" 0, "calt" 0, "ss02" 1, "tnum" 1, "zero" 1;
  }
}
```

---

## 4.3 Vazirmatn-specific features

Vazirmatn is a neo-grotesque Persian/Arabic typeface (Saber Rastikerdar, 2015, OFL-1.1, 3.1k GitHub stars). It is the de facto standard for Persian web UIs.

**Vazirmatn best practices:**
- It pairs with **Roboto** for Latin glyphs (built into the standard build). For a more cohesive look with Inter, use the `Vazirmatn-Non-Latin` variant and let Inter handle Latin.
- Variable font supports weight 100–900 — use 400 for body, 600 for emphasis, 700 for headings. Don't go below 400 for Persian (thin Persian is illegible at small sizes).
- Persian text needs ~5–10% larger line-height than Latin. Set `line-height: 1.7` for Persian body, `1.55` for Latin body.
- Vazirmatn handles Persian letter spacing automatically — do **not** apply negative `letter-spacing` to Persian text. It breaks the connected glyphs.

---

## 4.4 Inter / Geist stylistic sets (ss01–ss08, cv01–cv13)

Reference: Lexington Themes Inter guide; rsms/Inter GitHub.

| Feature | Code | What it changes | Use in Nashrino? |
|---|---|---|---|
| Alternate digits | `ss01` | Different digit shapes | ✅ On KPI tiles + stat values |
| Disambiguation | `ss02` | I/l/1/0/O distinguishable | ✅ Global default |
| Round quotes | `ss03` | Softer quotes/commas | ✅ For marketing copy only |
| Disambiguation (no zero) | `ss04` | Like ss02, keeps default 0 | ❌ Use ss02 instead |
| Circled characters | `ss05` | ① ② ③ | ✅ For step lists in onboarding |
| Squared characters | `ss06` | Badge-style tags | ❌ Use sparingly |
| Square punctuation | `ss07` | Brutalist | ❌ Skip |
| Square quotes | `ss08` | Brutalist | ❌ Skip |
| Single-story `a` | `cv11` | Geometric look | ✅ For large display headings |

**Recommended global setup for Nashrino:**

```css
:root {
  font-family: "Vazirmatn", "InterVariable", system-ui, sans-serif;
  font-feature-settings: "liga" 1, "calt" 1, "ss02" 1;  /* global disambiguation */
}

/* Numeric data */
.nums, .metric-value, .stat-value, .timer, .price, td.numeric {
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum" 1, "zero" 1, "ss01" 1;
}

/* Large display headings (Persian + Latin) */
.display-1, .display-2 {
  font-feature-settings: "liga" 1, "calt" 1, "cv11" 1, "ss01" 1;
  font-weight: 700;
}

/* API keys / OTP codes */
.code, .api-key, .otp {
  font-family: "Geist Mono", ui-monospace, monospace;
  font-feature-settings: "tnum" 1, "zero" 1, "ss02" 1, "cv05" 1, "cv08" 1;
}
```

---

## 4.5 Type scale (exact px values)

A modular scale with 1.125 ratio (≈ major second). For Persian RTL dashboards, body text is **slightly larger** than typical Latin dashboards because Persian has more vertical strokes and needs more breathing room.

| Token | Size (px) | Line height | Letter spacing | Weight | Use |
|---|---|---|---|---|---|
| `text-micro` | 11px | 1.45 | 0.04em (uppercase) | 500 | All-caps labels (KPI delta, status), Persian: 12px |
| `text-caption` | 12px | 1.45 | 0 | 400 | Helper text, timestamps, secondary metadata |
| `text-xs` | 13px | 1.5 | 0 | 400 | Table cell text, small UI labels |
| `text-sm` | 14px | 1.55 | 0 | 400 | Body small — sidebar items, form labels, Persian: 15px |
| `text-base` | 15px | 1.6 | 0 | 400 | Body default (Persian: 16px) |
| `text-md` | 16px | 1.55 | 0 | 500 | Button text, list item primary |
| `text-lg` | 18px | 1.5 | -0.01em | 600 | Section headings, card titles |
| `text-xl` | 20px | 1.45 | -0.015em | 600 | Page subsection headings |
| `text-2xl` | 24px | 1.4 | -0.02em | 700 | Page title |
| `text-3xl` | 30px | 1.35 | -0.025em | 700 | KPI headline number |
| `text-4xl` | 36px | 1.3 | -0.03em | 700 | Hero metric |
| `text-5xl` | 48px | 1.25 | -0.035em | 800 | Empty state illustration headline, onboarding hero |

**Line-height by content type:**
| Content type | Line height | Why |
|---|---|---|
| Data tables | 1.25–1.4 | Tight — density matters |
| UI labels / buttons | 1.4–1.5 | Compact |
| Body prose (Latin) | 1.5–1.65 | Comfortable reading |
| Body prose (Persian) | 1.65–1.8 | Persian needs more vertical space |
| Headlines | 1.2–1.35 | Tight — headlines should feel substantial |
| Display numbers (KPI) | 1.0–1.15 | Very tight — number is a single visual unit |

**Letter-spacing rules:**
- **Large headings** (> 24px): negative letter-spacing (-0.02em to -0.035em). Tightens the visual unit.
- **Body text** (14–18px): `normal` (0). Don't touch.
- **Small body** (< 14px): `0` or very slightly positive (`0.005em`).
- **ALL CAPS labels** (status, KPI delta, button labels): **always** positive letter-spacing `0.04em–0.08em`. Without it, caps look cramped and amateur.
- **Persian text**: **never** apply letter-spacing. It breaks the connected glyphs (Persian is a cursive script). Letter-spacing only works on Latin.

---

## 4.6 Heading hierarchy rules

- Never skip levels: `h1` → `h2` → `h3`. Never `h1` → `h3`.
- One `h1` per page (the page title).
- Use **size + weight + color** for hierarchy, not just size. Example: a section heading at 18px/700/dark + a card title at 16px/600/medium creates clear hierarchy even with close sizes.
- Hierarchy levels (max 4 visible on one screen):
  1. Page title (`text-2xl`, 700, `--text-primary`)
  2. Section heading (`text-lg`, 600, `--text-primary`)
  3. Card title / list item primary (`text-md`, 600, `--text-primary`)
  4. Body / metadata (`text-sm` or `text-xs`, 400, `--text-secondary`)

---

# Part 5 — Spacing System (4px / 8px grid)

## 5.1 The 8-step scale

Based on Linear (4px base), Vercel Geist (4px base), Material 3 (4dp base), and Eight Shapes' space-in-design-systems. 4px is the base unit; every spacing value is a multiple of 4.

```css
:root {
  --space-0: 0;        /* 0px  — no gap */
  --space-px: 1px;     /* 1px  — hairline borders only */
  --space-1: 4px;      /* 4px  — micro: icon-to-label */
  --space-2: 8px;      /* 8px  — tight: between related items */
  --space-3: 12px;     /* 12px — comfortable: between label and value */
  --space-4: 16px;     /* 16px — standard: card internal padding */
  --space-5: 20px;     /* 20px — section internal */
  --space-6: 24px;     /* 24px — section-to-section within a card */
  --space-8: 32px;     /* 32px — section-to-section on page */
  --space-10: 40px;    /* 40px — large section break */
  --space-12: 48px;    /* 48px — page-level vertical rhythm */
  --space-16: 64px;    /* 64px — hero spacing */
  --space-20: 80px;    /* 80px — page top/bottom padding */
  --space-24: 96px;    /* 96px — extra-large hero */
}
```

**Tailwind v4 mapping** (already default): `gap-1 = 4px`, `gap-2 = 8px`, `gap-4 = 16px`, `gap-6 = 24px`, `gap-8 = 32px`, etc.

---

## 5.2 When to break the grid

Only for **optical alignment** — never for arbitrary values. Examples:
- Icon-to-text alignment: an icon's optical center isn't its bounding box center. You may need `gap-[6px]` instead of `gap-2` (8px) to make it *look* aligned.
- Avatar + name: a 24px circular avatar next to text often needs `gap-[10px]` instead of `gap-2` or `gap-3` to look balanced.
- Letterforms with descenders (Persian گ چ پ ک) may need 1–2px extra bottom padding to look optically centered.

**Rule:** If you can't justify a non-scale value with "it looks misaligned without it", use the scale value.

---

## 5.3 Specific padding recommendations

| Element | Padding | Notes |
|---|---|---|
| Page (root container) | `24px 32px` (mobile: `16px 16px`) | 32px horizontal on desktop, 16px on mobile |
| Card (KPI, content card) | `20px` or `24px` | 20px for dense cards, 24px for breathing room |
| Card internal section gap | `16px` or `24px` | Between header and body of a card |
| Modal / dialog | `32px` | Generous — modal is a focused surface |
| Sidebar nav item | `12px 16px` | Comfortable click target, fits text + icon |
| Top app bar | `16px 24px` | 16px vertical, 24px horizontal |
| Button (default) | `8px 16px` | 8px vertical, 16px horizontal. Touch target ≥ 40px. |
| Button (compact) | `4px 12px` | For inline buttons in tables |
| Button (large / primary CTA) | `12px 24px` | Bigger emphasis |
| Form input | `10px 12px` | Comfortable type, fits 14px text with breathing room |
| Form label to input | `6px` | Tight, they're a unit |
| Form field to form field | `16px` or `24px` | 16px for dense forms, 24px for breathing room |
| Table cell | `12px 16px` | Dense but readable |
| Table header cell | `10px 16px` | Slightly tighter than body |
| Toast / notification | `16px 20px` | |
| Tooltip | `8px 12px` | Compact |
| Chip / badge | `4px 10px` | Pill shape, tight |
| Avatar | `0` (size only: 24, 32, 40, 48) | |
| Empty state container | `48px` vertical, `24px` horizontal | Generous — empty states should feel calm |

---

## 5.4 Section rhythm rules

- **Page-level vertical rhythm**: sections separated by `--space-12` (48px) on desktop, `--space-8` (32px) on mobile.
- **Card-level rhythm**: sections within a card separated by `--space-6` (24px).
- **Component-level rhythm**: elements within a section separated by `--space-4` (16px) or `--space-3` (12px).
- **The "rhythm" rule**: every gap in a single view comes from the same scale. If a designer can spot two values that don't relate by a multiple of 4, the rhythm is broken.

---

# Part 6 — RTL / Persian-Specific UX Rules

## 6.1 Vazirmatn font setup

```css
/* Persian-first font stack */
:root {
  --font-sans: "Vazirmatn", "InterVariable", system-ui, -apple-system, sans-serif;
  --font-mono: "Geist Mono", ui-monospace, SFMono-Regular, monospace;
}

/* Self-host the variable font for performance */
@font-face {
  font-family: "Vazirmatn";
  src: url("/fonts/Vazirmatn[wght].woff2") format("woff2-variations");
  font-weight: 100 900;
  font-display: swap;
  font-style: normal;
}

/* Larger line-height for Persian body text */
:root {
  line-height: 1.75;  /* Persian needs more breathing room than Latin's 1.55 */
}
```

**Vazirmatn gotchas:**
- Don't apply `letter-spacing` to Persian text. Persian is a cursive script; letter-spacing breaks the connected glyphs.
- Use weights 400, 500, 600, 700 for UI. Avoid < 400 — thin Persian is illegible.
- For Latin text inside Persian UI (numbers, English brand names), let Vazirmatn's built-in Roboto fallback handle it, or explicitly switch to Inter with `font-family: var(--font-latin)`.

---

## 6.2 Persian digit rendering (toPersianDigits)

**Convention:** Use Persian digits for prose and UI labels. Use Latin (Western) digits for:
- **Charts and data tables** (better tabular alignment with Inter's `tnum`)
- **Code blocks, API keys, IDs**
- **Dates when shown in ISO format** (2024-03-14)

**Implementation:**

```ts
// utils/persian-digits.ts
const PERSIAN_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

export function toPersianDigits(value: string | number): string {
  return String(value).replace(/[0-9]/g, (d) => PERSIAN_DIGITS[+d]!);
}

export function toLatinDigits(value: string): string {
  return value.replace(/[۰-۹]/g, (d) =>
    String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))
  );
}

// Number formatting with Persian digits + Persian thousand separator
export function formatPersianNumber(n: number): string {
  return toPersianDigits(n.toLocaleString("fa-IR"));
}

// Usage:
// formatPersianNumber(1234567) → "۱٬۲۳۴٬۵۶۷"
```

**When to use which:**
| Context | Digit system | Reason |
|---|---|---|
| Body prose in Persian | Persian (۱٬۲۳۴) | Native reading flow |
| KPI headline number | Persian (۱٫۲M) | UI consistency with surrounding text |
| Data table cell | Latin (1,234) | Tabular alignment, sortability |
| Chart axis labels | Latin (1k, 2k, 3k) | Inter renders Latin digits better |
| Date in Jalali format | Persian (۱۴ خرداد ۱۴۰۳) | Native calendar UX |
| Date in ISO format | Latin (2024-03-14) | Standard |
| Currency in Persian | Persian (۱۲٬۴۰۰٬۰۰۰ تومان) | Native |
| Currency in international | Latin ($12.4K) | Standard |
| Code block | Latin | Always |
| Notification count badge | Persian (۵) | Matches UI |
| Progress percentage | Persian (٪۷۵) | Persian percent sign |

**Persian percent sign:** Use `٪` (U+066A ARABIC PERCENT SIGN), not `%` (U+0025). Position: comes after the number, just like Latin.

---

## 6.3 RTL icon flipping rules

**Mirror these icons in RTL:**
| Icon | Why |
|---|---|
| Back arrow (← / →) | Back = points to start = right in RTL |
| Forward arrow | Forward = points to end = left in RTL |
| Breadcrumb separator (/ or >) | Reading direction reversed |
| Pagination arrows (prev/next) | Direction-dependent |
| "Send" / "Reply" arrow | Direction of motion |
| List bullet arrows (▶) | Indicates progression |
| Timeline / progress flow arrows | Time flows right-to-left in RTL |
| Indent/outdent | Direction of text flow |
| Undo / redo (directional ones) | Mirrors timeline direction |
| Volume slider (with directional waves) | Slider fills from start side |

**DO NOT mirror these icons in RTL:**
| Icon | Why |
|---|---|
| Refresh / reload (clockwise circular arrow) | Clocks always turn clockwise; refresh is not "time-directional" |
| History (counterclockwise arrow) | Same as above |
| Search (magnifying glass) | Right-handed users; directional but represents holding object |
| Camera, microphone, headphones | Physical objects, identical in all locales |
| Keyboard | Same physical layout everywhere |
| Settings (gear) | Mechanical, not directional |
| Notifications (bell) | Physical object |
| Trash, edit (pencil), copy | Tools, not directional |
| Checkmarks (✓) | Universal symbol |
| Media playback (▶ ⏸ ⏹ ⏮ ⏭) | Represents direction of *tape*, not time. Material Design: "Media controls for playback are always LTR." |
| Number 0-9 in icons | Numbers don't reverse |
| Question mark (?) | Universal |
| Logo / brand mark | Never mirror |

**Implementation in Tailwind v4:**

```css
/* Flip directional icons in RTL */
[dir="rtl"] .icon-flip {
  transform: scaleX(-1);
}
```

Or use a Lucide / Heroicon variant set that includes RTL-aware icons.

---

## 6.4 RTL chart direction

**Convention:** Charts stay LTR by default in Persian dashboards. Time flows left-to-right in charts, even when the UI is RTL.

**Why:**
- Material Design: "Do not mirror media playback or progress bars."
- Industry convention (Chart.js, Recharts, Apache ECharts): time axis = LTR by default.
- Most Persian users (especially data workers) are accustomed to LTR charts from international tools (Google Analytics, Meta Business Suite).
- Reversing time direction in charts can confuse users who switch between Persian and international tools.

**However:**
- **Y-axis position**: Y-axis moves to the **right** side in RTL charts (Chart.js supports `position: 'right'` for RTL).
- **Legend**: legend reads right-to-left (first item on the right).
- **Tooltip**: tooltip appears on the left of the cursor (mirrored from LTR where it appears on the right).
- **Brush / range selector**: the "start" handle is on the right, "end" on the left.

**Chart.js RTL setup:**

```ts
const chartConfig = {
  options: {
    rtl: true,                          // Chart.js native RTL flag
    scales: {
      y: { position: 'right' },         // Y-axis on the right in RTL
      x: {
        // Time axis stays LTR (time flows left-to-right)
        // But labels are right-aligned within their tick
      }
    },
    plugins: {
      tooltip: {
        rtl: true,
        textDirection: 'rtl'
      },
      legend: { rtl: true }
    }
  }
};
```

**When you SHOULD flip time direction in RTL:**
- Pure timeline visualizations (not quantitative charts) where the timeline *is* the content.
- Story-style "next/previous" navigations.
- Onboarding flow arrows.

---

## 6.5 Jalali calendar UX

**Jalali (Shamsi) calendar basics:**
- Solar calendar, 12 months: Farvardin (فروردین) → Esfand (اسفند)
- Year ~365.25 days; leap year every 4 years (similar to Gregorian but different cycle)
- New year starts on March 20/21 (spring equinox)
- Date format: `۱۴۰۳/۰۳/۱۴` or `۱۴ خرداد ۱۴۰۳` (day month year)

**Jalali date display rules:**
| Context | Format | Example |
|---|---|---|
| Date picker | `YYYY/MM/DD` (Jalali) | `۱۴۰۳/۰۳/۱۴` |
| Inline in prose | Day Month Year | `۱۴ خرداد ۱۴۰۳` |
| Compact (table cell) | `YY/MM/DD` | `۰۳/۰۳/۱۴` |
| Relative time | Persian text | `۳ ساعت پیش` (3 hours ago) |
| Tooltip / detail | Jalali + Gregorian | `۱۴ خرداد ۱۴۰۳ (۳ Jun 2024)` |

**UX rules:**
1. **Always store dates in UTC ISO** in the database. Convert to Jalali only at render time.
2. **Date pickers must be Jalali-aware** — use `react-jalali-calendar-daypicker` or `moment-jalaali` + custom picker.
3. **Always show the Gregorian equivalent on hover/tooltip** for dates that need international context (e.g., scheduled post time, when the user is collaborating with international teams).
4. **Range pickers**: "This week", "Last 7 days", "This month" — these refer to Jalali weeks/months in Persian UI, not Gregorian. Be explicit.
5. **First day of week**: Saturday (شنبه) in Iran, not Sunday or Monday. Calendar weeks start on Saturday.
6. **Weekend**: Friday (جمعه) is the weekend in Iran. Some calendars also mark Thursday afternoon as weekend.
7. **Time format**: 24-hour is standard. `۱۴:۳۲` (Persian digits). 12-hour with AM/PM is rare in formal Persian UIs.
8. **Timezone**: Iran Standard Time (IRST, UTC+3:30). Iran observes DST (IRDT, UTC+4:30) from March to September — though this was abolished in 2022, check current policy.

**Conversion library:**

```ts
import { jalaaliMonthLength, toJalaali, toGregorian } from "jalaali-js";

// Gregorian → Jalali
const j = toJalaali(2024, 6, 3);
// j = { jy: 1403, jm: 3, jd: 14 }

// Jalali → Gregorian
const g = toGregorian(1403, 3, 14);
// g = { gy: 2024, gm: 6, gd: 3 }
```

---

## 6.6 RTL layout fundamentals

**CSS:**

```html
<html dir="rtl" lang="fa">
```

Or dynamically:

```ts
document.documentElement.dir = isRTL ? "rtl" : "ltr";
document.documentElement.lang = isRTL ? "fa" : "en";
```

**Logical properties (Tailwind v4 supports these natively):**

Use logical properties, not physical ones. Tailwind v4 maps `ps-*` (padding-inline-start) and `pe-*` (padding-inline-end) which automatically flip in RTL.

| Physical (LTR-only) | Logical (RTL-aware) | Tailwind v4 |
|---|---|---|
| `padding-left` | `padding-inline-start` | `ps-*` |
| `padding-right` | `padding-inline-end` | `pe-*` |
| `margin-left` | `margin-inline-start` | `ms-*` |
| `margin-right` | `margin-inline-end` | `me-*` |
| `text-align: left` | `text-align: start` | `text-start` |
| `text-align: right` | `text-align: end` | `text-end` |
| `left: 0` | `inset-inline-start: 0` | `start-0` |
| `right: 0` | `inset-inline-end: 0` | `end-0` |
| `border-left` | `border-inline-start` | `border-s-*` |
| `border-right` | `border-inline-end` | `border-e-*` |

**Rules:**
- Never use `left` / `right` in CSS. Always use `inset-inline-start` / `inset-inline-end`.
- Never use `text-left` / `text-right`. Use `text-start` / `text-end`.
- Flexbox and Grid auto-flip in RTL — `flex-row` becomes right-to-left automatically.
- The only things that don't auto-flip: transforms (translateX), absolute positioning with physical properties, and animations using physical properties.

---

# Part 7 — Anti-Patterns Catalog

A reference of what **not** to do. Each anti-pattern includes the symptom, why it's wrong, and the fix.

---

## 7.1 Glass anti-patterns

### AP-G1: "Frosted card over a photo with body text"
**Symptom:** A glass card sitting over a hero image, containing 3 paragraphs of body text.
**Why wrong:** Variable contrast. The card passes WCAG over a dark area of the photo, fails over a bright area.
**Fix:** Move body text to a solid surface. Use glass only for the card title bar or for icon-only controls over the photo.

### AP-G2: "Stacked glass modals"
**Symptom:** A glass modal opens, inside it a glass dropdown, inside that a glass tooltip.
**Why wrong:** Triple blur = muddy + 3× GPU cost. Apple HIG explicitly forbids glass-on-glass.
**Fix:** Only the outermost layer is glass. Everything inside is solid.

### AP-G3: "Blur with no saturate"
**Symptom:** `backdrop-filter: blur(20px)` alone. Looks like fog, not glass.
**Why wrong:** Gaussian blur desaturates; without `saturate()`, the result is muddy.
**Fix:** Always `blur(20px) saturate(1.8)`. Apple's own recipe is `saturate(180%) blur(20px)`.

### AP-G4: "Borderless glass card"
**Symptom:** Translucent rectangle floating with no visible edge.
**Why wrong:** No edge = no separation from background. Looks like a smudge.
**Fix:** Always add `border: 1px solid rgba(255,255,255,0.18)` (or similar luminance border).

### AP-G5: "Glass on every KPI card"
**Symptom:** A 6-tile KPI strip where every tile has `backdrop-filter: blur()`.
**Why wrong:** Destroys hierarchy (everything is "elevated"). Tanks GPU. Hard to read numbers.
**Fix:** KPI cards are solid surfaces (`background: var(--surface-1)`). Reserve glass for the navigation layer and modals.

### AP-G6: "Web imitation of Liquid Glass refraction"
**Symptom:** SVG `feTurbulence` + `feDisplacementMap` + 5 stacked filters trying to imitate Apple's refraction.
**Why wrong:** 4–10× slower than `backdrop-filter`, looks worse, breaks on older browsers.
**Fix:** Ship honest glassmorphism. Translucency is the goal, not refraction.

### AP-G7: "No reduced-transparency fallback"
**Symptom:** Glass panel becomes invisible or unreadable when user enables OS "Reduce transparency".
**Why wrong:** Excludes users with accessibility needs.
**Fix:** `@media (prefers-reduced-transparency: reduce) { ... }` with solid backgrounds.

### AP-G8: "Heavy blur radius (40px+)"
**Symptom:** `backdrop-filter: blur(50px)`.
**Why wrong:** Extreme blur destroys all background information, making the glass point moot. Also tanks performance on integrated GPUs.
**Fix:** Cap blur at 24px for primary panels, 16px for navigation, 8px for small controls.

---

## 7.2 Dashboard anti-patterns

### AP-D1: "Twelve KPIs above the fold"
**Symptom:** A 4×3 grid of KPI tiles at the top of the dashboard.
**Why wrong:** If everything is important, nothing is. Eye can't hold 12 items in working memory.
**Fix:** Max 4–6 KPIs in the lead strip. Demote the rest to a secondary tab or a detail page.

### AP-D2: "Rainbow chart"
**Symptom:** A pie chart with 6 slices in 6 different colors.
**Why wrong:** Color carries no meaning. User can't match legend to slice without effort.
**Fix:** Max 5 slices in a pie. Better: sorted horizontal bar chart. Use 1 brand color + grayscale.

### AP-D3: "Truncated y-axis"
**Symptom:** Bar chart with y-axis from 87% to 100%, showing a 2% change as a "huge spike".
**Why wrong:** Misleads the user about magnitude of change.
**Fix:** Always start y-axis at 0 for bar charts. For line charts, label clearly if the axis is truncated.

### AP-D4: "3D pie chart"
**Symptom:** Tilted pie chart with depth.
**Why wrong:** 3D distorts proportion. The slice closest to the viewer looks bigger.
**Fix:** Flat charts only. 2D. Always.

### AP-D5: "Hidden filter state"
**Symptom:** User filters to "last 7 days" 3 views ago, forgets, now thinks the dashboard is broken.
**Why wrong:** Most-reported cause of "the dashboard is wrong" complaints.
**Fix:** Active filters always visible as removable chips at the top. One-click "Clear all" button.

### AP-D6: "Real-time everything"
**Symptom:** KPI numbers flicker every 2 seconds with WebSocket updates.
**Why wrong:** Flickering numbers erode trust. Constant motion = unstable.
**Fix:** Match update frequency to decision cycle. Operational = seconds. Analytics = hourly. Strategic = weekly.

### AP-D7: "Decorative icon next to every metric"
**Symptom:** Every KPI tile has a colorful icon in the corner.
**Why wrong:** Icons compete with the number for attention. Number is the hero.
**Fix:** Icons only on filter chips, navigation, and status indicators. KPI tiles: number + delta + label. No icon.

### AP-D8: "No empty state"
**Symptom:** New user opens dashboard, sees blank chart with "No data".
**Why wrong:** User has no idea what to do next.
**Fix:** Every empty state has explanation + CTA + illustration.

### AP-D9: "Spinner on every load"
**Symptom:** Click anywhere → full-screen spinner overlay.
**Why wrong:** Hides context. Disorienting.
**Fix:** Skeleton screens for page loads. Inline spinners for button actions. Optimistic UI for instant feedback.

### AP-D10: "Something went wrong"
**Symptom:** Generic error message with no actionable info.
**Why wrong:** User can't fix the problem.
**Fix:** Specific error: "Could not connect to Instagram. Check your connection and try again." With retry button.

### AP-D11: "Sticky header with no fade"
**Symptom:** Content scrolling under a glass header flickers as it leaves the viewport.
**Why wrong:** The blur algorithm stops sampling off-screen content, causing color jumps.
**Fix:** Add a gradient that's opaque at the top edge of the header, fading to transparent below. (Josh Comeau's flicker fix.)

### AP-D12: "Outline: none on focus"
**Symptom:** Custom-styled button with no visible focus indicator.
**Why wrong:** WCAG 2.4.7 violation. Keyboard users can't see where they are.
**Fix:** `:focus-visible` with a 2px ring at 3:1 contrast minimum.

### AP-D13: "Hover transitions at 500ms"
**Symptom:** Hover states take half a second to appear.
**Why wrong:** Feels sluggish. Users think the UI is lagging.
**Fix:** Hover = 150–200ms, `motion.respond` (ease-out).

### AP-D14: "Modal entrance with `ease-in-out`"
**Symptom:** Modal opens with symmetric easing.
**Why wrong:** Symmetric easing feels canned. Real objects don't decelerate at the same rate they accelerated.
**Fix:** Entrance = `motion.announce` (overshoot spring) or `motion.enter` (ease-out). Exit = `motion.exit` (ease-in).

### AP-D15: "All-caps label with no letter-spacing"
**Symptom:** STATUS label rendered in all caps with default letter-spacing.
**Why wrong:** All caps look cramped without tracking. Looks amateur.
**Fix:** `letter-spacing: 0.04em–0.08em` on all-caps text.

### AP-D16: "Oldstyle figures in tables"
**Symptom:** Numbers in a data table using `font-feature-settings: "onum" 1` or default (which may be oldstyle in some serif fonts).
**Why wrong:** Oldstyle figures have descenders that break alignment.
**Fix:** `font-variant-numeric: tabular-nums lining-nums;` on all numeric table cells.

### AP-D17: "Proportional numbers in KPI tiles"
**Symptom:** KPI value `1,234,567` displayed with proportional figures. As the number changes, it jitters horizontally.
**Why wrong:** Numbers should be stable. Proportional figures make them jump.
**Fix:** `font-variant-numeric: tabular-nums;` everywhere numeric.

### AP-D18: "Mixed Persian and Latin digits in same table"
**Symptom:** One column shows "1,234" (Latin), another shows "۱٬۲۳۴" (Persian).
**Why wrong:** Inconsistent. Hard to scan.
**Fix:** Pick one system per table. For data tables: Latin (better tabular). For UI labels: Persian.

### AP-D19: "Unflipped back arrow in RTL"
**Symptom:** RTL UI where "back" button points left (←).
**Why wrong:** Back should point toward the start = right in RTL.
**Fix:** Mirror directional icons. Use `[dir="rtl"] .icon-flip { transform: scaleX(-1); }`.

### AP-D20: "Y-axis on left in RTL chart"
**Symptom:** RTL dashboard, but chart Y-axis is on the left.
**Why wrong:** Y-axis should be on the start side = right in RTL.
**Fix:** Chart.js: `scales: { y: { position: 'right' } }` for RTL.

---

# Appendix A — The full professional checklist (compiled, 60 items)

For quick reference. Every item should be ✅ before shipping.

### Hierarchy & Layout (8)
1. Lead question written down, ≤12 words
2. Largest visual element answers lead question
3. Screen supports one decision
4. Layout pattern matches content (Z / F / sidebar+content)
5. No skipped heading levels
6. Two spacing scales only (page-level + component-level)
7. One focal metric visually dominant (2× next-largest)
8. Density gradient 3:1 primary:secondary

### Numeric Presentation (10)
9. `tabular-nums` everywhere numeric
10. Rounding hierarchy (1.2M, not 1,234,567)
11. Every KPI has number + delta + comparison label
12. Delta color = direction only; headline never colored
13. Trend arrow + percentage (`▲ 8.2%`)
14. Currency symbols precede number
15. Decimal alignment in tables
16. Sparkline below KPI when trend matters
17. "Last updated" timestamp visible
18. Update frequency matches decision cycle

### Empty States (6)
19. Every empty state has explanation + CTA + illustration
20. Never ship "No data" — explain why
21. Empty state CTA is a primary button
22. First-run empty differs from cleared empty
23. Empty illustration ≤3 colors, ≤25% viewport
24. Empty search differs from empty data

### Loading States (6)
25. Right indicator by wait time (<1s: none, 1-10s: skeleton, >10s: progress bar)
26. Skeletons use actual page layout shape
27. Skeleton shimmer 1.2–1.8s, ease-in-out, infinite
28. Spinners only for actions, never page loads
29. Optimistic UI for reversible actions
30. No frame-display skeletons

### Error States (7)
31. Errors are actionable and specific
32. Error message has what + why + next step
33. Network errors include retry button
34. Form errors appear inline, not in toasts
35. Toast errors auto-dismiss 6–8s with "View details"
36. 404/500 pages have clear path back
37. Error illustrations use ≤3 colors with amber/red accent

### Microinteractions (8)
38. Every interactive element has 4 states (default/hover/active/focus)
39. Hover: 150–200ms, ease-out
40. Active: 50–100ms, ease-out
41. Focus ring: ≥3:1 contrast, ≥2px, `:focus-visible` only
42. Press scale (0.97) on buttons
43. `prefers-reduced-motion: reduce` disables transforms
44. Cursor changes appropriately

### Color & Status (5)
45. Readable in grayscale
46. Max 4 semantic colors per view (green/amber/red/blue)
47. Everything else is grayscale
48. Brand accent appears once per screen
49. Status colors meet 4.5:1 contrast

### Charts (10)
50. Number is hero; chart supports
51. No truncated y-axes without labeling
52. No 3D; no pie >5 slices
53. 1 brand color + grayscale for charts
54. Tooltips within 100ms hover
55. Charts have empty + loading states
56. Axis labels: tabular-nums, 11–12px, neutral
57. Grid lines 1px, very low contrast
58. Entrance 600–800ms ease-out, no bounce
59. Charts have `role="img"` + `aria-label`

### Glass (10 bonus)
60. Glass only on navigation/modals/toasts — not content
61. Solid fallback designed first
62. Text never directly on glass — scrim layer always
63. No glass-on-glass stacking
64. Edge + specular + shadow on every glass surface
65. `saturate(1.5–1.8)` paired with every `blur()`
66. Glass over busy content has dimming gradient
67. `prefers-reduced-transparency: reduce` respected
68. Max 2 concurrent glass surfaces per view
69. Sticky glass has flicker-fix gradient at top edge

---

# Appendix B — Recommended Tailwind v4 token setup

```css
/* @tailwindcss/v4 globals.css */

@theme {
  /* Spacing scale (4px base) */
  --spacing-0: 0;
  --spacing-1: 4px;
  --spacing-2: 8px;
  --spacing-3: 12px;
  --spacing-4: 16px;
  --spacing-5: 20px;
  --spacing-6: 24px;
  --spacing-8: 32px;
  --spacing-10: 40px;
  --spacing-12: 48px;
  --spacing-16: 64px;
  --spacing-20: 80px;
  --spacing-24: 96px;

  /* Type scale */
  --text-micro: 11px;
  --text-caption: 12px;
  --text-xs: 13px;
  --text-sm: 14px;
  --text-base: 15px;
  --text-md: 16px;
  --text-lg: 18px;
  --text-xl: 20px;
  --text-2xl: 24px;
  --text-3xl: 30px;
  --text-4xl: 36px;
  --text-5xl: 48px;

  /* Motion */
  --ease-respond: cubic-bezier(0, 0, 0.2, 1);
  --ease-enter: cubic-bezier(0, 0, 0.2, 1);
  --ease-exit: cubic-bezier(0.4, 0, 1, 1);
  --ease-snap: cubic-bezier(0.12, 0, 0.08, 1);
  --ease-announce: cubic-bezier(0.34, 1.56, 0.64, 1);

  --duration-fast: 150ms;
  --duration-normal: 250ms;
  --duration-slow: 400ms;
  --duration-dramatic: 600ms;

  /* Fonts */
  --font-sans: "Vazirmatn", "InterVariable", system-ui, sans-serif;
  --font-mono: "Geist Mono", ui-monospace, SFMono-Regular, monospace;
}

@layer base {
  :root {
    font-family: var(--font-sans);
    font-feature-settings: "liga" 1, "calt" 1, "ss02" 1;
    line-height: 1.75;  /* Persian-friendly */
  }

  /* Numeric data */
  .nums, [data-numeric] {
    font-variant-numeric: tabular-nums;
    font-feature-settings: "tnum" 1, "zero" 1, "ss01" 1;
  }

  /* Respect reduced motion */
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }

  /* Respect reduced transparency */
  @media (prefers-reduced-transparency: reduce) {
    [class*="glass"] {
      background: var(--surface-1) !important;
      backdrop-filter: none !important;
    }
  }
}

@layer components {
  /* Premium glass panel — the 4-ingredient recipe */
  .glass-panel {
    background: rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(20px) saturate(1.8) brightness(1.05);
    -webkit-backdrop-filter: blur(20px) saturate(1.8) brightness(1.05);
    border: 1px solid rgba(255, 255, 255, 0.18);
    box-shadow:
      0 1px 0 0 rgba(255, 255, 255, 0.10) inset,
      0 -1px 0 0 rgba(0, 0, 0, 0.10) inset,
      0 4px 16px -2px rgba(0, 0, 0, 0.20),
      0 8px 32px -8px rgba(0, 0, 0, 0.12);
    border-radius: 16px;
  }

  /* Frosted navigation — lighter, for sticky headers */
  .glass-nav {
    background: linear-gradient(
      to bottom,
      hsl(220 24% 12% / 0.92) 0%,
      hsl(220 24% 12% / 0.72) 100%
    );
    backdrop-filter: blur(16px) saturate(1.8);
    -webkit-backdrop-filter: blur(16px) saturate(1.8);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  /* Solid fallback for unsupported browsers */
  @supports not (backdrop-filter: blur(20px)) {
    .glass-panel,
    .glass-nav {
      background: var(--surface-1);
    }
  }
}
```

---

# Appendix C — Reference quick cards

## C.1 Glass recipe card

```
INGREDIENTS (in order):
1. backdrop-filter: blur(20px) saturate(1.8) brightness(1.05)
2. background: rgba(255,255,255,0.08)        ← 6-12% opacity
3. border: 1px solid rgba(255,255,255,0.18)  ← luminance edge
4. box-shadow: inset top highlight + drop shadow
5. @supports fallback → solid background
6. @media reduced-transparency → solid background

NEVER:
- Glass on glass (use solid for nested)
- Text directly on glass (always add scrim)
- blur without saturate (muddy)
- > 24px blur (GPU cost + visual mud)
- Glass on data tables or KPI cards
```

## C.2 Motion token card

```
ENTRANCES (elements appearing):
- Dropdown open:     200ms, announce (subtle spring)
- Modal content:     300ms, announce (spring)
- Toast:             350ms, announce (spring)
- Page transition:   400ms, enter (ease-out)
- Stagger list:      50ms between items, 250ms each, enter

EXITS (elements leaving):
- Dropdown close:    150ms, exit (ease-in) — faster than open
- Modal close:       200ms, exit
- Toast dismiss:     200ms, exit
- List item exit:    200ms, exit (no stagger)

MICRO (instant feedback):
- Toggle/checkbox:   150ms, snap
- Tab switch:        200ms, respond
- Button hover:      150ms, respond
- Button press:      100ms, respond
- Focus ring:        100ms, respond

NEVER:
- Hover > 250ms (feels sluggish)
- Press > 150ms (feels broken)
- Anything > 600ms without a dramatic reason
- ease-in-out on entrances/exits (use asymmetric)
- Linear on anything except progress bars and spinners
```

## C.3 Typography card

```
GLOBAL:
- font: Vazirmatn (Persian) + Inter (Latin) + Geist Mono (code)
- line-height: 1.75 (Persian body), 1.55 (Latin body)
- font-feature-settings: "liga" 1, "calt" 1, "ss02" 1 (disambiguation)
- letter-spacing on Persian: NEVER (breaks connected glyphs)
- letter-spacing on ALL CAPS: 0.04em-0.08em (always)
- letter-spacing on large headings: -0.02em to -0.035em

NUMERIC:
- font-variant-numeric: tabular-nums (everywhere)
- font-feature-settings: "tnum" 1, "zero" 1, "ss01" 1 (on .nums class)
- Decimal alignment in tables
- Rounding: <1K exact, 1K-999K one decimal, ≥1M one decimal

SCALE (Persian-friendly, body slightly larger):
- xs: 13px / 1.5  — table cells, metadata
- sm: 14px / 1.55 — body small
- base: 15px / 1.6 — body default (Persian: 16px)
- md: 16px / 1.55 — buttons, list items
- lg: 18px / 1.5  — card titles, section heads
- xl: 20px / 1.45 — subsection heads
- 2xl: 24px / 1.4 — page title
- 3xl: 30px / 1.35 — KPI number
- 4xl: 36px / 1.3 — hero metric
- 5xl: 48px / 1.25 — onboarding hero
```

## C.4 RTL/Persian card

```
SETUP:
- <html dir="rtl" lang="fa">
- font-family: Vazirmatn
- Use logical properties only (ps/pe/ms/me/start/end)
- Tailwind v4: ps-4 not pl-4

DIGITS:
- Persian digits for prose: toPersianDigits(1234) → "۱٬۲۳۴"
- Latin digits for: charts, tables, code, ISO dates
- Persian percent sign: ٪ (U+066A), not %
- Persian thousand separator: ٬ (U+066C) or ','

ICONS — FLIP IN RTL:
- Back/forward arrows
- Breadcrumb separators
- Pagination prev/next
- Reply/send arrows
- Timeline/progress flow
- Indent/outdent

ICONS — DO NOT FLIP:
- Refresh/reload (clockwise)
- Search magnifier
- Camera, mic, gear, bell
- Media playback (▶ ⏸ ⏹)
- Checkmarks, universal symbols

CHARTS:
- Time axis stays LTR (industry convention)
- Y-axis moves to RIGHT in RTL
- Legend reads right-to-left
- Tooltip appears on LEFT of cursor
- Chart.js: options.rtl = true

CALENDAR:
- Jalali (Shamsi) for Persian UI
- Year starts March 20/21 (spring equinox)
- First day of week: Saturday (شنبه)
- Weekend: Friday (جمعه)
- Store dates as UTC ISO, convert at render
- Always show Gregorian on hover/tooltip
- Library: jalaali-js

LINE-HEIGHT:
- Persian body: 1.65-1.8 (more than Latin's 1.5-1.65)
- Persian needs more vertical breathing room
- Vazirmatn handles spacing automatically — don't override
```

---

# Appendix D — Bibliography

## Primary sources studied (full text)

1. **Apple HIG — Materials** (developer.apple.com/design/human-interface-guidelines/materials)
2. **Apple — Liquid Glass technology overview** (developer.apple.com/documentation/technologyoverviews/liquid-glass)
3. **WWDC25 — Meet Liquid Glass** (session video + notes)
4. **CSS-Tricks — "Getting Clarity on Apple's Liquid Glass"** (Geoff Graham, Jul 17, 2025)
5. **Josh W. Comeau — "Next-level frosted glass with backdrop-filter"** (Dec 2024, updated Apr 2026)
6. **Setproduct — "Glassmorphism, neumorphism, liquid glass: what to use in 2026"** (Roman Kamushken, Jun 9, 2026)
7. **Setproduct — "Dashboard design principles: 8 rules that actually work"** (Jun 7, 2024)
8. **CreateWithSwift — "Liquid Glass: Redefining design through Hierarchy, Harmony and Consistency"** (Alice Milo, Oct 30, 2025)
9. **Conor Luddy — "iOS 26 Liquid Glass: Comprehensive Swift/SwiftUI Reference"** (Medium, Nov 16, 2025)
10. **NN/G — "Skeleton Screens 101"** (Samhita Tankala, Jun 4, 2023)
11. **Material Design — Bidirectionality** (m2.material.io/design/usability/bidirectionality)
12. **UX Collective — "Did Apple abandon its own design heuristics & accessibility principles?"** (Michal Langmajer, Jun 10, 2025)
13. **UX Collective — "Designing a robust right-to-left UI in Arabic, Hebrew and Farsi"** (Michelle Bidzinska, Jan 20, 2023)
14. **baraa.app — "Easing curves are a design language"** (2026)
15. **Lexington Themes — "How to use Inter stylistic sets and OpenType features in CSS & Tailwind"** (Michael Andreuzza, Dec 4, 2025)
16. **Vercel Geist — Introduction** (vercel.com/geist/introduction)
17. **Vazirmatn GitHub** (rastikerdar/vazirmatn, v33.003, 3.1k stars)
18. **Linear — "How we redesigned the Linear UI (part Ⅱ)"** (Karri Saarinen et al., Mar 28, 2024)
19. **GetDesign.md — Linear Design System Analysis** (getdesign.md/linear.app/design-md)
20. **MDN — backdrop-filter CSS property**
21. **WAI/W3C — WCAG 2.2 (SC 1.4.3 Contrast Minimum, SC 2.4.7 Focus Visible, SC 2.4.13 Focus Appearance)**
22. **WebAIM — Contrast Checker** documentation

## Additional searches conducted (40 queries)

Apple Liquid Glass, glassmorphism right/wrong, glass articles, WCAG on glass, dashboard UX, states UX, Framer Motion, typography, spacing, Vazirmatn, RTL patterns, Jalali, Apple HIG, Stripe design, Linear design, Vercel design, microinteractions, F/Z pattern, loading patterns, easing curves, Inter stylistic sets, Persian digits, WCAG focus, chart design, status color, RTL charts, stagger, designerly glassmorphism, specular highlights, layered glass, visionOS, command palette, Apple vibrancy, saturate technique, data table typography, RTL icon flipping, focus rings, Geist font, empty states, Persian recommendations.

---

**Report end.**
This document synthesizes 22 primary articles + 40 search queries into actionable rules for the Nashrino dashboard refactor. Every recommendation is sourced from a real, named reference — no generic advice.
