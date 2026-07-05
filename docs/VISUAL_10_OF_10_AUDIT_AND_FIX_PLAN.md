# Nashrino Visual 10/10 Execution Bible

> A world-class, execution-level visual quality plan for Nashrino. This is not only an audit. It is a full implementation blueprint for finding, fixing, testing, and preventing small visual problems across UI, UX, theme, motion, responsive behavior, RTL, accessibility, and product polish.

| Field | Value |
|---|---|
| Product | Nashrino / نشرینو |
| Scope | Visual design, UI/UX, theme, interaction, motion, responsive, RTL, accessibility, charts, content states, visual QA |
| Audit date | 2026-07-06 |
| Target branch | `main` |
| Source branch | `docs/visual-10-of-10-audit-plan` |
| Related plan | `docs/WORLD_CLASS_PRODUCT_10_OF_10_PLAN.md` |
| Related trackers | #160, #232, #233, #234, #235, #236 |
| Current visual score | ~6.9/10 |
| Current product score | ~8.0/10 |
| Target visual score | 9.5+/10 |
| Target product score after execution | ~8.8–9.1/10 |
| Certification target | 95+/100 with evidence |
| Verdict | Current plan must become an evidence-backed visual QA program, not a one-time polish pass |

---

## 1. Executive verdict

The product has strong foundations, but it is not yet visually world-class. The biggest remaining risk is not one huge design failure. It is the accumulation of many small visual problems:

- slightly small controls;
- weak spacing consistency;
- overly masked visual tests;
- charts and KPI cards not fully protected by screenshots;
- too much small decorative motion;
- incomplete route/state screenshot coverage;
- inconsistent focus and interaction language;
- under-tested dark mode, high contrast, reduced motion, and mixed RTL/LTR content;
- feature surfaces that improve function faster than visual quality.

A 10/10 visual product is not achieved by saying “the UI looks modern.” It is achieved by having:

1. a tokenized design system;
2. strict primitives;
3. strict visual regression;
4. component screenshots;
5. route/state screenshots;
6. manual screenshot review;
7. performance, motion, accessibility, and theme gates;
8. exact acceptance evidence for every route and state.

Nashrino has the start of this. This document defines the missing execution layer.

---

## 2. What changed from the earlier plan

The earlier plan was a strong strategic audit. This version upgrades it into a 10/10 execution bible by adding:

- exact benchmark-to-action mapping;
- file-by-file implementation plan;
- PR-by-PR sequence;
- stronger design-token rules;
- exact visual screenshot matrix;
- route-by-route defect tables;
- component visual test plan;
- example Playwright test shapes;
- manual review checklist;
- acceptance gates;
- issue-ready backlog;
- owner/evidence model;
- definition of done for each visual phase.

This version is closer to a professional design-system and visual-QA program used by mature SaaS teams.

---

## 3. Benchmark model: world-class principles translated into Nashrino work

| Benchmark | World-class principle | Nashrino action |
|---|---|---|
| Linear | High-density work surfaces stay calm because every primitive is predictable | Create shared table rows, card variants, badge variants, icon scale, and focus language |
| Stripe | Every state has hierarchy: title, explanation, next action, recovery | Standardize empty/loading/error/offline/unsupported states across every view |
| Vercel | Minimal surfaces with high confidence; no ornamental clutter | Remove unnecessary decorative loops from work surfaces; use restrained motion |
| Apple HIG | Depth only clarifies layer hierarchy; reduced transparency/motion are first-class | Keep glass to nav/floating layers; add reduced-transparency/high-contrast screenshots |
| Material Design 3 | Tokens govern color, typography, shape, state, and motion | Extend design lint to spacing, radius, shadow, glass, icon size, and motion usage |
| Buffer | Publishing flow is simple and approachable | Keep Compose focused; collapse optional automation/settings behind progressive disclosure |
| Later | Visual planning and media confidence are product differentiators | Make calendar, grid, preview, and media library visually first-class and realistic |
| Planable | Feedback, approval, and revision visuals are tied to the exact content object | Build approval/review visual states around exact revision identity and state |
| Sprout / Agorapulse | Inbox and analytics are operational tools, not decorative dashboards | Make dense rows, SLA, status, assignment, and reporting visually precise |
| NN/g heuristics | Users always understand status, next action, and how to recover | Every error/empty/partial state must show why, what next, and how to fix |
| WCAG 2.2 | Interaction targets, contrast, focus, motion, and keyboard access are measurable | Add visual + functional tests for focus, reduced motion, touch targets, contrast |
| Web Vitals | Visual quality includes layout stability and interaction responsiveness | Add route-level CLS/INP/LCP evidence and screenshot layout-stability checks |

---

## 4. Current score and target score

