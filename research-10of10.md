# 10/10 Dashboard Polish Research — Interaction, Motion & Craft Layer

**Task ID:** RESEARCH-3
**Subject:** The final 20% — micro-interactions, motion, real-time feedback, and craft details that separate an 8/10 dashboard from a 10/10 world-class dashboard
**Target stack:** Next.js 15 + Tailwind v4 + Framer Motion + cmdk + sonner + TanStack Query, Persian RTL social media management dashboard (Nashrino)
**Sources studied (primary, full-text fetched):**
- `linear.app/method` — Linear Method: practices for building
- `linear.app/docs/notifications` — Linear notification docs (channel categorization, 2,000-notification retention)
- `performance.dev/how-is-linear-so-fast-a-technical-breakdown` — Dennis Brotzky's reverse-engineering of Linear's stack (MobX, IndexedDB, sync engine, the actual `--speed-*` CSS variables Linear ships)
- `emilkowal.ski/ui/building-a-toast-component` — Emil Kowalski (Sonner author, Linear design engineer) on stacking, swipe velocity (0.11), pointer capture, document-hidden pause, gap-filling `:after` pseudo-elements
- `vercel.com/blog/design-engineering-at-vercel` — Vercel's design-engineer role: "delighters", iterate-to-greatness, no perfection trap
- `vercel.com/geist/skeleton` — Geist Skeleton best practices (size match, no permanent decoration, aria-busy)
- `knock.app/blog/how-to-design-great-keyboard-shortcuts` — Knock: 3 traits (discoverable, memorable, conflict-free), key-to-verb mapping, visual mapping, G+letter combos
- `tkdodo.eu/blog/concurrent-optimistic-updates-in-react-query` — TkDodo: `cancelQueries` + `setQueryData` + `isMutating({mutationKey})===1` to skip invalidations while a related mutation is in-flight
- `maggieappleton.com/command-bar` — Maggie Appleton: history of command-K bars, Spotlight 2005 → Linear/Raycast
- `uxpatterns.dev/patterns/advanced/command-palette` — Full anatomy: Trigger → Input → Grouped Results → Result Item → Empty State
- `evergreen.segment.com/patterns/empty-states` — Empty state anatomy: Border + Background + Visual + Headline + Body + CTA + Text Link
- `eleken.co/blog-posts/notification-ux` — 8 best practices + Linear/Notion/Slack/GitHub/Stripe comparisons
- `ibelick.com/blog/create-animated-gradient-borders-with-css` — `@property --angle` + `border-box`/`padding-box` gradient technique
- `docs.github.com/en/subscriptions-and-notifications/concepts/about-notifications` — GitHub's reason labels (mention, subscribed, review-requested), inbox filters, Done/Saved states, 5-month retention
- `setproduct.com/blog/notifications-ui-design` — Roman Kamushken: notification component taxonomy, priority levels, scenario→component mapping
- `simonhearne.com/2021/optimistic-ui-patterns` — Optimistic UI patterns: Allbirds mini-cart, Twitter favorite, contextual button states, pre-emptive loading
- `nngroup.com/articles/skeleton-screens` — NN/G: skeleton for 1–10s waits, progress bar for >10s, nothing for <1s, frame-display forbidden
- `figma.com/blog/principles-in-motion` — Figma motion designers on easing, anticipation, follow-through, settle
- `github.com/dip/cmdk` — Paco Coursey's cmdk: full part API (`Command`/`Dialog`/`Input`/`List`/`Item`/`Group`/`Separator`/`Empty`/`Loading`), `useCommandState`, nested pages pattern
- `tigerabrodi.blog/styling-sonner-toasts-advanced-guide` — Sonner dark-theme styling: colored rails, `--toast-animation-duration`, `[data-content]{flex:1}`, custom loading spinner, action-button colors
- `atlassian.design/content/writing-guidelines/empty-state` — Atlassian: "blank slate" vs "empty state" distinction, CTA = imperative verb, 1–2 word limit
- `figma.com/blog/the-linear-method-opinionated-software` — Linear's "opinionated software": one default way, atom-level opinions, strategic product debt
- `knock.app/blog/the-top-notification-libraries-for-react` — 9 React notification libraries compared (Sonner wins for shadcn/ui projects)
- 60 web searches across Linear/Vercel/Raycast/Notion/GitHub/Slack/Rauno/Framer Motion/Sonner/cmdk/RTL/Jalali/Persian-digits/optimistic-UI/ARIA-live/chart-tooltip/empty-state/dark-mode

**Builds on prior research:**
- `research-design-systems.md` (RESEARCH-1) — Linear, Vercel/Geist, Stripe, Apple HIG design-system deep dives; design tokens; anti-patterns; 10-token color/spacing/typography recommendations
- `research-glass-ux.md` (RESEARCH-2) — glass anti-patterns, dashboard UX rules (microinteractions, charts, color, loading, error states), motion tokens (5 easings + 5 durations + 3 spring presets), exact per-interaction timing table, Framer Motion best practices, Vazirmatn typography, Persian digit rendering, RTL icon flipping, Jalali UX

**This report covers the layer ABOVE those:** the specific, exact, code-level interaction patterns and motion choreography that turn the 8/10 foundation into a 10/10 product. Where RESEARCH-2 said "use `motion.respond` for hovers", this report says "the bell icon's unread badge should scale from 0.6→1.0 with a 280ms spring (stiffness 400, damping 25) 80ms after the badge first appears, then never animate again until the count changes" — that level of specificity.

---

## Table of Contents