| Category | Current | Target | Gap |
|---|---:|---:|---|
| Visual QA safety | 6.5 | 9.5 | Screenshots are too broad, too masked, too tolerant |
| Theme consistency | 8.0 | 9.5 | Strong tokens, but governance gaps remain |
| Typography | 7.4 | 9.5 | Persian type scale exists; microtext and long-copy stress tests missing |
| Layout/responsive | 7.5 | 9.5 | Shell improved; every route/state not fully covered |
| Components/primitives | 7.0 | 9.5 | Button/select/tabs/dropdown touch floor not guaranteed |
| Motion | 7.2 | 9.5 | MotionProvider exists; decorative loops and inline durations remain |
| Charts/data visualization | 6.8 | 9.5 | Charts/KPIs too masked; deterministic visual stories missing |
| Mobile/touch | 7.0 | 9.5 | Mobile shell improved; primitive-level tap target still weak |
| Accessibility visual layer | 7.4 | 9.5 | Focus/high contrast/reduced motion not fully proven route-by-route |
| Product polish | 7.2 | 9.5 | New feature surfaces need consistent visual sign-off |
| Overall visual | 6.9 | 9.5 | Main gap is visual evidence and strict governance |

---

## 5. Confirmed code-backed problems

These are not opinions. They are directly supported by current code patterns and test coverage.

| ID | Problem | Why it matters | Severity | Required fix |
|---|---|---|---|---|
| VQA-001 | Visual test tolerance is too high | Small spacing/alignment defects can pass CI | P0 | Lower route tolerance and add strict component tests |
| VQA-002 | Visual tests mask too much | KPI numbers, charts, metric cards, timestamps, avatars, and live indicators are hidden | P0 | Add deterministic unmasked component snapshots |
| VQA-003 | Route coverage too narrow | Inbox, calendar, channels, media, content, onboarding, help/status, review flows are not covered | P0 | Expand route matrix |
| VQA-004 | Button primitive has small fixed heights | New UI can reintroduce small tap targets | P0 | Make mobile-safe hit areas default in `Button` |
| VQA-005 | Select trigger has small fixed heights | Mobile forms/dropdowns may feel cramped | P0 | Make `SelectTrigger` touch-safe |
| VQA-006 | Live ping animation can create noise | Operational UI should not pulse unless status-critical | P1 | Replace with calm dot or temporary reconnect pulse |
| VQA-007 | Inline motion durations remain | Motion language can drift and feel inconsistent | P1 | Use `src/lib/motion.tsx` tokens only |
| VQA-008 | Infinite chart pulse remains | Dashboard can feel busy | P1 | Limit repeated motion to critical status only |
| VQA-009 | Design lint is incomplete | Spacing/radius/shadow/icon/glass drift can pass | P0 | Expand design lint |
| VQA-010 | Lighthouse is not fully blocking | Performance/a11y quality can regress without blocking merge | P1 | Make release-candidate Lighthouse and RUM budgets blocking |
| VQA-011 | Charts are under-protected | Analytics trust depends on chart precision | P0 | Add no-mask chart and KPI baselines |
| VQA-012 | Focus language can diverge | Keyboard experience looks inconsistent | P1 | Unify focus ring across primitives |

---

## 6. Visual 10/10 definition

Nashrino gets visual 10/10 only when all are true:

1. All major routes have screenshots at 375, 768, 1024, 1280, and 1600px.
2. Light and dark mode screenshots exist for all major routes.
3. Reduced-motion screenshots exist for animated routes.
4. High-contrast and reduced-transparency modes are manually verified.
5. Component screenshots exist for primitives, cards, tables, charts, forms, dialogs, sheets, popovers, badges, and navigation.
6. Route states are covered: loading, empty, error, offline, permission denied, unsupported provider, degraded, pending mutation, destructive confirmation.
7. Touch targets are safe at 375px.
8. Focus ring is consistent across all primitives and custom buttons.
9. Charts/KPI cards have deterministic no-mask snapshots.
10. No decorative infinite animation exists in dense work surfaces.
11. Long Persian text and mixed RTL/LTR fixtures pass screenshots.
12. Every UI PR includes visual evidence.
13. Visual diff artifacts are reviewed, not blindly updated.
14. No route has known horizontal overflow.
15. Every route has an obvious primary action or clear explanation that no action is available.

---

## 7. Screenshot matrix

### 7.1 Viewports

| Name | Width | Height | Purpose |
|---|---:|---:|---|
| small mobile | 360 | 740 | smallest practical Android/iPhone width |
| standard mobile | 375 | 812 | current core mobile baseline |
| large mobile | 414 | 896 | large phones |
| tablet | 768 | 1024 | tablet portrait / small iPad |
| small laptop | 1024 | 768 | important missing breakpoint |
| desktop | 1280 | 800 | current baseline |
| wide desktop | 1600 | 1000 | wide work surface |

### 7.2 Modes

| Mode | Required? | Notes |
|---|---|---|
| light | yes | default production mode |
| dark | yes | full route and component coverage |
| reduced motion | yes | route snapshots for animated screens |
| reduced transparency | yes | manual and selected automated coverage |
| high contrast / forced colors | yes | manual review required |
| RTL | yes | default app direction |
| mixed RTL/LTR | yes | fixture-based screenshots |

### 7.3 Routes

| Route/surface | Priority | Screenshot required |
|---|---|---|
| sign in | P0 | yes |
| dashboard | P0 | yes |
| compose | P0 | yes |
| calendar | P0 | yes |
| inbox | P0 | yes |
| analytics | P0 | yes |
| settings | P0 | yes |
| channels | P0 | yes |
| media | P1 | yes |
| content library | P1 | yes |
| campaigns | P0 | yes |
| onboarding | P1 | yes |
| help | P2 | yes |
| status | P2 | yes |
| feature flags tab | P0 | yes |
| DM automation builder | P0 | yes |
| DM automation advanced state | P0 | yes |
| post detail analytics sheet | P0 | yes |
| approval/review screen | P1 | yes |
| command palette | P1 | yes |
| mobile drawer | P0 | yes |
| mobile bottom nav | P0 | yes |
| dialogs/sheets/popovers | P0 | yes |

---

## 8. State matrix

Every async or feature surface must support these states visually:

| State | Visual requirement | Example |
|---|---|---|
| loading | size-matched skeleton, no layout jump | dashboard cards, tables, settings rows |
| empty-first-use | benefit + next action | no channels connected |
| empty-filter | explain filter result + reset action | inbox filter has no messages |
| error | Persian message + retry + support path | failed analytics load |
| offline | cached state + retry + offline explanation | compose autosave offline |
| permission denied | lock icon + request access path | viewer cannot change settings |
| unsupported provider | honest explanation + supported alternatives | Telegram per-post analytics unavailable |
| partial data | visible caveat + source/freshness | analytics missing one provider |
| degraded provider | warning + last verified time | Instagram limited permission |
| pending mutation | disabled controls + progress feedback | save/publish/toggle pending |
| optimistic update | clear temporary state + rollback path | rule enabled while save pending |
| destructive confirmation | clear object name + consequence | delete campaign/media/rule |
| beta disabled | explain feature flag + owner/help path | DM automation off |

---

## 9. Component visual baseline catalog

Create component-level screenshots for these groups.

### 9.1 Primitives

- Button: default, secondary, outline, ghost, destructive, icon, loading, disabled, focus.
- Input: normal, focused, invalid, disabled, with helper, with long Persian text, with URL/LTR.
- Textarea: empty, long text, invalid, counter, disabled.
- Select: closed, open, long options, disabled, invalid, mobile width.
- Tabs: default, many tabs, scroll/overflow, active/focus.
- Checkbox/radio/switch: on/off, disabled, label wrapping.
- Dialog/sheet/popover/dropdown: open, long content, mobile, dark, reduced motion.
- Toast/alert: success, warning, error, info, action button.

### 9.2 Product components

- KPI card: normal, loading, no data, negative trend, huge number, long label.
- MiniChart: flat, spike, drop, single point, empty, dark mode.
- Data table row: normal, hover, selected, disabled, action menu, long text.
- Status badge: every semantic state.
- Platform badge/logo: all providers, dark/light, compact.
- EmptyState: first-use, filter empty, unsupported, permission denied, error.
- Sidebar: long workspace, no avatar, badges, disconnected, connected.
- Mobile bottom nav: every active state, badge, overflow.
- DM automation builder: collapsed, simple, advanced, invalid, success.
- Feature flag row: enabled, disabled, pending, error, beta warning.

---

## 10. File-by-file implementation plan

### 10.1 `tests/e2e/visual.spec.ts`

**Current issue**: route coverage is too small, masks too broad, tolerance too high.

**Required changes**:

- Add route list for inbox, calendar, channels, media, content, onboarding, feature flags, DM automation, post detail sheet.
- Add 1024 and 1600 widths.
- Add reduced-motion mode for animated routes.
- Reduce masks by default.
- Keep route masks only for truly dynamic values.
- Move component coverage to a separate strict file.

**Acceptance**:

- P0 routes covered at mobile, tablet, laptop, desktop, wide.
- Light/dark snapshots exist.
- Visual diff artifacts are small enough for human review.

### 10.2 `tests/e2e/visual-components.spec.ts` new

**Purpose**: strict deterministic component screenshots.

**Required stories**:

- primitives;
- cards;
- status badges;
- tables;
- charts;
- empty states;
- dialogs/sheets/popovers;
- navigation;
- DM automation;
- feature flags.

**Acceptance**:

- Component screenshots do not mask numbers or charts.
- Component tolerance is much stricter than route snapshots.
- Each story uses deterministic seeded props.

### 10.3 `tests/e2e/visual-states.spec.ts` new

**Purpose**: force hard-to-see states.

**Required states**:

- loading;
- empty;
- error;
- offline;
- unsupported provider;
- permission denied;
- degraded;
- pending mutation;
- destructive confirmation.

**Acceptance**:

- Every P0 view has loading/empty/error screenshot.
- Provider surfaces have unsupported and degraded screenshots.

### 10.4 `src/components/ui/button.tsx`

**Problem**: primitive sizes still allow small targets.

**Required change**:

- Add mobile-safe minimum hit area to all sizes.
- Keep desktop visual density where appropriate.
- Ensure icon buttons have a safe hit area even if the icon is small.
- Use canonical focus ring.

**Acceptance**:

- At 375px, all visible buttons have safe hit area.
- Existing desktop visual density does not become bloated.

### 10.5 `src/components/ui/select.tsx`

**Problem**: select trigger and items can be too small.

**Required change**:

- Add mobile-safe min height to trigger.
- Add comfortable item height for touch.
- Use the same focus ring as Button.
- Test long Persian option labels and mixed RTL/LTR labels.

### 10.6 `src/components/ui/tabs.tsx`

**Required change**:

- Add mobile-safe trigger hit area.
- Add overflow/scroll pattern for many tabs.
- Snapshot settings tabs and analytics tabs.

### 10.7 `src/components/ui/dropdown-menu.tsx`

**Required change**:

- Add touch-safe item height.
- Align focus/hover states with app tokens.
- Snapshot destructive item, disabled item, checkbox item, radio item, sub-menu.

### 10.8 `src/components/dashboard/shared.tsx`

**Problems**:

- charts have repeated motion;
- chart visuals are masked;
- KPI cards need stricter deterministic stories.

**Required change**:

- Classify chart motion as entrance-only.
- Remove or reduce repeated pulse in dense cards.
- Add deterministic chart stories.
- Ensure KPI cards handle long labels and large numbers.

### 10.9 `src/components/shell/sidebar.tsx`

**Problems**:

- live ping can create noise;
- small icon buttons may be below touch floor;
- long workspace/user names need visual stress tests.

**Required change**:

- Replace constant ping with calm status dot.
- Use reconnect pulse only while reconnecting.
- Make logout icon button touch-safe.
- Add no-avatar and long-name stories.

### 10.10 `src/components/shell/app-shell.tsx`

**Required change**:

- Add screenshots for drawer open/closed.
- Verify safe-area bottom padding with mobile nav.
- Add landscape/mobile keyboard scenarios.

### 10.11 `scripts/lint-design.sh`

**Current issue**: only catches colors, some RTL physical classes, arbitrary type/font.

**Required change**:

Add checks for:

- arbitrary spacing/dimensions;
- unapproved radius and shadow;
- unapproved glass usage;
- tiny icon-only controls;
- direct infinite/pulse animations outside allowlist;
- platform color misuse;
- exception count changes.

**Acceptance**:

- New UI cannot add visual drift without lint failure or explicit allowlist.

### 10.12 `.github/workflows/ci.yml`

**Required change**:

- Keep route visual regression blocking.
- Add component visual regression job or include it in current visual job.
- Upload visual artifacts always.
- Make release-candidate Lighthouse blocking.
- Add tap-target and reduced-motion tests to E2E.

### 10.13 `.github/pull_request_template.md` new or update

Add visual evidence checklist:

- before/after screenshot;
- mobile screenshot;
- dark screenshot;
- loading/empty/error screenshot if async;
- focus/keyboard note;
- motion/reduced-motion note;
- visual masks used and why;
- route/component snapshots updated;
- design lint impact.

---

## 11. Design tokens and visual rules

### 11.1 Touch target rule

| Element | Mobile target | Desktop visual size | Notes |
|---|---:|---:|---|
| primary button | 44px min | 36–40px visual allowed | hit area can be larger than visual |
| secondary button | 44px min | 32–36px visual allowed | no cramped mobile buttons |
| icon button | 44×44 min | 16–20px icon | icon size is not hit area |
| select trigger | 44px min | 36px desktop allowed | dropdown item also touch-safe |
| tab trigger | 44px min | 32–36px desktop allowed | scrolling allowed on mobile |
| dropdown item | 40–44px mobile | 32px desktop allowed | destructive item clear |
| checkbox/radio row | 44px min | control can be smaller | label participates in hit area |

### 11.2 Icon scale

| Token | Size | Use |
|---|---:|---|
| icon-xs | 12px | micro badges |
| icon-sm | 14px | compact metadata |
| icon-md | 16px | normal inline icon |
| icon-lg | 20px | primary action/icon button |
| icon-xl | 24px | empty state/section hero |

### 11.3 Card scale

| Variant | Use | Rules |
|---|---|---|
| panel | page section | solid surface, normal padding, header/action area |
| card | normal content | standard radius/shadow/border |
| compact | nested item | subtle surface, smaller padding, no heavy shadow |
| interactive | clickable card | hover/focus clear but not jumpy |
| hero | important KPI/summary | larger type, one primary focus |
| danger | destructive surface | used sparingly, explicit label/action |