1. [The 10/10 Gap Analysis — what separates 8/10 from 10/10](#1-the-1010-gap-analysis)
2. [30 Specific Micro-Interactions to Implement](#2-30-specific-micro-interactions)
3. [Notification System Anatomy — world-class bell popover spec](#3-notification-system-anatomy)
4. [Command Palette Anatomy — Cmd+K spec](#4-command-palette-anatomy)
5. [Motion System — exact Framer Motion variants](#5-motion-system)
6. [Theme Refinements — tint colors, gradient borders, hover states](#6-theme-refinements)
7. [RTL-Specific 10/10 Touches](#7-rtl-specific-1010-touches)
8. [Implementation Priority Matrix — top 10 ranked](#8-implementation-priority-matrix)
9. [Sources Cited](#9-sources-cited)

---

## 1. The 10/10 Gap Analysis

### The Final 20% — What most products miss

After studying Linear, Vercel, Stripe, Raycast, Notion, GitHub, and Slack in depth, the gap between 8/10 and 10/10 is **NOT** in:
- Visual design (already 8/10 = good color, type, spacing)
- Component library completeness (already 8/10 = all shadcn/ui components present)
- Layout / information architecture (already 8/10 = logical structure)

The gap IS in **six specific craft layers**, in order of impact:

#### 1.1 Perceived latency — the 100ms cause-and-effect threshold
Linear updates an issue in ~3ms because the database lives in the browser (IndexedDB) and mutations apply locally first, then sync asynchronously. A traditional CRUD app doing the same takes ~300ms. Even if you can't adopt Linear's full sync-engine architecture, **every mutation in Nashrino should reflect in the UI in <100ms** — before the server confirms. This is the single biggest difference between "feels instant" and "feels slow".

**What 8/10 does:** User clicks "publish" → 500ms spinner → success state.
**What 10/10 does:** User clicks "publish" → post immediately appears in the queue with a "publishing…" badge → server confirms 800ms later → badge changes to "published" → if it fails, revert with a toast.

#### 1.2 Asymmetric timing — Linear's actual CSS variables
Linear ships these exact timing tokens in their stylesheet (extracted by performance.dev):

```css
--speed-highlightFadeIn: 0s;       /* hover, popover, agent panel APPEAR */
--speed-highlightFadeOut: 0.15s;   /* hover, popover, agent panel DISAPPEAR */
--speed-quickTransition: 0.1s;     /* toggles, checkboxes, micro state */
--speed-regularTransition: 0.25s;  /* standard transitions */
--speed-slowTransition: 0.35s;     /* panels, large morphs */
```

The asymmetry rule is **non-negotiable**: entrances are instant or near-instant, exits take 150ms. This matches how the brain processes cause-and-effect — the user clicked, so the new state should be there *immediately*. When they dismiss, a 150ms fade gives their eye time to track the exit.

**What 8/10 does:** Same 200ms transition for both opening and closing a dropdown.
**What 10/10 does:** Dropdown opens instantly (0ms delay, but uses transform/opacity over 100ms so the eye perceives a "snap-in"), closes over 150ms with `ease-in`.

#### 1.3 Animate ONLY composite properties — never layout
Linear **never** animates `width`, `height`, `top`, `left`, `margin`, or `padding`. These force the browser to recompute the position of every subsequent element on every frame. Linear animates:
- `transform: translate() scale() rotate()` (GPU-composited)
- `opacity` (GPU-composited)
- `background-color`, `border-color` (paint-triggering but cheap)
- CSS custom properties (variables) that drive the above

**What 8/10 does:** Animates `height: 0 → auto` for an accordion.
**What 10/10 does:** Uses `transform: scaleY()` with `transform-origin: top` (or measures the content height with a `ResizeObserver` and animates `transform: translateY()` on inner content while the outer container uses `grid-template-rows: 0fr → 1fr` for true height animation — see §5.6).

#### 1.4 The "Linear feel" — five concrete pillars
From `performance.dev`'s breakdown, Linear's speed is a property of five things working together:

1. **Local-first data.** The UI reads from a local store (IndexedDB + MobX). There is no "loading issues" state because the issues are already on the user's machine. → Nashrino equivalent: cache all read-heavy data (channels, campaigns, content library) in TanStack Query with `staleTime: Infinity` and serve from cache first, refetch in background.
2. **Optimistic mutations.** When you change a status, the MobX observable updates instantly, the mutation writes to a durable queue in IndexedDB, and the network call happens later. The user never waits. → Nashrino: every mutation in the publish flow, content edits, and campaign changes should be optimistic.
3. **Granular reactivity.** A change to one field of one issue re-renders exactly the components that read that field — not the parent list. A 50-issue update is 50 cell re-renders, not a list re-render. → Nashrino: avoid `useState` for list items; use TanStack Query's granular cache + React 18's automatic batching.
4. **Keyboard-first input model.** Every common action has a shortcut. The command palette is one keystroke away (Cmd+K). Single letters edit the focused item; two-letter combos navigate (G+I = go to inbox); modifiers act globally. → Nashrino: see §4 command palette spec and §2 micro-interactions #11–15.
5. **Animation discipline.** Composite properties only, sub-100ms durations, asymmetric timing. → Nashrino: see §5 motion system.

#### 1.5 The "delighters" — Vercel's term for the polish layer
From `vercel.com/blog/design-engineering-at-vercel`: Vercel has a category of work called **"delighters"** — features in the dashboard that "bring it to life and delight the user" but aren't strictly necessary. The team explicitly allocates time for these. They include:
- No dropped frames (60fps or it doesn't ship)
- No cross-browser inconsistencies
- Accessibility baked in from the start
- Polished interactions (hover states, transitions, keyboard support)

**What 8/10 does:** Ships the feature, moves on. Polish happens "if there's time" (there never is).
**What 10/10 does:** Allocates dedicated time for delighters. The polish layer is a first-class deliverable, not an afterthought.

#### 1.6 The "thousand barely audible voices" — Sonner's philosophy
Emil Kowalski (Sonner author, Linear design engineer) quotes Paul Graham:

> "All those unseen details combine to produce something that's just stunning, like a thousand barely audible voices all singing in tune."

The 10/10 product is the sum of dozens of details no single user will consciously notice:
- Toasts pause their auto-dismiss timer when the tab is hidden
- A pseudo-element fills the gaps between stacked toasts so hover state doesn't flicker
- Pointer capture is set when dragging a toast so the drag continues even if the cursor leaves the toast
- Friction is applied when dragging a toast in the wrong direction (it slows down rather than stopping dead)
- The toast's loading spinner is `position: absolute` → you must override to `static` or it floats to the center

Each of these is invisible until you implement them wrong. Together, they're the difference between "this feels solid" and "this feels cheap".

---

## 2. 30 Specific Micro-Interactions to Implement

Each spec includes: trigger, animation, duration, easing, and implementation notes. Where applicable, the exact Framer Motion `variants` or CSS is given.

### Interaction 1 — Notification bell badge pop-in
**Trigger:** Unread count goes from 0 → N (or N → M where the user has been away).
**Animation:** Badge scales from `0.4 → 1.1 → 1.0` (slight overshoot) and fades in.
**Duration:** 280ms total (0→1.1 at 180ms, 1.1→1.0 at 100ms).
**Easing:** Spring `{ stiffness: 400, damping: 25, mass: 0.8 }`.
**RTL:** Badge positioned at top-LEFT of bell (mirror of LTR top-right).
**Implementation:**
```tsx
<motion.span
  key={notifCount}              // re-mounts when count changes → re-animates
  initial={{ scale: 0.4, opacity: 0 }}
  animate={{ scale: 1, opacity: 1 }}
  transition={{ type: "spring", stiffness: 400, damping: 25, mass: 0.8 }}
  className="absolute -top-1 -left-1 inline-flex min-w-[18px] …"
>
  {toPersianDigits(notifCount)}
</motion.span>
```
**Critical:** Use `key={notifCount}` so the badge re-mounts and re-animates each time the count changes — not just the first time.

### Interaction 2 — Notification bell popover open
**Trigger:** Click bell (or press `N` when bell is focused).
**Animation:** Popover scales from `0.96 → 1.0` and fades from `0 → 1`, originating from the bell icon (transform-origin: top-left in RTL).
**Duration:** 150ms enter (instant feel), 120ms exit.
**Easing:** `cubic-bezier(0.16, 1, 0.3, 1)` (Linear-style "fast-out, slow-in-out"), exit uses `cubic-bezier(0.4, 0, 1, 1)`.
**Implementation:**
```tsx
<AnimatePresence>
  {open && (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98, y: -2 }}
      transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
      style={{ transformOrigin: "top left" }}  // top right in LTR
      className="…"
    >
      {/* popover content */}
    </motion.div>
  )}
</AnimatePresence>
```

### Interaction 3 — Notification item hover (the "Linear row hover")
**Trigger:** Mouse enters notification row.
**Animation:** `background-color` transitions from transparent → `var(--row-hover)` over **120ms**. No transform, no border change. A 2px left accent bar (RTL: right) fades in.
**Duration:** 120ms enter, 80ms exit.
**Easing:** `linear` for `background-color` (paint property — fast in/out is fine).
**Critical:** Linear uses **120ms** specifically because it's under the 150ms "intentional" threshold but above the 80ms "did anything happen?" threshold. Hover at 200ms feels laggy; hover at 80ms feels twitchy.
```css
.notif-row {
  transition: background-color 120ms linear;
  background-color: transparent;
  position: relative;
}
.notif-row::before {        /* accent bar (RTL: right side) */
  content: "";
  position: absolute;
  inset-inline-end: 0;
  top: 0; bottom: 0;
  width: 2px;
  background: var(--accent);
  opacity: 0;
  transition: opacity 120ms linear;
}
.notif-row:hover {
  background-color: var(--row-hover);
}
.notif-row:hover::before {
  opacity: 1;
}
```

### Interaction 4 — Mark-as-read swipe (notification row)
**Trigger:** User swipes left (RTL: right) on a notification row, or clicks the "mark read" button.
**Animation:** The row's `background-color` shifts from `unread-bg` to `read-bg` over 200ms. The unread dot (●) scales from `1 → 0` over 150ms with `ease-in`. A subtle `transform: translateX(-2px)` (RTL: +2px) on the row indicates the action is processing.
**Duration:** 200ms total.
**Implementation:**
```tsx
const [marking, setMarking] = useState(false);
<motion.div
  animate={{
    backgroundColor: marking ? "var(--read-bg)" : "var(--unread-bg)",
    x: marking ? 2 : 0,    // RTL: +2px (nudges toward the start edge)
  }}
  transition={{ duration: 0.2, ease: [0.4, 0, 1, 1] }}
  onPan={(_, info) => {
    if (info.offset.x < -50) { setMarking(true); markAsRead(); }
  }}
>
  <motion.span
    className="unread-dot"
    animate={{ scale: marking ? 0 : 1, opacity: marking ? 0 : 1 }}
    transition={{ duration: 0.15, ease: "easeIn" }}
  />
</motion.div>
```

### Interaction 5 — Command palette open (Cmd+K)
**Trigger:** `Cmd+K` (Mac) / `Ctrl+K` (Win/Linux) anywhere in the app, OR click the search bar.
**Animation:** Backdrop fades `0 → 1` over 100ms (linear). The palette scales `0.98 → 1` and translates `y: -8 → 0` while fading `0 → 1`, total 200ms.
**Easing:** `cubic-bezier(0.16, 1, 0.3, 1)` (Linear's signature ease).
**Critical:** Focus moves to the input **immediately** on open (before animation finishes) so the user can start typing. The input has a subtle blinking caret.
```tsx
<motion.div
  initial={{ opacity: 0, scale: 0.98, y: -8 }}
  animate={{ opacity: 1, scale: 1, y: 0 }}
  exit={{ opacity: 0, scale: 0.98, y: -4 }}
  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
  onAnimationComplete={() => inputRef.current?.focus()}
>
```
**Exit:** Faster than enter — 120ms with `ease-in`.

### Interaction 6 — Command palette result selection
**Trigger:** Up/Down arrow keys, OR mouse hover on a result.
**Animation:** The selected item's `background-color` shifts to `var(--accent-muted)` over **80ms**. The accent bar on the inline-start side (RTL: right) appears. The item does NOT scale or translate — selection is a state change, not a motion event.
**Duration:** 80ms (instant-feeling).
**Critical:** When the user presses Down, the next item must be highlighted within 16ms (one frame at 60fps). Any delay here destroys the "Linear feel". cmdk handles this via `useSyncExternalStore`.

### Interaction 7 — Command palette enter action
**Trigger:** User presses Enter on a selected command.
**Animation:** The palette fades out `1 → 0` over **100ms** (faster than the open animation — exit is always faster). The selected item's background flashes to the accent color `0.4 alpha` for 80ms before fade. The destination view's first paint happens 100ms after Enter (during the fade), so by the time the palette is gone the new view is visible.
**Critical:** The command must execute **synchronously** on Enter press. Don't wait for the exit animation. If the command opens a view, navigate immediately.

### Interaction 8 — Button press feedback (the "premium press")
**Trigger:** Mouse down on any button.
**Animation:** `transform: scale(0.97)` over **80ms** with `ease-out`. On mouse up, scale back to `1.0` over **120ms** with `ease-out`. Background color shifts to the active variant simultaneously.
**Critical:** This is the #1 difference between "feels cheap" and "feels premium" (per RESEARCH-2 §F6). Every interactive element — buttons, icon buttons, tabs, list items, cards — needs this. Use Framer Motion's `whileTap`:
```tsx
<motion.button
  whileHover={{ scale: 1.0 }}
  whileTap={{ scale: 0.97 }}
  transition={{ duration: 0.08, ease: "easeOut" }}
>
```
**Alternative (pure CSS, no JS):** `active:scale-[0.97] transition-transform duration-75 ease-out`.

### Interaction 9 — Toggle switch animation
**Trigger:** User clicks a toggle (or presses Space when focused).
**Animation:** The thumb (circle) translates from one end to the other over **150ms** with `cubic-bezier(0.4, 0, 0.2, 1)` (snap curve). The track's background-color transitions over **200ms** (slower than the thumb — the track is "following" the thumb's state change). On state change, a subtle "ripple" emanates from the thumb's new position.
**Critical:** Never animate the toggle's `width` or the thumb's `width` — only `transform: translateX()` on the thumb and `background-color` on the track.
```tsx
<motion.div
  className="toggle-track"
  animate={{ backgroundColor: isOn ? "var(--accent)" : "var(--toggle-off)" }}
  transition={{ duration: 0.2, ease: "easeOut" }}
>
  <motion.div
    className="toggle-thumb"
    animate={{ x: isOn ? 20 : 0 }}    // 20px = track width - thumb width - 2*padding
    transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
  />
</motion.div>
```

### Interaction 10 — Copy-to-clipboard feedback
**Trigger:** User clicks a copy button (URL, API key, share link, post text).
**Animation:** Three-phase:
1. **Phase 1 (0–100ms):** Icon swaps from `Copy` to `Check` with a cross-fade + slight scale-down on the old icon (0.9, opacity 0) and scale-up on the new (0.9→1.0, opacity 0→1).
2. **Phase 2 (100–1800ms):** "کپی شد" tooltip appears above the button (fade + slight `y: 4 → 0` over 150ms). Icon stays as `Check`.
3. **Phase 3 (1800–2000ms):** Tooltip fades out over 150ms. Icon reverts to `Copy` over 100ms.

**Critical:** The feedback must be immediate (<100ms) and persist for ~1.8s so the user has time to register it. If it's too short (<1s), the user isn't sure it worked. If it's too long (>3s), it feels sticky.
```tsx
const [copied, setCopied] = useState(false);
const copy = async () => {
  await navigator.clipboard.writeText(text);
  setCopied(true);
  setTimeout(() => setCopied(false), 2000);
};
<AnimatePresence mode="wait">
  {copied ? (
    <motion.div key="check" initial={{opacity:0, scale:0.9}} animate={{opacity:1, scale:1}} exit={{opacity:0, scale:0.9}} transition={{duration:0.1}}>
      <Check className="size-4 text-success" />
    </motion.div>
  ) : (
    <motion.div key="copy" initial={{opacity:0, scale:0.9}} animate={{opacity:1, scale:1}} exit={{opacity:0, scale:0.9}} transition={{duration:0.1}}>
      <Copy className="size-4" />
    </motion.div>
  )}
</AnimatePresence>
```

### Interaction 11 — Sidebar nav item active indicator (shared layout animation)
**Trigger:** User clicks a different sidebar item (or navigates via G+letter shortcuts).
**Animation:** The active-item accent bar (a 3px-wide vertical strip on the inline-start side) **slides** from the old item's position to the new item's position over **300ms** with `cubic-bezier(0.16, 1, 0.3, 1)`. This is Framer Motion's `layoutId` shared-element transition — the same physical element moves between items.
**Critical:** This is the single most "Linear-feeling" micro-interaction. Without `layoutId`, you'd have two separate bars fading in/out — that feels cheap. With `layoutId`, it's one bar that glides.
```tsx
{navItems.map(item => (
  <button key={item.id} onClick={() => setActive(item.id)}>
    {active === item.id && (
      <motion.div
        layoutId="sidebar-active-bar"
        className="absolute inset-inline-start-0 w-[3px] bg-accent rounded-full"
        style={{ top: 8, bottom: 8 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      />
    )}
    <Icon /> {item.label}
  </button>
))}
```

### Interaction 12 — Tab underline slide
**Trigger:** User clicks a different tab.
**Animation:** The underline (2px strip beneath the active tab) slides horizontally to the new tab's position over **200ms** with `cubic-bezier(0.16, 1, 0.3, 1)`. Same `layoutId` technique as #11.
```tsx
{tabs.map(tab => (
  <button key={tab.id} onClick={() => setActive(tab.id)}>
    {tab.label}
    {active === tab.id && (
      <motion.div layoutId="tab-underline" className="absolute bottom-0 inset-x-0 h-[2px] bg-accent"
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }} />
    )}
  </button>
))}
```

### Interaction 13 — Toast entrance (Sonner-style)
**Trigger:** `toast.success("Post published")` is called.
**Animation:** Toast slides up from `y: 100%` (below the viewport) and fades `0 → 1` over **400ms** with `cubic-bezier(0.21, 1.02, 0.73, 1)` (slight overshoot spring). Older toasts scale down by `0.05 * index` and translate up by `gap * index` to create the stacked effect.
**Position:** Default to `bottom-center` on desktop (less intrusive than `top-right`), `top-center` on mobile.
**Critical:** Use CSS transitions (not keyframes) so the animation is **interruptible** — if a new toast arrives mid-animation, the old ones smoothly transition to their new positions instead of jumping.

### Interaction 14 — Toast swipe-to-dismiss
**Trigger:** User drags a toast downward (toward where it came from).
**Animation:** Toast follows the pointer (`translateY` = drag distance). When released: if drag distance > 80px OR velocity > 0.11 px/ms (Sonner's threshold), the toast dismisses with a quick fade (150ms). Otherwise, it springs back to `translateY: 0` with a spring.
**Friction detail:** If the user drags *up* (wrong direction), apply friction — the toast moves at 1/3 the drag distance, creating a "rubber band" feel rather than a hard stop.
**Pointer capture:** Set `setPointerCapture` on the toast when drag starts so the drag continues even if the cursor leaves the toast.

### Interaction 15 — Toast tab-visibility pause
**Trigger:** User switches to another browser tab while a toast is visible.
**Animation:** The toast's 4-second auto-dismiss timer pauses. When the user returns to the tab, the timer resumes.
**Implementation:** Use `document.visibilitychange` event. Sonner does this out of the box via `useIsDocumentHidden()`.
**Critical:** Without this, a toast triggered right before the user switches tabs disappears before they see it. They'll never know what happened.

### Interaction 16 — KPI count-up animation
**Trigger:** A KPI card mounts (page load or view switch) with a numeric value.
**Animation:** The number animates from `0 → value` (or `previousValue → value` on updates) over **800ms** with `cubic-bezier(0.16, 1, 0.3, 1)`. The animation uses `requestAnimationFrame` to update the displayed value each frame.
**Persian digits:** Convert each frame's value to Persian digits using `toPersianDigits(Math.round(currentValue))`.
**Critical:** Only count up on **first mount** — not on every re-render. Subsequent updates should cross-fade the number (200ms) or jump directly. Count-up on every data refresh feels gimmicky.
```tsx
function useCountUp(target: number, duration = 800) {
  const [value, setValue] = useState(0);
  const startRef = useRef<number>();
  const fromRef = useRef(0);
  useEffect(() => {
    fromRef.current = value;
    startRef.current = undefined;
    let raf: number;
    const step = (ts: number) => {
      if (startRef.current === undefined) startRef.current = ts;
      const progress = Math.min((ts - startRef.current) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);   // ease-out cubic
      setValue(fromRef.current + (target - fromRef.current) * eased);
      if (progress < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}
// Usage:
const v = useCountUp(metric.value);
<span className="num-tabular">{toPersianDigits(Math.round(v))}</span>
```
**Reduced motion:** If `prefers-reduced-motion: reduce`, skip the animation and render the final value immediately.

### Interaction 17 — Skeleton shimmer
**Trigger:** Data is loading (TanStack Query `isLoading`).
**Animation:** A gradient sweeps across the skeleton from inline-start to inline-end (RTL: right to left), looping every **1500ms**. The gradient is `linear-gradient(90deg, transparent, var(--shimmer-highlight), transparent)` with `background-size: 200% 100%` and `animation: shimmer 1.5s infinite`.
**Critical:** The skeleton must **exactly match the size** of the content that will replace it (Vercel Geist guidance). A `200×20` block becoming an `80×16` string reads as a glitch. Use `min-height`/`min-width` to lock dimensions.
```css
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
.skeleton {
  background: linear-gradient(90deg,
    var(--skeleton-base) 0%,
    var(--skeleton-highlight) 50%,
    var(--skeleton-base) 100%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite ease-in-out;
}
@media (prefers-reduced-motion: reduce) {
  .skeleton { animation: none; background: var(--skeleton-base); }
}
```

### Interaction 18 — Skeleton → content fade-in
**Trigger:** Data resolves (TanStack Query `isSuccess`).
**Animation:** Skeleton fades out `1 → 0` over 150ms. Content fades in `0 → 1` over 200ms with a slight `y: 4 → 0` (content "settles into place"). The two overlap by 50ms so there's no blank frame.
**Critical:** Use `AnimatePresence mode="wait"` so the skeleton fully exits before content enters, OR `mode="popLayout"` for simultaneous fade. Linear uses the latter (simultaneous) for instant feel.
```tsx
<AnimatePresence mode="popLayout">
  {isLoading ? (
    <motion.div key="skeleton" exit={{opacity:0}} transition={{duration:0.15}}>
      <Skeleton className="h-4 w-full" />
    </motion.div>
  ) : (
    <motion.div key="content" initial={{opacity:0, y:4}} animate={{opacity:1, y:0}} transition={{duration:0.2, ease:[0.16,1,0.3,1]}}>
      {actualContent}
    </motion.div>
  )}
</AnimatePresence>
```

### Interaction 19 — Modal/sheet spring entrance
**Trigger:** User opens a modal (e.g., compose dialog, settings modal).
**Animation:** Backdrop fades `0 → 1` over 200ms (linear). Modal scales `0.96 → 1` and translates `y: 12 → 0` while fading `0 → 1`, with a spring: `{ stiffness: 300, damping: 26, mass: 1 }`. The spring gives a subtle overshoot (~3%) that feels physical.
**Exit:** Backdrop fades `1 → 0` over 150ms. Modal scales `1 → 0.96` and translates `y: 0 → 8` while fading `1 → 0` over 180ms with `ease-in`.
```tsx
const modalSpring = { type: "spring", stiffness: 300, damping: 26, mass: 1 };
<motion.div className="backdrop" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:0.2, ease:"linear"}} />
<motion.div className="modal" initial={{opacity:0, scale:0.96, y:12}} animate={{opacity:1, scale:1, y:0}} exit={{opacity:0, scale:0.96, y:8}} transition={modalSpring} />
```

### Interaction 20 — List item stagger entrance
**Trigger:** A list (notifications, content items, campaign list) mounts or new items arrive.
**Animation:** Each item animates `opacity: 0 → 1` and `y: 8 → 0` with a stagger of **40ms** between items, each item taking 250ms with `cubic-bezier(0, 0, 0.2, 1)`. The stagger starts after a 100ms delay (so the parent's enter animation finishes first).
**Critical:** Cap the stagger at 8 items (320ms total). After 8, items appear instantly. Otherwise long lists take 2+ seconds to render and feel broken.
```tsx
const container = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.04, delayChildren: 0.1 } },
};
const item = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: [0, 0, 0.2, 1] } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.2, ease: [0.4, 0, 1, 1] } },
};
<motion.ul variants={container} initial="hidden" animate="visible">
  <AnimatePresence>
    {items.slice(0, 8).map(i => <motion.li key={i.id} variants={item} layout>{i.content}</motion.li>)}
    {items.slice(8).map(i => <li key={i.id}>{i.content}</li>)}
  </AnimatePresence>
</motion.ul>
```

### Interaction 21 — Page transition (view switch)
**Trigger:** User clicks a sidebar item OR navigates via Cmd+K.
**Animation:** Old view fades `1 → 0` over 150ms with `ease-in`. New view fades `0 → 1` over 200ms with `ease-out` and translates `y: 8 → 0`. The two overlap by 50ms.
**Critical:** Page transitions should feel like a "soft cut", not a slide. Linear doesn't slide pages — it cross-fades with a subtle upward drift. Sliding feels like a mobile app; cross-fade feels like a desktop app.
```tsx
<AnimatePresence mode="wait">
  <motion.div key={activeView} initial={{opacity:0, y:8}} animate={{opacity:1, y:0}} exit={{opacity:0}} transition={{duration:0.2, ease:[0.16,1,0.3,1]}}>
    {renderView(activeView)}
  </motion.div>
</AnimatePresence>
```

### Interaction 22 — Card hover lift
**Trigger:** Mouse enters an interactive card (campaign card, content card, KPI card with details).
**Animation:** Card elevates: `box-shadow` transitions to a deeper shadow over 200ms. A 1px border-color shift toward accent. `transform: translateY(-2px)` over 200ms. NO scale (scale on cards feels cheap — they're not buttons).
**Critical:** The lift is 2px, not 4px or 8px. 2px is the threshold where the brain registers "this is elevated" without it feeling cartoonish. Linear uses 2px throughout.
```css
.card { transition: box-shadow 200ms ease, transform 200ms ease, border-color 200ms ease; }
.card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px -8px rgba(0,0,0,0.12), 0 4px 8px -4px rgba(0,0,0,0.06);
  border-color: var(--accent-muted);
}
```

### Interaction 23 — Tooltip appear (with delay)
**Trigger:** Mouse enters an element with a tooltip.
**Animation:** Tooltip fades `0 → 1` and translates `y: 4 → 0` over **120ms** with `ease-out`. There's a **500ms delay** before the tooltip appears (so quick mouse-overs don't trigger it). On mouse leave, the tooltip fades `1 → 0` over **80ms** with no delay.
**Critical:** The 500ms delay is the difference between "helpful" and "annoying". Below 300ms, tooltips flicker on every mouse pass. Above 700ms, they feel sluggish. 500ms is the sweet spot (matches Radix UI's default).
**Implementation:** Use Radix UI's `Tooltip` (already in the codebase) — it handles delay, positioning, and RTL flipping automatically.

### Interaction 24 — Tooltip with keyboard shortcut hint
**Trigger:** User hovers over a button that has a keyboard shortcut.
**Animation:** Tooltip appears (per #23) showing the button label + a `<kbd>` element showing the shortcut. The kbd has a subtle inset shadow and monospace font.
**Critical:** Showing shortcuts in tooltips is one of the **three ways great products surface shortcuts** (per Knock's research). The other two: a shortcuts reference guide (`?` to open) and the command palette. All three are needed.

### Interaction 25 — Dropdown menu open
**Trigger:** User clicks a dropdown trigger (e.g., "filter" button).
**Animation:** Menu scales `0.95 → 1` and translates `y: -4 → 0` while fading `0 → 1`, total **150ms** with `cubic-bezier(0.16, 1, 0.3, 1)`. Origin is the trigger button (top edge).
**Exit:** 100ms with `ease-in` — faster than open.
**Critical:** The menu must appear to "grow out of" the trigger button, not fade in from nowhere. This is what performance.dev means by "motion doing spatial work, telling the user where the new element came from".

### Interaction 26 — Optimistic toggle (server-confirmed toggle)
**Trigger:** User clicks a toggle that updates the server.
**Animation:** Toggle animates to the new state **immediately** (per #9). A subtle progress indicator (a thin loading bar at the bottom of the toggle thumb) appears, animating from 0% to 100% over the expected server response time (~300ms). When the server confirms, the bar disappears. If the server rejects, the toggle animates back and an error toast appears.
**Critical:** This is the "Linear feel" in a single interaction. The user sees their change instantly. The progress bar gives them confidence it's processing. The confirmation is silent (no toast on success — only on error). Reverting on failure is automatic.
```tsx
const useOptimisticToggle = (id: string) => useMutation({
  mutationFn: (next: boolean) => api.patch(`/api/items/${id}`, { active: next }),
  onMutate: async (next) => {
    await queryClient.cancelQueries({ queryKey: ["item", id] });
    const prev = queryClient.getQueryData(["item", id]);
    queryClient.setQueryData(["item", id], (old) => ({ ...old, active: next }));
    return { prev };
  },
  onError: (_e, _next, ctx) => {
    queryClient.setQueryData(["item", id], ctx.prev);
    toast.error("تغییرات ذخیره نشد. دوباره تلاش کنید.");
  },
  onSettled: () => {
    if (queryClient.isMutating({ mutationKey: ["item", id] }) === 1) {
      queryClient.invalidateQueries({ queryKey: ["item", id] });
    }
  },
});
```

### Interaction 27 — Connection status indicator (WebSocket)
**Trigger:** WebSocket connects, disconnects, or reconnects.
**Animation:** A small dot (8px) in the sidebar footer:
- **Connected:** Solid green dot, no animation.
- **Connecting:** Amber dot with a slow pulse (`opacity: 1 → 0.4 → 1`, 1500ms loop).
- **Disconnected:** Red dot with a faster pulse (`opacity: 1 → 0.2 → 1`, 800ms loop) + tooltip "ارتباط قطع شد — در حال تلاش مجدد…".
**Critical:** The dot should be visible but unobtrusive. 8px in the sidebar footer is the right size and location. Never use a modal or toast for connection state — it's persistent, not transient.
```tsx
<motion.span
  className="size-2 rounded-full"
  animate={{
    backgroundColor: status === "connected" ? "#22c55e" : status === "connecting" ? "#f59e0b" : "#ef4444",
    opacity: status === "connected" ? 1 : [1, 0.4, 1],
  }}
  transition={{
    backgroundColor: { duration: 0.3 },
    opacity: { duration: status === "disconnected" ? 0.8 : 1.5, repeat: Infinity, ease: "easeInOut" },
  }}
/>
```

### Interaction 28 — Progress bar (publishing job)
**Trigger:** A publishing job starts.
**Animation:** Bar fills from 0% to 100% with `transition: width 300ms ease-out` on each update. When the job is indeterminate (no % available), the bar shows a sliding shimmer (gradient sweeping left-to-right, RTL: right-to-left) instead of a fixed fill.
**Critical:** Updates should be smooth (300ms) but not laggy. If the server sends 5 updates per second, each update animates over 300ms and the next update interrupts the previous — this gives a continuous smooth fill. Never use `width: auto` or animate `width` from `0` to `auto` — use a numeric percentage.
```tsx
// Determinate
<div className="h-1.5 bg-surface rounded-full overflow-hidden">
  <motion.div className="h-full bg-accent rounded-full"
    animate={{ width: `${progress}%` }}
    transition={{ duration: 0.3, ease: "easeOut" }} />
</div>
// Indeterminate (RTL: animate background-position from 100% to -100%)
<div className="h-1.5 rounded-full overflow-hidden bg-surface">
  <div className="h-full w-1/3 bg-accent rounded-full animate-[indeterminate_1.2s_infinite_ease-in-out]"
    style={{ animationDirection: "reverse" }} />  {/* RTL reverse */}
</div>
```

### Interaction 29 — Empty state entrance
**Trigger:** A list/view loads with zero items.
**Animation:** The empty state (illustration + headline + description + CTA) fades in `0 → 1` and translates `y: 8 → 0` over **400ms** with `cubic-bezier(0.16, 1, 0.3, 1)`. The illustration has a subtle floating animation (continuous `y: 0 → -4 → 0`, 3s loop, ease-in-out).
**Critical:** Don't show the empty state instantly — that feels like an error. The 400ms fade gives the user time to register that the page loaded *and* it's intentionally empty. The floating illustration adds life without being distracting.

### Interaction 30 — Number tabular alignment on KPI updates
**Trigger:** KPI value updates (e.g., "published today" goes from 5 to 6).
**Animation:** NO animation on the number itself (per #16, only count-up on first mount). Instead, the number uses `font-variant-numeric: tabular-nums` so digits are equal-width — when 5 becomes 6, the layout doesn't shift. If the digit count changes (9 → 10), the container is `min-width` locked to prevent layout shift.
**Critical:** This is invisible when done right and jarring when done wrong. Linear, Vercel, and Stripe all use `tabular-nums` on every numeric display. Nashrino's existing `num-tabular` class does this — make sure it's applied everywhere numbers appear.

---

## 3. Notification System Anatomy

### 3.1 The complete spec — world-class notification bell popover

Based on direct study of Linear, GitHub, Slack, Vercel, and Notion notification UIs, here is the exact anatomy of a 10/10 notification bell popover.

#### Trigger button
- **Icon:** Lucide `Bell` (15px, `strokeWidth: 2`).
- **Container:** 40×40px, glass-control style (per existing Nashrino pattern).
- **Active state (when popover open):** Background shifts to `var(--surface-active)`.
- **Hover:** `background-color` 120ms transition to `var(--surface-hover)`, icon color `ink-secondary → ink-primary`.
- **Press:** `transform: scale(0.96)` over 80ms.
- **Unread badge:** Top-LEFT corner in RTL (mirror of LTR top-right). 18px min-width, pill-shaped, `bg-danger` (red), white text 9.5px, `font-variant-numeric: tabular-nums`. Persian digits via `toPersianDigits`. 2px white ring around it for contrast against the glass. Animates per Interaction #1 when count changes.
- **Keyboard:** `N` focuses the bell (when not in an input), `Enter`/`Space` opens popover, `Escape` closes.

#### Popover container
- **Size:** 380px wide, max-height 480px (scrollable internally).
- **Position:** Anchored to the bell, aligned to the inline-end edge in RTL (left edge of popover aligns with left edge of bell — flipped from LTR).
- **Glass:** Use the existing `n-glass` treatment for the popover surface.
- **Border:** 1px solid `var(--border)` + subtle `box-shadow: 0 8px 32px -8px rgba(0,0,0,0.16)`.
- **Open animation:** Per Interaction #2.
- **Close animation:** 120ms fade + slight scale-down.

#### Header (48px tall)
Structure left-to-right (in RTL: right-to-left):
1. **Title:** "اعلان‌ها" (Notifications), 14px semibold, `ink-primary`.
2. **Filter tabs (segmented control):** "همه" (All) · "خوانده‌نشده" (Unread) · "نشان‌شده‌ها" (Mentioned). Active tab has a 2px underline that slides per Interaction #12. Each tab shows a count in parentheses, Persian digits.
3. **"علامت‌گذاری همه به‌عنوان خوانده‌شده" (Mark all read) button:** Text-only, 11px, `ink-tertiary` → `ink-primary` on hover. Icon: `CheckCheck` (14px). Disabled when no unread items.

```tsx
<div className="flex items-center justify-between px-4 h-12 border-b border-border">
  <h3 className="text-sm font-semibold">اعلان‌ها</h3>
  <div className="flex items-center gap-1">
    {["all", "unread", "mentioned"].map(tab => (
      <button key={tab} className="relative px-2 py-1 text-[11px]" onClick={() => setFilter(tab)}>
        {tab === "all" ? "همه" : tab === "unread" ? "خوانده‌نشده" : "نشان‌شده‌ها"}
        {filter === tab && <motion.div layoutId="notif-tab-underline" className="absolute bottom-0 inset-x-0 h-[2px] bg-accent" />}
      </button>
    ))}
    <button onClick={markAllRead} disabled={unreadCount === 0} className="ms-2 text-[11px] text-ink-tertiary hover:text-ink-primary disabled:opacity-40">
      <CheckCheck className="size-3.5" />
    </button>
  </div>
</div>
```

#### List (scrollable area, max 432px)
- **Grouping:** Items grouped by date: "امروز" (Today) · "دیروز" (Yesterday) · "این هفته" (This week) · "قدیمی‌تر" (Older). Group headers are 11px uppercase (well, in Persian: just smaller), `ink-tertiary`, 8px padding top.
- **Item layout (per row, 64px tall):**
  1. **Icon (32px):** Variant-specific icon in a circular tinted background.
     - Comment: `MessageCircle` in blue tint
     - Mention: `AtSign` in purple tint
     - Approval request: `Clock` in amber tint
     - Publish success: `Check` in green tint
     - Publish failure: `AlertTriangle` in red tint
     - New follower: `UserPlus` in neutral tint
  2. **Content (flex-1):**
     - **Actor line:** "[Actor name] [action verb] [target]" — 12.5px, `ink-secondary`. Actor name is `ink-primary` semibold. Example: "سارا احمدی روی پست «راه‌اندازی کمپین زمستان» کامنت گذاشت".
     - **Preview line:** First line of the comment/notification body, truncated to 1 line, 11px, `ink-tertiary`.
     - **Timestamp:** "۲ دقیقه پیش" (2 minutes ago), 10px, `ink-tertiary`. Persian relative time.
  3. **Unread indicator (8px dot):** Solid `bg-accent` circle at the inline-end edge. Animates per Interaction #4 when marked read.
  4. **Action buttons (on hover):** "خوانده‌شد" (Mark read) and "نادیده بگیر" (Dismiss) appear on hover, 80ms fade-in.
- **Item hover:** Per Interaction #3 — `background-color` 120ms + accent bar fade-in.
- **Item click:** Deep-links to the relevant view (e.g., comment notification → opens content view at that post).
- **Swipe:** Per Interaction #4 — swipe inline-start (RTL: swipe left) to mark read, swipe inline-end (RTL: swipe right) to dismiss.
- **Stagger entrance:** Per Interaction #20 — items stagger in on first open.

```tsx
<motion.div variants={container} initial="hidden" animate="visible">
  {groupedNotifications.map(group => (
    <div key={group.label}>
      <div className="px-4 pt-3 pb-1 text-[11px] text-ink-tertiary">{group.label}</div>
      {group.items.map(notif => (
        <motion.div key={notif.id} variants={item} layout
          className="notif-row relative flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-surface-hover"
          onClick={() => handleOpen(notif)}>
          <div className={cn("size-8 rounded-full flex items-center justify-center shrink-0", iconTint[notif.type])}>
            <Icon className="size-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12.5px] text-ink-secondary">
              <span className="font-semibold text-ink-primary">{notif.actor.name}</span>{" "}{notif.action}{" "}
              <span className="text-ink-primary">{notif.target}</span>
            </p>
            {notif.preview && <p className="text-[11px] text-ink-tertiary truncate mt-0.5">{notif.preview}</p>}
            <p className="text-[10px] text-ink-tertiary mt-1">{persianRelativeTime(notif.timestamp)}</p>
          </div>
          {notif.unread && <span className="size-2 rounded-full bg-accent shrink-0 mt-1.5" />}
        </motion.div>
      ))}
    </div>
  ))}
</motion.div>
```

#### Empty state (when no notifications)
- Centered in the 432px scroll area.
- **Illustration:** A simple bell icon (48px) in `ink-quaternary` with a small "Z" sleeping mark — conveys "all caught up".
- **Headline:** "همه‌چیز رو خوندی" (You're all caught up), 14px semibold, `ink-secondary`.
- **Description:** "اعلان جدیدی وجود ندارد." (No new notifications.), 12px, `ink-tertiary`.
- **Animation:** Per Interaction #29.

#### Footer (40px tall)
- **Single link:** "مشاهده همه در صندوق ورودی" (View all in inbox), 11px, `accent` color, click navigates to inbox view.
- **Border-top:** 1px `var(--border)`.

#### Real-time updates
- New notifications arrive via WebSocket (or TanStack Query `refetchInterval: 30000` as fallback).
- When a new notification arrives while the popover is open: it appears at the top of the list with a 250ms enter animation (per Interaction #20). The unread badge on the bell updates per Interaction #1.
- When the popover is closed and a new notification arrives: the bell badge updates + a toast is shown (per Interaction #13) if the notification is high-priority (mention, approval request, publish failure).

#### Accessibility
- `role="dialog"` on the popover, `aria-labelledby` pointing to the title.
- Focus trap inside the popover when open (Radix Popover handles this).
- `aria-live="polite"` on a visually-hidden region that announces "اعلان جدید: [actor] [action]" when a new notification arrives.
- `Escape` closes the popover and returns focus to the bell.
- All action buttons have `aria-label`s in Persian.
- Keyboard navigation: `Tab` cycles through filter tabs → mark-all-read → list items → footer link. `Enter` activates. `↑`/`↓` navigate list items (cmdk-style).

---

## 4. Command Palette Anatomy

### 4.1 The complete spec — world-class Cmd+K

Based on cmdk (Paco Coursey, used by Vercel), Linear's command bar, Raycast, and Notion's command menu.

#### Trigger
- **Keyboard:** `Cmd+K` (Mac) / `Ctrl+K` (Win/Linux) anywhere in the app, except when focused in a text input/textarea (then it inserts a character). Detect: `if (e.key === "k" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); setOpen(true); }`.
- **Click:** The search bar in the command bar (top of app) opens the palette.
- **Visual hint:** The search bar shows `⌘K` kbd on the inline-end side (per existing Nashrino pattern).

#### Overlay
- **Backdrop:** `bg-black/40` (light mode) / `bg-black/60` (dark mode), `backdrop-blur-sm`. Fades in 100ms.
- **Position:** Palette is centered horizontally, 15% from top of viewport (not vertically centered — vertically centered feels like a modal).
- **Size:** 560px wide, max-height 480px (grows with content, scrolls internally).
- **Open/exit animation:** Per Interaction #5.

#### Palette container structure (top to bottom)

```
┌─────────────────────────────────────────────────────────────┐
│  [🔍 Search icon]  جستجو یا اجرای فرمان…           [ESC]   │  ← Input row (56px)
├─────────────────────────────────────────────────────────────┤
│  ───────────── 页 Page (مسیرها)  ─────────────              │  ← Group heading
│   ▸  داشبورد                                      G then D  │  ← Item with shortcut
│   ▸  صندوق ورودی                                  G then I  │
│   ▸  محتوا                                        G then C  │
│                                                              │
│  ───────────── ✦ Actions (عملیات)  ─────────────            │
│   ▸  انتشار جدید                                  C         │
│   ▸  جستجوی محتوا…                                          │
│                                                              │
│  ───────────── ⚙ Settings (تنظیمات)  ─────────────          │
│   ▸  تغییر تم                                     ⌘⇧L       │
│                                                              │
│  ───────────── Recently used (اخیر)  ─────────────          │
│   ▸  ویرایش پست «کمپین نوروز»                               │
├─────────────────────────────────────────────────────────────┤
│  ↑↓ navigate   ↵ select   esc close            3 results    │  ← Footer (32px)
└─────────────────────────────────────────────────────────────┘
```

#### Input row (56px tall)
- **Icon:** `Search` (18px), `ink-tertiary`, positioned inline-start with 16px padding.
- **Input:** Full-width, transparent background, no border. Placeholder: "جستجو یا اجرای فرمان…" (Search or run a command…). 14px, `ink-primary`. Autofocus on open.
- **ESC chip:** On inline-end, a small `ESC` kbd hint (10px, `ink-tertiary`) — clicking it closes the palette.
- **RTL:** All paddings/margins use logical properties (`ps-`/`pe-` in Tailwind v4) so the layout mirrors automatically.
```tsx
<div className="flex items-center gap-3 px-4 h-14 border-b border-border">
  <Search className="size-[18px] text-ink-tertiary shrink-0" />
  <CommandPrimitive.Input
    ref={inputRef}
    placeholder="جستجو یا اجرای فرمان…"
    className="flex-1 bg-transparent text-sm text-ink-primary placeholder:text-ink-tertiary outline-none"
  />
  <kbd className="text-[10px] text-ink-tertiary px-1.5 py-0.5 rounded border border-border">ESC</kbd>
</div>
```

#### List (scrollable, max 392px)
- **Filtering:** cmdk's built-in fuzzy filter. Set `shouldFilter={true}` (default). For RTL, the filter works on Persian text natively (cmdk uses `String.includes` + ranking).
- **Group headings:** 11px, `ink-tertiary`, uppercase (in Persian: just smaller), 12px padding top, 8px padding bottom, 16px horizontal padding. A subtle `border-t` separates groups.
- **Item layout (40px tall):**
  - **Icon (16px):** `ink-secondary`, positioned inline-start.
  - **Label:** 13px, `ink-primary`. Truncated with `text-ellipsis` if too long.
  - **Shortcut hint (kbd):** On inline-end, 11px, `ink-tertiary`. E.g., `G then D` shows as two kbd elements with "then" text between.
  - **Selected state:** `background-color: var(--surface-hover)` + 2px accent bar on inline-start. Per Interaction #6 — 80ms transition.
  - **Disabled state:** 50% opacity, `cursor: not-allowed`.

```tsx
<CommandPrimitive.List className="max-h-[392px] overflow-y-auto">
  <CommandPrimitive.Empty>
    <div className="py-12 text-center">
      <SearchX className="size-8 mx-auto text-ink-quaternary mb-2" />
      <p className="text-sm text-ink-secondary">نتیجه‌ای پیدا نشد</p>
      <p className="text-xs text-ink-tertiary mt-1">برای دیدن همه فرمان‌ها، جستجو را خالی کنید</p>
    </div>
  </CommandPrimitive.Empty>

  <CommandPrimitive.Group heading="مسیرها">
    <CommandPrimitive.Item onSelect={() => navigate("dashboard")}>
      <LayoutDashboard className="size-4" />
      <span>داشبورد</span>
      <kbd className="ms-auto">G</kbd><span className="text-ink-tertiary text-[10px]">then</span><kbd>D</kbd>
    </CommandPrimitive.Item>
    {/* … */}
  </CommandPrimitive.Group>

  <CommandPrimitive.Group heading="عملیات">
    <CommandPrimitive.Item onSelect={() => navigate("compose")}>
      <Plus className="size-4" />
      <span>انتشار جدید</span>
      <kbd className="ms-auto">C</kbd>
    </CommandPrimitive.Item>
  </CommandPrimitive.Group>
</CommandPrimitive.List>
```

#### Footer (32px tall)
- **Left (RTL: right):** Keyboard hints. `↑↓ navigate   ↵ select   esc close`. 11px, `ink-tertiary`. Each key in a `<kbd>`.
- **Right (RTL: left):** Result count. "۳ نتیجه" (3 results). 11px, `ink-tertiary`. Persian digits.

#### Cmd+K structure — the four group types
1. **Navigation (مسیرها):** All sidebar destinations. Each has a `G+letter` shortcut.
2. **Actions (عملیات):** Create, edit, delete, publish. Contextual — shows actions relevant to current view.
3. **Settings (تنظیمات):** Theme toggle, language, profile, shortcuts reference (`?`).
4. **Recently used (اخیر):** Last 5 commands the user ran. Promotes repeat use.

#### Nested pages (for sub-commands)
When a command has sub-options (e.g., "Change theme…" → Dark / Light / System), push a new "page" onto a stack. `Escape` or `Backspace` (when input is empty) goes back. cmdk's docs show this pattern:
```tsx
const [pages, setPages] = useState<string[]>([]);
const page = pages[pages.length - 1];
<Command onKeyDown={(e) => {
  if (e.key === "Escape" || (e.key === "Backspace" && !search)) {
    setPages(p => p.slice(0, -1));
  }
}}>
  {!page && <>{/* root items */}</>}
  {page === "theme" && <>{/* theme sub-items */}</>}
</Command>
```

#### Accessibility
- `role="dialog"` on overlay, `aria-modal="true"`.
- `aria-label="Command Menu"` on the `Command` root.
- Focus trap (Radix Dialog handles this — cmdk uses Radix Dialog internally).
- `aria-selected="true"` on the active item (cmdk sets this automatically).
- All icons have `aria-hidden="true"`.
- Screen reader announces the active item's label as the user navigates.

#### The "search local, not server" rule
**Critical:** Linear's command palette is fast because it searches the local MobX object pool, not a server. Nashrino should pre-load all command names, view labels, and recent items into memory on app boot. The command palette should **never** show a loading state — if it does, users will perceive the whole app as slow.

---

## 5. Motion System — Exact Framer Motion Variants

### 5.1 The motion token set (extends RESEARCH-2 §3.1)

```ts
// src/lib/motion.ts
export const ease = {
  respond:   [0, 0, 0.2, 1] as const,        // workhorse — 60% of motion
  enter:     [0, 0, 0.2, 1] as const,        // entrances
  exit:      [0.4, 0, 1, 1] as const,        // exits (mirror of enter)
  snap:      [0.12, 0, 0.08, 1] as const,    // micro-interactions (toggles, tabs)
  announce:  [0.16, 1, 0.3, 1] as const,     // dramatic — Linear's signature ease
  overshoot: [0.34, 1.56, 0.64, 1] as const, // ≤10% of motion only
} as const;

export const duration = {
  instant:  0,           // state changes (icon swap)
  fast:     0.1,         // micro-interactions (toggles, hovers)
  normal:   0.2,         // standard transitions
  slow:     0.3,         // panels, modals, command palette
  dramatic: 0.5,         // onboarding, hero — never routine UI
} as const;

export const spring = {
  modal:    { type: "spring", stiffness: 300, damping: 26, mass: 1 },
  toast:    { type: "spring", stiffness: 400, damping: 30, mass: 0.8 },
  drag:     { type: "spring", stiffness: 500, damping: 35, mass: 1.2 },
  popover:  { type: "spring", stiffness: 350, damping: 28, mass: 0.8 },
  badge:    { type: "spring", stiffness: 400, damping: 25, mass: 0.8 },
} as const;
```

### 5.2 Page transition variant

```tsx
// Per Interaction #21
export const pageTransition = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit:    { opacity: 0, y: 0 },
  transition: { duration: 0.2, ease: ease.announce },
};

// Usage
<AnimatePresence mode="wait">
  <motion.div key={activeView} {...pageTransition}>
    {renderView(activeView)}
  </motion.div>
</AnimatePresence>
```

### 5.3 List stagger variants (per Interaction #20)

```tsx
export const listContainer = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.04, delayChildren: 0.1 },
  },
};

export const listItem = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1, y: 0,
    transition: { duration: 0.25, ease: ease.enter },
  },
  exit: {
    opacity: 0, y: -8,
    transition: { duration: 0.2, ease: ease.exit },
  },
};

// Usage with AnimatePresence for items that can be removed
<motion.ul variants={listContainer} initial="hidden" animate="visible">
  <AnimatePresence>
    {items.map(item => (
      <motion.li key={item.id} variants={listItem} layout>
        {item.content}
      </motion.li>
    ))}
  </AnimatePresence>
</motion.ul>
```

### 5.4 KPI count-up hook (per Interaction #16)

```tsx
export function useCountUp(target: number, duration = 800, enabled = true) {
  const [value, setValue] = useState(0);
  const shouldReduceMotion = useReducedMotion();
  const active = enabled && !shouldReduceMotion;

  useEffect(() => {
    if (!active) { setValue(target); return; }
    let raf: number;
    const start = performance.now();
    const from = 0;
    const animate = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);  // ease-out cubic
      setValue(from + (target - from) * eased);
      if (t < 1) raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, active]);

  return value;
}

// Usage in a KPI card
function KpiCard({ value, label }: { value: number; label: string }) {
  const v = useCountUp(value);
  return (
    <div className="kpi-card">
      <span className="text-3xl font-semibold num-tabular">
        {toPersianDigits(Math.round(v))}
      </span>
      <span className="text-sm text-ink-tertiary">{label}</span>
    </div>
  );
}
```

### 5.5 Skeleton → content fade (per Interaction #18)

```tsx
export const skeletonFade = {
  skeleton: {
    exit: { opacity: 0 },
    transition: { duration: 0.15, ease: "linear" },
  },
  content: {
    initial: { opacity: 0, y: 4 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.2, ease: ease.announce },
  },
};

// Usage
<AnimatePresence mode="popLayout">
  {isLoading ? (
    <motion.div key="skeleton" {...skeletonFade.skeleton}>
      <Skeleton className="h-4 w-full mb-2" />
      <Skeleton className="h-4 w-3/4" />
    </motion.div>
  ) : (
    <motion.div key="content" {...skeletonFade.content}>
      {actualContent}
    </motion.div>
  )}
</AnimatePresence>
```

### 5.6 Popover spring (per Interaction #2, #25)

```tsx
export const popoverVariants = {
  initial: { opacity: 0, scale: 0.96, y: -4 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit:    { opacity: 0, scale: 0.98, y: -2 },
  transition: { duration: 0.15, ease: ease.announce },
};

// For popovers that should "grow from" their trigger
export const popoverFromTrigger = (origin: string) => ({
  initial: { opacity: 0, scale: 0.96, y: -4 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit:    { opacity: 0, scale: 0.98, y: -2 },
  transition: { duration: 0.15, ease: ease.announce },
  style: { transformOrigin: origin },  // e.g. "top left" in RTL
});
```

### 5.7 Toast slide (per Interaction #13, #14)

Sonner handles this out of the box, but if you're customizing:

```tsx
// Toast entrance (bottom-center position)
export const toastEnter = {
  initial: { opacity: 0, y: "100%", scale: 0.9 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit:    { opacity: 0, y: 40, scale: 0.9 },
  transition: { type: "spring", stiffness: 400, damping: 30, mass: 0.8 },
};

// Stacking: each toast behind the front one scales down and translates up
export const stackedToastPosition = (index: number) => ({
  y: -index * 14,      // 14px gap * index
  scale: 1 - index * 0.05,
  zIndex: 100 - index,
});

// Swipe-to-dismiss: track drag, dismiss if velocity > 0.11 or distance > 80px
export const useToastSwipe = (onDismiss: () => void) => {
  const dragStart = useRef<{ y: number; t: number } | null>(null);
  const onDragStart = () => { dragStart.current = { y: 0, t: Date.now() }; };
  const onDrag = (_: any, info: PanInfo) => {
    if (info.offset.y > 0) {  // only downward (toward where it came from)
      // Apply friction if dragging up (wrong way)
    }
  };
  const onDragEnd = (_: any, info: PanInfo) => {
    const velocity = Math.abs(info.offset.y) / (Date.now() - (dragStart.current?.t ?? Date.now()));
    if (info.offset.y > 80 || velocity > 0.11) onDismiss();
  };
  return { dragConstraints: { top: 0, bottom: 0 }, onDragStart, onDrag, onDragEnd };
};
```

### 5.8 Modal/sheet spring (per Interaction #19)

```tsx
export const modalBackdrop = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit:    { opacity: 0 },
  transition: { duration: 0.2, ease: "linear" },
};

export const modalContent = {
  initial: { opacity: 0, scale: 0.96, y: 12 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit:    { opacity: 0, scale: 0.96, y: 8 },
  transition: spring.modal,  // { type: "spring", stiffness: 300, damping: 26, mass: 1 }
};

// Sheet (slides in from the side)
export const sheetContent = (side: "start" | "end" | "top" | "bottom") => {
  const offset = side === "start" ? "-100%" : side === "end" ? "100%" : side === "top" ? "-100%" : "100%";
  const axis = side === "start" || side === "end" ? "x" : "y";
  return {
    initial: { opacity: 0, [axis]: offset },
    animate: { opacity: 1, [axis]: 0 },
    exit:    { opacity: 0, [axis]: offset },
    transition: { type: "spring", stiffness: 350, damping: 32, mass: 1 },
  };
};
```

### 5.9 The `layoutId` shared-element transition (per Interactions #11, #12)

This is the single most "Linear-feeling" motion primitive. Use it for:
- Sidebar active indicator
- Tab underline
- Card → modal expansion (rare, but powerful)
- Filter chip → active filter pill

```tsx
// Sidebar active indicator
{navItems.map(item => (
  <button key={item.id} onClick={() => setActive(item.id)} className="relative">
    <Icon /> {item.label}
    {active === item.id && (
      <motion.div
        layoutId="sidebar-active-indicator"
        className="absolute inset-inline-start-0 inset-y-2 w-[3px] bg-accent rounded-full"
        transition={{ duration: 0.3, ease: ease.announce }}
      />
    )}
  </button>
))}

// Tab underline
{tabs.map(tab => (
  <button key={tab.id} onClick={() => setActive(tab.id)} className="relative">
    {tab.label}
    {active === tab.id && (
      <motion.div
        layoutId={`${groupId}-tab-underline`}
        className="absolute bottom-0 inset-x-0 h-[2px] bg-accent"
        transition={{ duration: 0.2, ease: ease.announce }}
      />
    )}
  </button>
))}
```

**Critical gotcha:** `layoutId` must be **unique per scope**. If you have two tab groups on the same page, use `layoutId="tab-group-A-underline"` and `layoutId="tab-group-B-underline"`, not just `"tab-underline"` for both — otherwise Framer Motion will try to morph between them.

### 5.10 Reduced-motion fallbacks

**Every** motion in the system must respect `prefers-reduced-motion: reduce`. Use Framer Motion's `useReducedMotion()` hook:

```tsx
function MotionCard({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduce ? { duration: 0 } : { duration: 0.2, ease: ease.announce }}
    >
      {children}
    </motion.div>
  );
}
```

For CSS-only animations (skeleton shimmer, connection pulse):
```css
@media (prefers-reduced-motion: reduce) {
  .skeleton, .pulse-dot { animation: none !important; }
  .skeleton { background: var(--skeleton-base); }
}
```

---

## 6. Theme Refinements — Tint Colors, Gradient Borders, Hover States

### 6.1 Tint colors — the Linear categorization system

Linear uses subtle background tints to categorize items (issue types, labels, statuses). Each tint is a very low-saturation, low-alpha color that sits behind an icon or label. The tint system is **separate** from the semantic colors (red/green/amber/blue) — tints are for *categorization*, not *status*.

**Tint palette (10 tints, each with a 50/100/200 shade in light mode, inverted for dark):**

```css
:root {
  /* Tint base = 8% alpha of the hue on a neutral background */
  --tint-blue-50:   oklch(0.96 0.02 250);   --tint-blue-100:   oklch(0.93 0.04 250);
  --tint-purple-50: oklch(0.96 0.02 300);   --tint-purple-100: oklch(0.93 0.04 300);
  --tint-pink-50:   oklch(0.96 0.02 350);   --tint-pink-100:   oklch(0.93 0.04 350);
  --tint-red-50:    oklch(0.96 0.02 25);    --tint-red-100:    oklch(0.93 0.04 25);
  --tint-orange-50: oklch(0.96 0.02 55);    --tint-orange-100: oklch(0.93 0.04 55);
  --tint-yellow-50: oklch(0.96 0.02 85);    --tint-yellow-100: oklch(0.93 0.04 85);
  --tint-green-50:  oklch(0.96 0.02 145);   --tint-green-100:  oklch(0.93 0.04 145);
  --tint-teal-50:   oklch(0.96 0.02 195);   --tint-teal-100:   oklch(0.93 0.04 195);
  --tint-gray-50:   oklch(0.96 0.005 250);  --tint-gray-100:   oklch(0.93 0.01 250);
}

.dark {
  --tint-blue-50:   oklch(0.27 0.03 250);   --tint-blue-100:   oklch(0.32 0.05 250);
  /* … mirror with darker base for dark mode … */
}
```

**Usage in Nashrino:**
- Instagram → tint-pink
- Telegram → tint-blue
- LinkedIn → tint-blue (different shade)
- Rubika → tint-orange
- Eitaa → tint-teal

Each platform's icon sits in a circular `bg-{tint}-100` container with the platform's icon in the matching `text-{tint}-600` color. This lets users scan a list of posts across platforms and instantly see the platform distribution by color.

### 6.2 Gradient borders — Linear's subtle accent

Linear uses gradient borders on **hover** for primary cards and on **focus** for inputs — never on default state. The gradient is subtle: a 1px border that goes from `transparent` to `accent` along one edge.

**Technique (from ibelick.com, using `border-box` + `padding-box`):**

```css
.gradient-border-card {
  border: 1px solid transparent;
  border-radius: 12px;
  background:
    linear-gradient(var(--surface), var(--surface)) padding-box,
    linear-gradient(135deg, var(--accent) 0%, transparent 50%) border-box;
  /* On default state, the gradient border is barely visible */
  --border-strength: 0;
}

.gradient-border-card:hover {
  /* On hover, the gradient becomes visible */
  --border-strength: 1;
  transition: --border-strength 200ms ease;
}

@property --border-strength {
  syntax: "<number>";
  initial-value: 0;
  inherits: false;
}
```

**Simpler version (no `@property`, works everywhere):**

```css
.gradient-border-hover {
  position: relative;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
  transition: border-color 200ms ease;
}
.gradient-border-hover::before {
  content: "";
  position: absolute;
  inset: -1px;
  border-radius: inherit;
  padding: 1px;
  background: linear-gradient(135deg, var(--accent), transparent 60%);
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  opacity: 0;
  transition: opacity 200ms ease;
  pointer-events: none;
}
.gradient-border-hover:hover::before {
  opacity: 1;
}
```

**Where to use gradient borders in Nashrino:**
- Primary CTA button on hover (`انتشار جدید`)
- Selected card in a grid (campaign card when selected)
- Active filter chip
- Focused search input (the inline-start edge gets a gradient accent)
- **Never** on default-state cards, list rows, or backgrounds — that's decorative gradient use, which Linear explicitly avoids.

### 6.3 Hover state hierarchy — the 4 levels

Linear has a strict 4-level hover hierarchy. Every interactive element maps to one:

| Level | Use case | Visual change | Duration |
|---|---|---|---|
| **Level 1 — Subtle** | List rows, table rows, nav items | `background-color: var(--surface-hover)` only. No transform, no border. | 120ms |
| **Level 2 — Elevated** | Cards, panels, tiles | `background-color` + `border-color` shift toward accent + `translateY(-2px)` + deeper shadow | 200ms |
| **Level 3 — Affordance** | Buttons, icon buttons, toggles | `background-color` to active variant + `scale(0.97)` on press | 120ms hover / 80ms press |
| **Level 4 — Emphasis** | Primary CTA only | Gradient border (per §6.2) + accent glow + `translateY(-1px)` | 200ms |

**Critical:** Don't mix levels. A list row should never elevate. A primary CTA should never just shift background. Consistency in hover hierarchy is what makes the UI feel "designed" rather than ad-hoc.

### 6.4 Dark mode — designed, not inverted

From `alexvipond.dev` and `medium.muz.li`: dark mode is **not** light mode inverted. Key principles:

1. **Never use pure black (`#000000`).** Use a very dark desaturated color: `oklch(0.18 0.005 250)` (Linear's dark bg) or `oklch(0.16 0.005 250)` (slightly darker). Pure black creates harsh contrast that fatigues the eyes.
2. **Reduce contrast on text.** Light mode uses `oklch(0.18 0 0)` for primary text. Dark mode does **not** use `oklch(1 0 0)` (pure white) — it uses `oklch(0.95 0 0)` (slightly off-white) to reduce eye strain.
3. **Increase saturation on accents.** The accent color that looks right on white often looks muddy on dark. Bump saturation 5–10% in dark mode: light `oklch(0.62 0.18 280)` → dark `oklch(0.68 0.20 280)`.
4. **Reduce shadow intensity.** Light mode shadows are dark-on-light. Dark mode shadows are barely visible (the elevation is conveyed by lighter background, not shadow). Use `0 1px 0 0 rgba(255,255,255,0.04) inset` instead of drop shadows.
5. **Invert border lightness.** Light mode borders are darker than the surface (`border: 1px solid oklch(0.88 0 0)` on `bg: oklch(1 0 0)`). Dark mode borders are **lighter** than the surface (`border: 1px solid oklch(0.28 0 0)` on `bg: oklch(0.18 0 0)`).
6. **Tints get darker base.** The `--tint-*-100` variables in dark mode use `oklch(0.32 0.05 {hue})` instead of `oklch(0.93 0.04 {hue})` — same hue, much darker lightness.

### 6.5 The "5 colors total" rule

Linear's entire app uses approximately **5 colors**:
- 1 accent (lavender-blue)
- 3 semantic (green = success, amber = warning, red = error)
- 1 neutral grayscale (10 steps from `oklch(1 0 0)` to `oklch(0.15 0 0)`)

That's it. Every other color in the app is a tint (8% alpha) of one of these. This restraint is what makes Linear feel cohesive. Adding a 6th color (e.g., a separate "info blue") breaks the cohesion.

**For Nashrino:** The platform tints (pink/blue/orange/teal for IG/Telegram/Rubika/Eitaa) are tints, not new colors — they're categorization aids, not semantic. The semantic palette stays at green/amber/red + accent. Resist the urge to add "info blue" — use the accent or a tint of it.

---

## 7. RTL-Specific 10/10 Touches

### 7.1 Persian digit count-up (per Interaction #16)

The count-up hook in §5.4 already handles this via `toPersianDigits(Math.round(v))`. The critical detail: convert on **every frame**, not just at the end. Otherwise the user sees Latin digits counting up then a jarring swap to Persian at the end.

```tsx
const v = useCountUp(metric.value);
return <span className="num-tabular">{toPersianDigits(Math.round(v))}</span>;
```

### 7.2 Jalali date picker that feels native

Most Jalali date pickers in React feel bolted-on because they:
1. Use a Gregorian-style grid with Persian labels (wrong — Persian weeks start Saturday, not Sunday)
2. Don't handle Persian month names correctly (the picker shows "فروردین" but the navigation arrows go the wrong way)
3. Don't animate between month views

**Spec for a 10/10 Jalali picker:**
- **Week starts Saturday.** First column = Saturday. Last column = Friday.
- **Persian month names** in the header, with `←` (previous) on the **right** and `→` (next) on the **left** (mirrored from LTR).
- **Persian day numbers** via `toPersianDigits`.
- **Persian year** in the header (e.g., "۱۴۰۳") with a click-to-switch-to-year-view.
- **Today's date** highlighted with an accent ring.
- **Selected date** filled with accent.
- **Range selection** (for date-range filters): click start, click end. The range between is tinted with `bg-accent/10`.
- **Animation:** Month switch slides horizontally. Going to previous month slides **right-to-left** (the new month comes from the right). Going to next month slides **left-to-right**. Use Framer Motion `AnimatePresence` with `mode="popLayout"` and `custom` direction.

```tsx
const [direction, setDirection] = useState(0);  // -1 = prev, 0 = none, 1 = next
<AnimatePresence mode="popLayout" custom={direction}>
  <motion.div
    key={`${year}-${month}`}
    custom={direction}
    initial={(dir) => ({ opacity: 0, x: dir > 0 ? "-100%" : "100%" })}
    animate={{ opacity: 1, x: 0 }}
    exit={(dir) => ({ opacity: 0, x: dir > 0 ? "100%" : "-100%" })}
    transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
  >
    {/* month grid */}
  </motion.div>
</AnimatePresence>
```

### 7.3 RTL-aware tooltips and popovers

Radix UI's Popover and Tooltip handle RTL flipping automatically via `dir` attribute. But there are 3 details to verify:

1. **Arrow position.** The popover arrow must flip to the inline-start side when the popover is anchored to a button on the inline-end edge. Radix handles this — just don't override with hardcoded `left`/`right` CSS.
2. **Animation origin.** Per Interaction #2, the popover's `transformOrigin` must be `top left` in RTL (the corner closest to the bell icon, which is on the right side of the popover in RTL). Use `style={{ transformOrigin: "top left" }}` — or better, use logical properties via CSS: `transform-origin: top var(--inline-start);` where `--inline-start` is `right` in RTL.
3. **Swipe direction.** Per Interaction #4, swipe-to-mark-read goes **inline-start** (left in RTL, right in LTR). Use Framer Motion's `onPan` and check `info.offset.x` — but invert the sign based on `dir`. Easier: use `info.offset.x * (isRTL ? -1 : 1)` and compare to threshold.

### 7.4 Persian number formatting in charts

Recharts (and most chart libraries) render axis labels and tooltips with Latin digits by default. Wrap them:

```tsx
// Custom tooltip formatter
const persianTooltipFormatter = (value: number, name: string) => [
  toPersianDigits(value.toLocaleString("en-US")),
  name,
];

// Custom axis tick formatter
const persianTickFormatter = (value: number) => toPersianDigits(value);

<LineChart data={data}>
  <XAxis dataKey="day" tickFormatter={persianTickFormatter} />
  <YAxis tickFormatter={persianTickFormatter} />
  <Tooltip formatter={persianTooltipFormatter} />
  <Line dataKey="value" />
</LineChart>
```

**Critical:** Use `value.toLocaleString("en-US")` first (to get thousands separators), then convert to Persian digits. Don't convert the raw number — `toPersianDigits(1234.56)` gives "۱۲۳۴.۵۶" but `toPersianDigits((1234.56).toLocaleString("en-US"))` gives "۱,۲۳۴.۵۶" with proper separator.

### 7.5 RTL loading direction

The skeleton shimmer (per Interaction #17) sweeps inline-start → inline-end. In RTL, that's **right-to-left**. The keyframe:

```css
@keyframes shimmer-rtl {
  0% { background-position: 200% 0; }   /* gradient is off-screen to the right */
  100% { background-position: -200% 0; } /* gradient has swept to the left */
}
:root[dir="rtl"] .skeleton {
  animation: shimmer-rtl 1.5s infinite ease-in-out;
}
```

Same for indeterminate progress bars — they should slide right-to-left in RTL.

### 7.6 Persian-aware text truncation

Standard CSS `text-overflow: ellipsis` works in RTL, but the ellipsis appears on the **left** (inline-end), which is correct. However, Persian text often has zero-width non-joiner characters (U+200C, e.g., in "می‌خواهم") that can break truncation. Test truncation with realistic Persian text containing ZWNJ.

---

## 8. Implementation Priority Matrix

Ranked by **(perceived "wow" for the user) ÷ (engineering effort)**. Top 10 first.

### Priority 1 — Cmd+K command palette ⭐⭐⭐⭐⭐ (wow) / 🛠🛠 (effort)
**Why:** This is the single biggest "Linear feel" upgrade. Users see it within 5 seconds of opening the app (the `⌘K` hint is already in the search bar). It changes the entire navigation paradigm from "click around" to "type to navigate".
**Engineering:** cmdk package is already in the codebase (`src/components/ui/command.tsx`). Wire up `Command.Dialog` to open on `Cmd+K`, populate with nav items + actions. ~1 day.
**Files to touch:** `src/components/shell/command-bar.tsx` (add `Cmd+K` listener + dialog), new `src/components/shell/command-palette.tsx`, `src/lib/store.ts` (add `commandPaletteOpen` state).

### Priority 2 — Notification bell popover ⭐⭐⭐⭐⭐ (wow) / 🛠🛠🛠 (effort)
**Why:** Currently the bell just navigates to the dashboard — that's a 6/10 pattern. A popover with grouped notifications, filter tabs, mark-all-read, and empty state is a 10/10 pattern that users interact with multiple times per session.
**Engineering:** Build on existing Popover component. ~2 days. The notification API exists (`/api/notifications`).
**Files to touch:** New `src/components/shell/notification-popover.tsx`, modify `command-bar.tsx` to use Popover instead of `onClick navigate`.

### Priority 3 — Optimistic UI for publish flow ⭐⭐⭐⭐⭐ (wow) / 🛠🛠🛠 (effort)
**Why:** The publish flow currently waits for server confirmation before showing success. Linear's whole "instant feel" comes from optimistic updates. This is the highest-impact perceived-performance improvement.
**Engineering:** Wrap existing mutations with `onMutate` + `setQueryData` + `onError` rollback (per §5 of the report and TkDodo's pattern). ~2 days for the publish flow.
**Files to touch:** `src/components/views/compose-view.tsx`, `src/lib/api.ts` (add mutation helpers), possibly new `src/hooks/use-optimistic-mutation.ts`.

### Priority 4 — Sidebar active indicator with `layoutId` ⭐⭐⭐⭐ (wow) / 🛠 (effort)
**Why:** The shared-element transition where the active-indicator bar glides between sidebar items is the most distinctive Linear/Vercel motion. Users notice it within their first 3 navigations.
**Engineering:** Add `motion.div` with `layoutId="sidebar-active"` to each nav item. ~2 hours.
**Files to touch:** `src/components/shell/sidebar.tsx`.

### Priority 5 — Sonner toast upgrade with stacking + swipe ⭐⭐⭐⭐ (wow) / 🛠 (effort)
**Why:** Sonner is already installed but the default config doesn't showcase its strengths. Enable `expand` on hover, swipe-to-dismiss, and the dark-theme "rail" styling (per §3 of tigerabrodi's guide). Toasts go from "functional" to "delightful".
**Engineering:** Update `src/components/ui/sonner.tsx` with the advanced config. ~3 hours.
**Files to touch:** `src/components/ui/sonner.tsx`.

### Priority 6 — KPI count-up animation ⭐⭐⭐⭐ (wow) / 🛠 (effort)
**Why:** The dashboard's KPI cards currently show the number statically. Adding count-up on first mount makes the dashboard feel alive on every page load.
**Engineering:** Implement the `useCountUp` hook (per §5.4). Apply to all KPI cards. ~4 hours.
**Files to touch:** New `src/hooks/use-count-up.ts`, `src/components/dashboard/executive-metrics.tsx`, `src/components/dashboard/operational-summary.tsx`.

### Priority 7 — Skeleton loading states (replace spinners) ⭐⭐⭐⭐ (wow) / 🛠🛠 (effort)
**Why:** Spinners feel "broken". Skeletons feel "loading". NN/G research shows skeletons reduce perceived wait time and prevent users from thinking the app is broken. Replace all spinners in main view areas with skeletons matching the content layout.
**Engineering:** Build skeleton variants for each view's layout. ~1.5 days.
**Files to touch:** New `src/components/{view-name}-skeleton.tsx` for each major view, update views to show skeleton on `isLoading`.

### Priority 8 — Hover state hierarchy (Levels 1–4) ⭐⭐⭐ (wow) / 🛠 (effort)
**Why:** Consistent hover hierarchy across the app is what separates "designed" from "ad-hoc". Currently hovers are inconsistent — some cards lift, some don't, some buttons scale, some don't.
**Engineering:** Audit all interactive elements, map to 4-level hierarchy (per §6.3). ~1 day.
**Files to touch:** All view components + `src/app/globals.css` (add `.hover-level-1` through `.hover-level-4` utility classes).

### Priority 9 — Connection status indicator ⭐⭐⭐ (wow) / 🛠 (effort)
**Why:** Nashrino already has a WebSocket setup (per `mini-services/realtime`). Adding a small connection-status dot in the sidebar footer makes real-time feel trustworthy.
**Engineering:** ~4 hours.
**Files to touch:** `src/components/shell/sidebar.tsx` (add indicator in footer), new `src/hooks/use-connection-status.ts`.

### Priority 10 — Toast tab-visibility pause + tab-underline `layoutId` + sidebar active indicator ⭐⭐⭐ (wow) / 🛠 (effort)
**Why:** These are the "thousand barely audible voices" details — each is small, but together they make the app feel solid. Sonner handles tab-visibility out of the box. Tab underline needs `layoutId` per §5.9.
**Engineering:** ~1 day combined.
**Files to touch:** Various.

### Honorable mentions (lower priority, still 10/10):
- **Empty states with illustrations** — each major view's empty state needs a custom illustration + headline + CTA. ~2 days.
- **Keyboard shortcuts reference (`?` to open)** — once Cmd+K is in, add a shortcuts modal triggered by `?`. ~4 hours.
- **Persian count-up in charts** — chart entrance animation with Persian digit formatting. ~6 hours.
- **Gradient borders on hover** (per §6.2) — for primary cards. ~4 hours.
- **ARIA live regions** for dynamic updates (notifications, toasts, count changes). ~1 day.
- **Focus-visible rings** audit — ensure every interactive element has a visible focus ring. ~4 hours.

---

## 9. Sources Cited

### Primary (full-text fetched and analyzed)
1. **Linear Method** — `linear.app/method` — practices for building, opinionated software
2. **Linear Notifications Docs** — `linear.app/docs/notifications` — channel categorization, 2,000-notification retention, subscription rules
3. **Building a toast component** — `emilkowal.ski/ui/building-a-toast-component` — Sonner's stacking algorithm, swipe velocity (0.11), pointer capture, document-hidden pause, gap-filling pseudo-elements, friction on wrong-direction drag
4. **How's Linear so fast?** — `performance.dev/how-is-linear-so-fast-a-technical-breakdown` — Linear's exact `--speed-*` CSS variables, IndexedDB + MobX architecture, optimistic mutations, granular reactivity, composite-property-only animation rule, asymmetric timing, inlined app shell, font loading with `crossorigin`, service worker precache
5. **Design Engineering at Vercel** — `vercel.com/blog/design-engineering-at-vercel` — "delighters" concept, iterate-to-greatness, no perfection trap, design engineers embedded in product teams
6. **Geist Skeleton** — `vercel.com/geist/skeleton` — size-match requirement, aria-busy, prefers-reduced-motion, never use as decoration
7. **How to design great keyboard shortcuts** — `knock.app/blog/how-to-design-great-keyboard-shortcuts` — 3 traits (discoverable, memorable, conflict-free), key-to-verb mapping, visual mapping, G+letter combos, OS-awareness
8. **Concurrent Optimistic Updates in React Query** — `tkdodo.eu/blog/concurrent-optimistic-updates-in-react-query` — `cancelQueries` + `setQueryData` + `isMutating({mutationKey})===1` pattern to skip invalidations during concurrent mutations
9. **Command K Bars** — `maggieappleton.com/command-bar` — history (Spotlight 2005 → Linear/Raycast), pattern anatomy, fuzzy search
10. **Command Palette Pattern** — `uxpatterns.dev/patterns/advanced/command-palette` — full anatomy, accessibility requirements, common mistakes
11. **Empty States** — `evergreen.segment.com/patterns/empty-states` — anatomy (Border + Background + Visual + Headline + Body + CTA + Text Link), 4 types (in-table, non-table, small, minimal)
12. **Notification UX: 8 Best Practices** — `eleken.co/blog-posts/notification-ux` — 3 functional types (informational, action-required, system-feedback), urgency→channel mapping, 2-second decidable test, 3 grouping mechanisms, "design for the muted state"
13. **Creating an animated gradient border with CSS** — `ibelick.com/blog/create-animated-gradient-borders-with-css` — `@property --angle` + `border-box`/`padding-box` technique
14. **About GitHub notifications** — `docs.github.com/en/subscriptions-and-notifications/concepts/about-notifications` — reason labels (mention, subscribed, review-requested), inbox filters, Done/Saved states, 5-month retention
15. **Notifications UI design** — `setproduct.com/blog/notifications-ui-design` — component taxonomy (toast, snackbar, banner, badge, indicator, push), priority levels (high/medium/low/passive), scenario→component mapping, real-world examples (Slack, Stripe, Linear, Notion, GitHub)
16. **Optimistic UI Patterns** — `simonhearne.com/2021/optimistic-ui-patterns` — Allbirds mini-cart, Twitter favorite, contextual buttons, pre-emptive loading on hover
17. **Skeleton Screens 101** — `nngroup.com/articles/skeleton-screens` — 3 types (static, animated, frame-display), 1–10s wait window, progress bar for >10s, nothing for <1s, frame-display forbidden
18. **Principles in Motion** — `figma.com/blog/principles-in-motion` — easing, anticipation, overshoot, follow-through, hold, settle; team shorthand (zippy, dreamy, chunky, snappier, floaty, too linear, dead on arrival)
19. **cmdk GitHub** — `github.com/dip/cmdk` — full part API (Command/Dialog/Input/List/Item/Group/Separator/Empty/Loading), `useCommandState` hook, nested pages pattern, Radix Dialog composition
20. **Styling Sonner Toasts: Advanced Guide** — `tigerabrodi.blog/styling-sonner-toasts-advanced-guide` — dark-theme "rails" (3px left border for variant), `--toast-animation-duration`, `[data-content]{flex:1}`, custom loading spinner override, action-button colors per variant
21. **Atlassian Empty State** — `atlassian.design/content/writing-guidelines/empty-state` — "blank slate" vs "empty state" distinction, imperative-verb CTAs, 1–2 word CTA limit
22. **The Linear Method: Opinionated Software** — `figma.com/blog/the-linear-method-opinionated-software` — atom-level opinions, strategic product debt, evolving strong opinions
23. **Top 9 React notification libraries in 2026** — `knock.app/blog/the-top-notification-libraries-for-react` — Sonner wins for shadcn/ui projects, comparison with React Hot Toast, React Toastify, Notistack, Reapop, SweetAlert2, shadcn Dialog, Socket.IO, Web Push

### Additional searches conducted (60 queries)
Covering: Linear notification dropdown UX, Linear method design motion, command palette cmdk, Vercel dashboard loading states, micro-interactions SaaS dashboard, sonner toast, optimistic UI React Query, accessible popover patterns, RTL notification dropdown, Framer Motion layoutId, GitHub notification inbox, Slack notification preferences, Rauno Freiberg, Raycast command palette, Notion command palette, Linear CSS variables, Linear gradient borders, Vercel empty states, React count up, skeleton loading, WebSocket connection indicator, ARIA live regions, chart tooltip, chart animation, Linear keyboard shortcuts, cmdk package, sonner features, Linear fast/instant, toggle switch animation, copy to clipboard feedback, tooltip hover preview, page transitions, Linear notification inbox, Vercel deployment notifications, React Query refetchInterval, progress bar, Linear design palette, dark mode design, empty state anatomy, chart legend toggle, accessible chart palette, focus visible, Jalali date picker, Persian digit count up, RTL popover, radix UI primitives, Linear method blog, Vercel Geist, Linear keyboard-first, Framer Motion AnimatePresence, Framer Motion stagger, Linear blog building, motion.dev, instant feel dashboard, modal sheet spring, shimmer skeleton, Vercel deployment progress, Linear issue status transition, cmdk paco package, Rauno design philosophy.

---

## Appendix A: Quick-Reference Cheat Sheet

### The 5 motion rules (memorize these)
1. **Composite only.** Animate `transform` and `opacity`. Never `width`, `height`, `margin`, `padding`, `top`, `left`.
2. **Asymmetric timing.** Enter instant (or 100–150ms). Exit 150ms. Never the same duration both ways.
3. **Sub-100ms cause-and-effect.** Any user action (click, keypress) must reflect in the UI in <100ms. Use optimistic updates.
4. **Stagger ≤ 8 items.** 40ms between items, cap at 8 (320ms total). After 8, items appear instantly.
5. **Reduced motion respected.** Every animation has a `prefers-reduced-motion: reduce` fallback that disables transforms (keep opacity changes — they're benign).

### The 4 hover levels
1. **Subtle** (list rows): `background-color` only, 120ms.
2. **Elevated** (cards): `background-color` + `border-color` + `translateY(-2px)` + shadow, 200ms.
3. **Affordance** (buttons): `background-color` + `scale(0.97)` on press, 80ms press.
4. **Emphasis** (primary CTA): gradient border + accent glow + `translateY(-1px)`, 200ms.

### The 3 notification channels (per urgency)
1. **High urgency** → Modal/banner (blocking): fraud, payment failure, session expired.
2. **Medium urgency** → In-app toast (non-blocking): trial ending, teammate mention, approval request.
3. **Low urgency** → In-app inbox + badge only: status changes, FYI updates.

### The 3 keyboard-shortcut discovery mechanisms
1. **Tooltips** — show shortcut on hover (500ms delay).
2. **Reference guide** — `?` opens a modal with all shortcuts.
3. **Command palette** — `Cmd+K` shows shortcuts next to each command.

### The 5 Linear timing tokens (exact)
```css
--speed-highlightFadeIn: 0s;
--speed-highlightFadeOut: 0.15s;
--speed-quickTransition: 0.1s;
--speed-regularTransition: 0.25s;
--speed-slowTransition: 0.35s;
```

### The 5 Sonner details that make it feel right
1. **Stacking** — older toasts scale `1 - 0.05 * index` and translate `y: -14 * index`.
2. **Swipe velocity** — dismiss if `velocity > 0.11` px/ms OR distance > 80px.
3. **Tab visibility** — pause auto-dismiss when `document.hidden`.
4. **Gap filling** — `:after` pseudo-elements fill gaps between stacked toasts so hover state is consistent.
5. **Pointer capture** — `setPointerCapture` on drag start so swipe continues outside the toast.

### The 5 cmdk parts you need
1. `Command.Dialog` — wraps everything, handles `Cmd+K`, focus trap, backdrop.
2. `Command.Input` — autofocused, placeholder, no border.
3. `Command.List` — scrollable, `max-h` with `--cmdk-list-height` variable.
4. `Command.Group` — `heading` prop, groups items.
5. `Command.Item` — `onSelect`, `keywords` for filter aliases, `data-selected` for styling.

---

*End of report. This document is the spec for the final 20% — the interaction, motion, and craft layer that takes Nashrino from 8/10 to 10/10. Every spec herein is backed by primary-source research (Linear, Vercel, Stripe, Apple HIG, NN/G, Radix, cmdk, Sonner, TanStack Query docs) and is implementable in the existing Next.js 15 + Tailwind v4 + Framer Motion stack.*