### 11.4 Motion taxonomy

| Motion type | Allowed | Rule |
|---|---|---|
| page transition | yes | one short entrance, reduced-motion safe |
| list entrance | yes | small stagger only, no delay that blocks task |
| modal/sheet | yes | clear spatial transition |
| hover lift | limited | subtle, content cards only |
| chart entrance | yes | first render only |
| live pulse | limited | only during active realtime/reconnect/process |
| skeleton shimmer | yes | loading only, no permanent idle shimmer |
| decorative sparkle | no in work UI | allowed only in marketing/empty-state illustration if restrained |
| infinite gradient | rare | never on dense operational surfaces |

### 11.5 Color semantics

| Meaning | Token family | Rule |
|---|---|---|
| primary action | accent | one dominant primary per surface |
| success | success | completed/healthy only |
| warning | warning | needs attention but not failed |
| danger | danger | destructive/failure only |
| info | info/accent-tint | neutral system notes |
| provider brand | logo only | do not fill large surfaces with provider color |
| disabled | ink-disabled | must remain legible |
| selected | accent-soft/tint | must differ from hover |

---

## 12. Route-by-route defect table

### 12.1 Dashboard

| Defect/risk | Severity | Fix | Evidence required |
|---|---|---|---|
| KPI card numbers/charts are masked in visual tests | P0 | deterministic no-mask KPI stories | component screenshots |
| chart pulse may be noisy | P1 | remove or restrict repeated pulse | reduced-motion + normal screenshots |
| long Persian KPI labels may truncate poorly | P1 | long-label fixture | mobile/desktop screenshots |
| dark-mode chart contrast may be inconsistent | P1 | chart color rules | dark component screenshots |
| card height may drift by content | P1 | fixed card layout rules | dashboard matrix screenshots |

### 12.2 Compose

| Defect/risk | Severity | Fix | Evidence required |
|---|---|---|---|
| Too many cards can compete visually | P0 | progressive disclosure and page template | compose screenshots |
| DM automation advanced state may feel heavy | P0 | collapsed default and simple builder | simple/advanced screenshots |
| sticky preview can crowd mobile | P1 | mobile layout rule | 360/375 screenshots |
| platform preview may look fake | P1 | realistic fixtures | per-platform screenshots |
| validation state may be too subtle | P1 | standard error pattern | invalid form screenshot |

### 12.3 Calendar

| Defect/risk | Severity | Fix | Evidence required |
|---|---|---|---|
| Dense cells cramped | P0 | agenda-first mobile, compact tablet | route screenshots |
| holidays and posts compete | P1 | visual hierarchy rules | holiday/dense screenshots |
| drag-only interactions weak on touch | P0 | non-drag alternative | E2E + screenshot |
| dark grid lines too weak/strong | P1 | dark calendar tokens | dark screenshot |

### 12.4 Inbox

| Defect/risk | Severity | Fix | Evidence required |
|---|---|---|---|
| Too many chips per row | P0 | shared InboxRow hierarchy | inbox screenshots |
| SLA warning overpowers message | P1 | SLA severity rules | overdue screenshot |
| reply actions too small on mobile | P0 | touch-safe action bar | 375 screenshot + tap test |
| AI suggestion may look like final answer | P1 | draft visual state | AI suggestion screenshot |
| long messages break row rhythm | P1 | truncation/wrap rules | long-message fixture |

### 12.5 Analytics

| Defect/risk | Severity | Fix | Evidence required |
|---|---|---|---|
| Charts too masked | P0 | deterministic chart stories | no-mask snapshots |
| unsupported provider state too subtle | P0 | explicit unsupported state | provider screenshot |
| legends wrap poorly | P1 | responsive legend rules | mobile screenshots |
| fake precision risk | P0 | source/freshness/confidence labels | screenshots + tests |
| report export visual quality unknown | P1 | export screenshot/PDF check | export evidence |

### 12.6 Settings and feature flags

| Defect/risk | Severity | Fix | Evidence required |
|---|---|---|---|
| Settings can become dumping ground | P1 | settings taxonomy | screenshots |
| Feature flag status hierarchy weak | P1 | flag row component | enabled/disabled/pending/error screenshots |
| Long descriptions wrap poorly | P1 | content max-width and line-height | fixture screenshots |
| Destructive settings need stronger confirmation | P0 | destructive dialog standard | screenshot + E2E |

### 12.7 Channels

| Defect/risk | Severity | Fix | Evidence required |
|---|---|---|---|
| Provider breadth implies equal readiness | P0 | support level badges and capability matrix | screenshots |
| Brand colors compete with app accent | P1 | logo-only brand color rule | provider-heavy screenshots |
| Reconnect state unclear | P0 | standard reconnect card | degraded/reconnect screenshots |
| Permission/scope text too dense | P1 | progressive disclosure | channel detail screenshots |

### 12.8 Media and content library

| Defect/risk | Severity | Fix | Evidence required |
|---|---|---|---|
| Media aspect ratios break grid | P0 | reserved boxes and object-fit rules | 1:1/portrait/landscape screenshots |
| Broken image fallback weak | P0 | standard fallback | broken thumbnail screenshot |
| Upload progress unclear | P1 | progress card pattern | upload screenshot |
| Bulk action bar may crowd mobile | P1 | mobile bottom action pattern | 375 screenshot |
| Metadata overflows | P1 | truncation and bidi rules | long filename screenshot |

---

## 13. Exact PR sequence

### PR 1 — Visual QA hardening foundation

**Title**: `test(visual): expand route matrix and reduce visual masking`

**Files**:

- `tests/e2e/visual.spec.ts`
- `playwright.config.ts`
- `.github/workflows/ci.yml`
- `docs/VISUAL_10_OF_10_AUDIT_AND_FIX_PLAN.md`

**Work**:

- Add 1024 and 1600 viewports.
- Add missing P0 routes.
- Reduce masks.
- Lower screenshot tolerance.
- Upload visual artifacts always.

**Exit**:

- Visual regression still green.
- Screenshots reviewed.

### PR 2 — Component visual baselines

**Title**: `test(visual): add deterministic component visual baselines`

**Files**:

- `tests/e2e/visual-components.spec.ts`
- `tests/e2e/fixtures/visual-data.ts`
- `src/components/visual-test-harness/*` if needed

**Work**:

- Add primitive stories.
- Add KPI/chart stories.
- Add empty state/table/badge stories.
- Use strict tolerance.

**Exit**:

- Component visual suite green.
- No masks for core numbers/charts.

### PR 3 — Touch/focus primitives

**Title**: `fix(ui): enforce touch-safe primitives and unified focus ring`

**Files**:

- `src/components/ui/button.tsx`
- `src/components/ui/select.tsx`
- `src/components/ui/tabs.tsx`
- `src/components/ui/dropdown-menu.tsx`
- `tests/e2e/mobile.spec.ts`
- `tests/e2e/visual-components.spec.ts`

**Work**:

- Add touch-safe hit areas.
- Unify focus ring.
- Add tap-target assertion sweep.

**Exit**:

- All visible interactive controls pass target sweep at 375px.

### PR 4 — Motion cleanup

**Title**: `fix(motion): remove decorative infinite motion and tokenize transitions`

**Files**:

- `src/components/dashboard/shared.tsx`
- `src/components/shell/sidebar.tsx`
- `src/components/views/compose-view.tsx`
- `src/lib/motion.tsx`
- `scripts/lint-design.sh`
- `tests/e2e/reduced-motion.spec.ts`

**Work**:

- Replace live ping.
- Restrict chart pulse.
- Replace inline durations with tokens.
- Add reduced-motion assertions.

**Exit**:

- No unapproved repeated motion in work surfaces.

### PR 5 — Design lint expansion

**Title**: `chore(design): enforce spacing radius shadow glass icon and motion rules`

**Files**:

- `scripts/lint-design.sh`
- `CLAUDE.md`
- `.github/pull_request_template.md`

**Work**:

- Add rules for spacing/dimensions, radius, shadow, glass usage, icon sizes, pulse/infinite motion.
- Add documented allowlist.
- Add PR visual evidence checklist.

**Exit**:

- Design lint blocks visual drift.

### PR 6 — Dashboard and analytics visual polish

**Title**: `fix(visual): dashboard and analytics report-grade polish`

**Files**:

- `src/components/dashboard/shared.tsx`
- `src/components/views/analytics-view.tsx`
- analytics chart components
- visual tests

**Work**:

- KPI/card alignment.
- No-mask chart baselines.
- Unsupported provider state.
- Source/freshness labels.
- Dark-mode chart review.

### PR 7 — Compose and DM automation visual polish

**Title**: `fix(visual): compose hierarchy and dm automation polish`

**Files**:

- `src/components/views/compose-view.tsx`
- `src/components/automation/comment-dm-rules.tsx`
- visual tests

**Work**:

- Collapse optional surfaces.
- Improve primary CTA hierarchy.
- Add DM screenshots simple/advanced/invalid.

### PR 8 — Inbox and calendar visual polish

**Title**: `fix(visual): inbox density and calendar responsive polish`

**Files**:

- `src/components/views/inbox-view.tsx`
- `src/components/views/calendar-view.tsx`
- shared row/calendar components
- visual tests

**Work**:

- Inbox row primitives.
- SLA/status hierarchy.
- Calendar mobile agenda and dense state screenshots.

### PR 9 — Channels, settings, media polish

**Title**: `fix(visual): channels settings and media state polish`

**Files**:

- channels view
- settings view
- media view
- visual tests

**Work**:

- Provider honesty visual hierarchy.
- Feature flag status rows.
- Media aspect ratio/broken/loading states.

### PR 10 — Final visual certification evidence

**Title**: `docs(visual): add final visual certification evidence`

**Files**:

- `docs/visual-evidence/*`
- `docs/VISUAL_10_OF_10_AUDIT_AND_FIX_PLAN.md`

**Work**:

- Attach screenshot matrix summary.
- List known exceptions.
- Record route sign-off.
- Record current score.

---

## 14. Test examples

### 14.1 Tap-target sweep shape

```ts
import { test, expect } from '@playwright/test'

test('mobile tap targets are safe', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/compose')

  const targets = page.locator('button, a, [role="button"], input, textarea, select, [data-slot="select-trigger"]')
  const count = await targets.count()

  for (let i = 0; i < count; i++) {
    const box = await targets.nth(i).boundingBox()
    if (!box) continue
    expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(44)
  }
})
```

### 14.2 Reduced-motion shape

```ts
import { test, expect } from '@playwright/test'

test('reduced motion disables decorative transform animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.waitForLoadState('networkidle')

  const animated = page.locator('[data-motion-check]')
  await expect(animated).not.toHaveCSS('animation-iteration-count', 'infinite')
})
```

### 14.3 Component visual shape

```ts
import { test, expect } from '@playwright/test'

test('kpi card deterministic visual', async ({ page }) => {
  await page.goto('/visual/kpi-card')
  await expect(page).toHaveScreenshot('kpi-card-light.png', {
    animations: 'disabled',
    maxDiffPixelRatio: 0.001,
  })
})
```

### 14.4 Route visual shape

```ts
import { test, expect } from '@playwright/test'

const routes = [
  ['dashboard', '/'],
  ['compose', '/compose'],
  ['calendar', '/calendar'],
  ['inbox', '/inbox'],
  ['analytics', '/analytics'],
]

test.describe('route visuals', () => {
  for (const [name, url] of routes) {
    test(`${name} mobile dark`, async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 })
      await page.emulateMedia({ colorScheme: 'dark' })
      await page.goto(url)
      await page.waitForLoadState('networkidle')
      await expect(page).toHaveScreenshot(`${name}-mobile-dark.png`, {
        animations: 'disabled',
        maxDiffPixelRatio: 0.005,
      })
    })
  }
})
```

---

## 15. Visual defect reporting template

Every visual defect should be filed like this:

```md
## Visual defect

**Route/component:**
**Viewport:**
**Theme:** light / dark
**Mode:** normal / reduced motion / high contrast
**Screenshot:** attach before image

### Problem
What is visually wrong?

### Expected
What should it look like?

### Benchmark principle
Linear / Stripe / Apple / Material / Buffer / Later / Planable / Sprout / WCAG / NN/g

### Fix
Exact file(s) and component(s).

### Acceptance
- [ ] before screenshot attached
- [ ] after screenshot attached
- [ ] visual test added/updated
- [ ] dark mode checked
- [ ] mobile checked
- [ ] reduced motion checked if animated
```

---

## 16. Manual review checklist

Use this checklist for every route screenshot.

### 16.1 Layout

- [ ] No horizontal overflow.
- [ ] Page header has clear hierarchy.
- [ ] Primary action is obvious.
- [ ] Secondary actions do not compete.
- [ ] Cards align to the same grid.
- [ ] Empty space feels intentional.
- [ ] Mobile stacking order matches task priority.
- [ ] Sticky elements do not cover content.

### 16.2 Typography

- [ ] Persian text is readable.
- [ ] No cramped microcopy.
- [ ] Line-height is comfortable.
- [ ] Long labels truncate or wrap gracefully.
- [ ] Mixed RTL/LTR content displays correctly.
- [ ] Numbers align in tables and KPIs.

### 16.3 Color/theme

- [ ] Light mode contrast is strong.
- [ ] Dark mode is not muddy or neon.
- [ ] Semantic colors are used correctly.
- [ ] Provider colors do not dominate.
- [ ] Disabled state is visible but not confused with inactive data.
- [ ] Selected, hover, focus, and active states are distinct.

### 16.4 Interaction

- [ ] Tap targets are safe.
- [ ] Focus ring is visible and consistent.
- [ ] Hover states are subtle.
- [ ] Disabled state has explanation where needed.
- [ ] Destructive actions require confirmation.
- [ ] Pending state prevents double submit.

### 16.5 Motion

- [ ] No unnecessary loop distracts from work.
- [ ] Motion explains hierarchy or state.
- [ ] Reduced motion still works.
- [ ] Skeletons do not shimmer forever after loading.
- [ ] Page transitions do not delay task flow.

### 16.6 Data visualization

- [ ] Charts have clear baseline/axis/context.
- [ ] Color meaning is consistent.
- [ ] Legends do not wrap badly.
- [ ] Empty/unsupported/partial data is honest.
- [ ] No fake precision.
- [ ] Source/freshness is visible where important.

---

## 17. Issue-ready backlog

### P0

1. `[P0][Visual QA] Expand visual regression to all routes, states, and stricter thresholds`
2. `[P0][Primitives] Enforce touch-safe controls and unified focus ring in UI primitives`
3. `[P0][Charts] Add deterministic no-mask chart and KPI visual baselines`
4. `[P0][Design Lint] Enforce spacing, radius, shadow, glass, icon, and motion rules`
5. `[P0][Route Sweep] Manual screenshot audit at 375/768/1024/1280/1600 light/dark`
6. `[P0][States] Add loading, empty, error, offline, unsupported, permission visual tests`
7. `[P0][PR Template] Require visual evidence for every UI PR`

### P1

8. `[P1][Motion] Remove decorative infinite motion and tokenize all remaining transitions`
9. `[P1][Theme] Dark/high-contrast/reduced-transparency visual pass`
10. `[P1][Compose] Simplify visual hierarchy and optional feature stacking`
11. `[P1][Inbox] Operational density and SLA/status visual refinement`
12. `[P1][Calendar] Dense mobile/tablet visual polish and drag-state alternatives`
13. `[P1][Analytics] Report-grade chart, legend, source/freshness, unsupported-state polish`
14. `[P1][Settings] Feature flags and settings hierarchy visual refinement`
15. `[P1][Media] Real media aspect-ratio, broken-image, and upload-state polish`
16. `[P1][Channels] Provider capability and reconnect-state visual truth pass`

### P2

17. `[P2][Design Docs] Component workbench with canonical examples`
18. `[P2][Design Docs] Visual language guide: icons, illustrations, empty states, charts`
19. `[P2][Brand] Nashrino visual identity refinement beyond generic violet SaaS`
20. `[P2][RUM] Field visual/performance quality dashboard: LCP/INP/CLS by route/device`
21. `[P2][External Review] Independent accessibility and visual QA review`

---

## 18. Acceptance gates for final visual sign-off

### 18.1 Automated gates

- [ ] `lint:design` catches colors, RTL physical classes, type scale, spacing, dimensions, radius, shadow, glass, icon size, and motion exceptions.
- [ ] Visual route suite covers P0/P1 routes.
- [ ] Component visual suite covers primitives and complex components.
- [ ] State visual suite covers loading/empty/error/offline/unsupported/permission states.
- [ ] Tap-target sweep passes at 375px.
- [ ] Reduced-motion E2E passes.
- [ ] Dark mode route screenshots pass.
- [ ] Build, typecheck, E2E, visual, and security remain green.

### 18.2 Manual gates

- [ ] Design lead reviews screenshot matrix.
- [ ] Product lead reviews primary-action clarity.
- [ ] Accessibility reviewer checks focus/contrast/reduced motion.
- [ ] Persian reviewer checks language, line-height, and bidi content.
- [ ] Engineering reviewer checks maintainability and token usage.

### 18.3 Evidence gates

- [ ] Screenshot matrix attached.
- [ ] Known exceptions documented.
- [ ] Before/after examples attached for major fixes.
- [ ] Visual defect list closed or intentionally deferred.
- [ ] Current score updated.
- [ ] External review scheduled or completed before certification.

---

## 19. Final score target after execution

| Area | Current | After execution |
|---|---:|---:|
| Visual QA safety | 6.5 | 9.5 |
| Theme consistency | 8.0 | 9.4 |
| Typography | 7.4 | 9.3 |
| Layout/responsive | 7.5 | 9.4 |
| Components/primitives | 7.0 | 9.5 |
| Motion | 7.2 | 9.3 |
| Charts/data visualization | 6.8 | 9.4 |
| Mobile/touch | 7.0 | 9.5 |
| Accessibility visual layer | 7.4 | 9.3 |
| Product polish | 7.2 | 9.3 |
| Overall visual score | 6.9 | 9.5 |
| Overall product score | ~8.0 | ~8.8–9.1 |

This execution will not alone make the entire company/product 10/10 because full certification also requires provider truth, production reliability, security review, DR drills, real user activation metrics, field Web Vitals, and external review. But it can make the visual system and visual QA program world-class.

---

## 20. Final recommendation

The highest-leverage next action is not another visual redesign. It is a strict visual QA and primitive-hardening program.

Do this in order:

1. Expand and harden visual regression.
2. Add component visual baselines.
3. Fix primitive touch/focus rules.
4. Remove visual noise from motion.
5. Expand design lint.
6. Sweep routes with screenshots.
7. Close visual defects with before/after proof.
8. Add visual evidence to every future UI PR.

If these steps are executed, Nashrino’s visual quality can move from a strong but imperfect modern SaaS UI to a truly professional, evidence-backed, world-class product experience.
