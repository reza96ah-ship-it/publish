# Nashrino Visual 10/10 Audit and Fix Plan

> Detailed UI/UX, theme, motion, interaction, responsive, RTL, accessibility, and visual-regression plan for moving Nashrino from a strong product shell to a world-class visual experience.

| Field | Value |
|---|---|
| Product | Nashrino / نشرینو |
| Audit type | Visual, UI/UX, theme, motion, interaction, responsive, RTL, accessibility, regression safety |
| Audit date | 2026-07-06 |
| Target branch | `main` |
| Related plan | `docs/WORLD_CLASS_PRODUCT_10_OF_10_PLAN.md` |
| Related trackers | #160, #232, #233, #234, #235, #236 |
| Current visual score | ~6.9/10 |
| Current overall product score | ~8.0/10 |
| Target visual score | 9.5+/10 |
| Target certification score | 95+/100 |
| Recommendation | Create a dedicated visual QA phase before adding more large surfaces |

---

## 1. Executive summary

Nashrino has improved a lot. The product now has a strong token system, dark mode, RTL work, responsive shell, visual regression tests, E2E tests, a motion provider, feature flags UI, DM automation improvements, and many product features.

The remaining visual problem is not one big broken screen. The main problem is many small defects that can still survive green CI:

- tiny controls below the desired mobile touch target;
- visual regression tests that are too limited, too masked, and too tolerant;
- card spacing and density drift between views;
- charts and KPI cards hidden behind masks;
- decorative motion that can create visual noise;
- incomplete route/state screenshot coverage;
- weak component-level visual baselines;
- dark-mode and high-contrast edge cases;
- inconsistent polish between old and new feature surfaces;
- under-tested popovers, sheets, dropdowns, advanced states, and destructive states;
- Persian long-text and mixed RTL/LTR content not fully protected.

This document separates confirmed code-backed issues from high-probability visual risks. Any item that depends on actual rendering must be confirmed with screenshots before final closure.

---

## 2. Benchmark model

Nashrino should learn from world-class products without copying one product exactly.

| Benchmark | What to learn | Nashrino standard |
|---|---|---|
| Linear | Dense but calm information hierarchy; restrained motion; predictable primitives | Density only where work requires it; decorative polish must not compete with task state |
| Stripe | Precise surfaces, shadows, typography, and error/help hierarchy | Every state must look intentional: loading, empty, error, partial, unsupported, degraded |
| Vercel | Fast, minimal UI; strong contrast; developer-grade confidence | Keep work surfaces light, legible, and responsive |
| Apple HIG | Depth only when it clarifies layers; respect reduced transparency and motion | Glass only in navigation/floating layers; content cards stay solid |
| Material Design 3 | Tokenized color, type, motion, shape, and state systems | All production UI must come from semantic tokens and primitives |
| Buffer | Simple publishing mental model | Advanced settings hidden by default; main task stays obvious |
| Later | Visual planning and media confidence | Preview, grid, calendar, and media surfaces must feel first-class |
| Planable | Comments and approval in context | Approval visuals belong on the exact content/revision object |
| Sprout / Agorapulse | Inbox and reporting operational clarity | Dense views need excellent row rhythm, state chips, and low-noise motion |
| NN/g heuristics | visibility, consistency, recognition, minimalist design, recovery | UI must make system status, next action, and recovery obvious |

Reference sources:

- Apple Human Interface Guidelines: https://developer.apple.com/design/human-interface-guidelines
- Material Design 3 Foundations: https://m3.material.io/foundations
- Nielsen Norman Group 10 Usability Heuristics: https://www.nngroup.com/articles/ten-usability-heuristics/
- WCAG 2.2: https://www.w3.org/TR/WCAG22/
- Web Vitals: https://web.dev/articles/vitals

---

## 3. Current score

| Category | Current score | Target | Why |
|---|---:|---:|---|
| Theme foundation | 8.0 | 9.5 | Strong OKLCH tokens, dark mode, semantic colors; governance still incomplete |
| Typography | 7.4 | 9.5 | Persian-first scale exists; micro labels and density need rendered review |
| Layout/responsive | 7.5 | 9.5 | Shell improved; every route/state is not yet covered |
| Components/primitives | 7.0 | 9.5 | Button/select primitives still define small default heights |
| Cards/surfaces | 7.5 | 9.5 | Strong card system; density/radius/shadow consistency needs stronger gates |
| Charts/data visualization | 6.8 | 9.5 | Improved charts, but too much chart masking in visual tests |
| Motion | 7.2 | 9.5 | MotionProvider exists; inline durations and infinite decorative loops remain |
| Visual regression safety | 6.5 | 9.5 | Good start; route coverage, masks, tolerance are not strict enough |
| Mobile/touch | 7.0 | 9.5 | Mobile shell improved; primitive touch floor is not guaranteed |
| Accessibility visual layer | 7.4 | 9.5 | Focus/high contrast/reduced motion exist; not fully verified across surfaces |
| Overall visual quality | 6.9 | 9.5 | Many small defects can pass current gates |

---

## 4. Current repo evidence

### 4.1 Strong foundations already present

- `src/app/globals.css` defines a production-grade design system using semantic surfaces, ink, accent, semantic state colors, shadows, radii, motion tokens, platform colors, and Persian type scale.
- The app root wraps UI in `MotionProvider`, using Framer Motion reduced-motion support.
- `tests/e2e/visual.spec.ts` exists and covers 6 views × 3 viewports × 2 color schemes = 36 baselines.
- CI runs `lint:design`, visual regression, E2E, Lighthouse, security, load, Docker, and build jobs.
- `scripts/lint-design.sh` blocks raw palette leaks, some physical direction classes, and arbitrary type-size/font-weight classes.
- The previous visual tracker #236 and issues #232/#233/#234/#235 are closed.

### 4.2 Confirmed weaknesses from code

| ID | Confirmed problem | Evidence | Severity | Fix |
|---|---|---|---|---|
| VQA-001 | Visual screenshot tolerance is too high | `tests/e2e/visual.spec.ts` uses a high pixel tolerance | P0 | Replace with stricter route thresholds and component thresholds |
| VQA-002 | Visual tests mask too much of the product | KPI numbers, Recharts, native SVG charts, metric cards, avatars, timestamps, and live indicators are masked | P0 | Add deterministic component tests without masks |
| VQA-003 | Visual route coverage is too narrow | Only signin, dashboard, compose, campaigns, analytics, settings | P0 | Add all core routes and states |
| VQA-004 | Button primitive still emits sub-44px heights | `Button` variants include `h-9`, `h-8`, `h-10`, `size-9` | P0 | Bake mobile-safe hit areas into primitive variants |
| VQA-005 | Select trigger still emits sub-44px heights | `SelectTrigger` uses default and small fixed heights | P0 | Add mobile-safe min height and hit area |
| VQA-006 | Live indicator uses animated ping | Sidebar still uses `animate-ping`; visual tests mask it | P1 | Replace with calmer status dot or pulse only during reconnect |
| VQA-007 | Motion has remaining inline durations | MiniChart/Sparkline use local timing values | P1 | Replace with motion tokens and motion-category rules |
| VQA-008 | Infinite motion remains in chart pulse | Chart pulse repeats while animation is allowed | P1 | Limit to status-critical contexts or disable in dense dashboards |
| VQA-009 | Design lint does not catch spacing/radius/shadow/icon drift | `lint-design.sh` checks colors, physical RTL classes, arbitrary type/font only | P0 | Extend design lint to spacing, dimensions, radius, shadow, glass, icon sizes |
| VQA-010 | Lighthouse is not fully blocking | CI uses Lighthouse as non-blocking | P1 | Make mobile Lighthouse/RUM budgets blocking for release candidates |
| VQA-011 | Data visualization quality is under-protected | Chart visuals are masked | P0 | Create fixed-data chart screenshots and contrast tests |
| VQA-012 | Focus visuals can still diverge | App uses both custom focus utility and shadcn focus ring patterns | P1 | Pick one focus language and enforce it in primitives |

---

## 5. Complete visual problem catalogue

### 5.1 Visual QA and screenshot coverage

#### VQA-101 — Visual regression is too forgiving

**Problem**: A route can pass visual regression while still having misaligned chips, bad KPI rhythm, weak chart spacing, wrong dark-mode detail, or icon misalignment.

**Benchmark solution**: World-class teams use layered visual QA: route screenshots, component screenshots, state screenshots, and manual design review.

**Fix**:

- Keep route screenshots with minimal dynamic masks.
- Add strict component screenshots with deterministic data.
- Add primitive screenshots for buttons, inputs, select, tabs, cards, badges, charts, tables.
- Review visual diff artifacts before merging.

**Acceptance**:

- Route tolerance is strict enough to catch spacing regressions.
- Component snapshots do not mask numbers/charts.
- Every UI PR includes before/after screenshots.

---

#### VQA-102 — Route matrix is incomplete

**Missing or under-covered routes/surfaces**:

- `/inbox`
- `/calendar`
- `/channels`
- `/content`
- `/media`
- `/onboarding`
- `/help`
- `/status`
- feature flags tab
- DM automation monitor
- approval/review surfaces
- IG grid preview
- post analytics detail sheet
- queue settings
- billing/plan states

**Fix**: Add screenshots at 375, 768, 1024, 1280, and 1600px for every major route in light, dark, and reduced-motion mode.

---

#### VQA-103 — State matrix is incomplete

**Required states**:

- loading skeleton;
- empty state;
- first-use empty state;
- error state;
- API timeout;
- offline;
- permission denied;
- unsupported provider;
- beta disabled;
- partial provider data;
- reconnect required;
- degraded service;
- invalid form;
- submit pending;
- optimistic update;
- undo/rollback;
- destructive confirmation.

**Fix**: Use API mocking or seed fixtures to snapshot every state.

---

### 5.2 Components and primitives

#### VQA-201 — Interactive primitives are not mobile-safe by default

**Problem**: Buttons and select triggers define small fixed heights. Call-site `min-h` patches are fragile.

**Fix**:

- Update Button variants so all touch usage gets at least 44px hit area.
- Update SelectTrigger, TabsTrigger, dropdown items, checkbox/radio labels, and icon buttons.
- Add a Playwright tap-target sweep at 375px.

**Acceptance**:

- Every visible interactive element is at least 44×44 on touch unless explicitly documented.
- No icon-only button below the target without a larger hit-area wrapper.

---

#### VQA-202 — Focus ring language is not fully unified

**Problem**: `.n-focus-ring` and shadcn focus styles can create inconsistent focus visuals.

**Fix**:

- Make one canonical focus utility.
- Map all primitives to the same focus ring token.
- Add focus screenshots for primitives.

---

#### VQA-203 — Icon sizes are inconsistent

**Problem**: Current code uses many icon sizes. Some are legitimate, but without a rule it becomes drift.

**Fix**:

Define icon tokens:

| Token | Size | Use |
|---|---:|---|
| icon-xs | 12px | badges, micro metadata |
| icon-sm | 14px | compact labels |
| icon-md | 16px | normal inline icon |
| icon-lg | 20px | major action/icon button |
| icon-xl | 24px | empty state / hero icon |

---

#### VQA-204 — Radius, shadow, and padding drift are not fully enforced

**Problem**: The token system exists, but individual components can still create custom spacing, custom shadows, and custom card density.

**Fix**:

- Define approved card variants: `panel`, `card`, `compact`, `list-row`, `hero`.
- Add lint for unapproved shadow/radius usage.
- Add screenshots for every card variant.

---

### 5.3 Theme and color

#### VQA-301 — Raw color escape hatches need governance

**Problem**: Token definitions and allowlists are acceptable, but exception counts can grow over time.

**Fix**:

- Raw color only in token source, brand assets, or documented exceptions.
- CI reports exception count.
- Exception count cannot increase without a deliberate allowlist update.

---

#### VQA-302 — Platform brand colors can fight product identity

**Problem**: Telegram/LinkedIn brand colors are blue. If used too broadly, they can break Nashrino’s restrained violet identity.

**Fix**:

- Full brand color only inside official logo marks.
- Use semantic provider support badges for state.
- Use muted brand tint for chips.
- Add platform-heavy view screenshots.

---

#### VQA-303 — Dark mode needs route/state screenshots, not just tokens

**Common dark-mode risks**:

- border too low contrast;
- shadows invisible or too heavy;
- chart lines too neon;
- skeleton shimmer too bright;
- glass sheet too transparent;
- disabled text unreadable;
- hover state too weak.

**Fix**: Add dark-mode component snapshots for cards, tables, forms, select/dropdown, dialogs/sheets/popovers, charts, status badges, empty states, media previews, calendar cells, and inbox rows.

---

#### VQA-304 — High-contrast and reduced-transparency need visual review

**Problem**: CSS includes high-contrast and reduced-transparency support, but coverage is not enough.

**Fix**:

- Add reduced-motion and reduced-transparency screenshots.
- Manually test forced-colors / high-contrast mode.
- Review glass surfaces under accessibility modes.

---

### 5.4 Typography and Persian copy

#### VQA-401 — Microtext may be too small or overused

**Problem**: `text-2xs` and `text-xs` are useful but can make Persian text feel cramped if overused.

**Rules**:

- `text-2xs` only for badges, timestamps, tiny metadata.
- No paragraph/helper copy below `text-sm`.
- No form hint below `text-xs`.
- No primary navigation below `text-sm`.
- Every `text-2xs` must pass screenshot review at 375px.

---

#### VQA-402 — Persian line-height and truncation need stress tests

**Fixtures to add**:

- very long workspace name;
- long campaign name;
- long Persian + English brand name;
- URL in RTL text;
- hashtag sequence;
- Jalali date range;
- emoji in label;
- multi-line approval comment;
- long provider error message.

**Acceptance**: no clipped glyphs, broken ellipsis, or bad bidi order.

---

#### VQA-403 — English/Persian mixed direction must be verified

**Problem**: Social products naturally mix Persian, English, @handles, hashtags, links, metrics, and provider IDs.

**Fix**: Add a Bidi stress fixture and use it in compose, preview, inbox, campaign table, analytics sheet, and media metadata.

---

### 5.5 Layout, spacing, and density

#### VQA-501 — Density system exists but is not fully applied

**Problem**: Density tokens exist, but local padding/gap classes can still drift.

**Fix**:

- Convert core views to density-aware wrappers.
- Define page templates: overview, builder, table, calendar, inbox, settings, analytics.
- Each template defines header, card gap, section gap, action placement, and empty state placement.

---

#### VQA-502 — Compose card stacking can become visually heavy

**Problem**: Compose combines content, media, platform selection, campaign, DM automation, scheduling, preview, AI, and publish actions.

**Fix**:

- Keep one primary path visible.
- Collapse optional features by default.
- Keep preview visually secondary but stable.
- Use one primary CTA area.
- Add screenshots for long caption, media selected, DM section, and scheduled state.

---

#### VQA-503 — Table/list row heights may drift

**Problem**: Inbox, analytics, campaigns, content, media, and settings need consistent rows.

**Fix**: Create shared row primitives: `DataRow`, `DataCell`, `StatusCell`, `ActionCell`, `RowActions`.

**Acceptance**:

- same vertical rhythm across all tables;
- same avatar/icon size;
- same status chip height;
- same action placement;
- same hover/focus behavior;
- compact and comfortable density both work.

---

### 5.6 Motion and interaction

#### VQA-601 — Decorative infinite motion should be restricted

**Problem**: Infinite ping, shimmer, pulse, or gradient animation can make work surfaces feel busy.

**Policy**:

| Motion class | Allowed? | Use |
|---|---|---|
| Status-critical pulse | limited | reconnecting, live upload, active publish only |
| Skeleton shimmer | yes, restrained | loading only |
| Chart entrance | yes | first load only |
| Gradient hover loop | rare | hero/premium card only |
| Decorative sparkle | no in work surfaces | avoid in dense operations |
| Layout transition | yes | route/tab/sheet continuity |

---

#### VQA-602 — Motion tokens must be the only timing vocabulary

**Problem**: Inline motion durations still exist.

**Fix**:

- Add lint rule for local Framer Motion duration values outside `src/lib/motion.tsx`.
- Replace with `duration.quick`, `duration.standard`, etc.
- Add comments for unusual motion cases.

---

#### VQA-603 — Reduced-motion evidence is incomplete

**Fix**:

- E2E: emulate reduced motion and assert no transform animation on initial load.
- Visual: capture reduced-motion route snapshots.
- Component: test chart without infinite pulse.

---

### 5.7 Data visualization

#### VQA-701 — Charts are visually under-tested

**Problem**: Charts and KPI numbers are central to product trust but are heavily masked.

**Fix**: Create deterministic visual stories for flat data, single point, spike, drop, negative value, no data, partial data, unsupported provider, many series, long legends, dark mode, and mobile width.

---

#### VQA-702 — Chart color semantics need hard rules

| Meaning | Color rule |
|---|---|
| primary series | accent |
| positive delta | success |
| warning threshold | warning |
| error/failure | danger |
| neutral comparison | ink-tertiary / border |
| provider identity | logo mark only |
| multi-series categorical | chart palette with legend and pattern support |

---

#### VQA-703 — KPI cards need no-mask visual tests

**Fix**:

- Fixed seeded KPI card component tests.
- Test 1, 2, 3, and 4 cards per row.
- Test long Persian KPI labels.
- Test very large numbers.
- Test negative trend.
- Test loading and empty states.

---

### 5.8 Navigation and shell

#### VQA-801 — Sidebar desktop states need screenshot review

**Risks**:

- active item height too small;
- icon vertical alignment inconsistent;
- notification badge crowds label;
- bottom user/workspace block clips long names;
- ping animation draws attention away from work.

**Fix**:

- Add sidebar snapshots with 0/1/3-digit badges.
- Add long workspace/user names.
- Add no-avatar state.
- Add failed summary state.
- Replace live ping with calmer status.

---

#### VQA-802 — Mobile nav and drawer need more state coverage

**Required screenshots**:

- mobile drawer open;
- bottom nav active item per major route;
- notification button with badge;
- safe area on iPhone dimensions;
- landscape mobile;
- keyboard open in forms;
- scroll position retained.

---

### 5.9 Compose and publishing

#### VQA-901 — Compose has high visual complexity

**Visual rules**:

- one primary path visible;
- optional features collapsed;
- preview always visually secondary but sticky;
- AI sheet does not compete with publish CTA;
- schedule state visible but not overemphasized;
- DM automation shown as suggestion, not admin form.

**Required screenshots**:

- empty compose;
- long caption;
- Instagram selected;
- multiple platforms;
- media selected;
- DM automation collapsed;
- DM automation simple builder;
- DM automation advanced open;
- scheduled mode;
- validation error;
- publish pending;
- publish success/partial failure.

---

#### VQA-902 — Platform preview tabs need realistic visual audit

**Fix**:

- Use realistic social post fixtures.
- Ensure platform labels are clear.
- Do not overuse platform brand color beyond logo/chrome.
- Show unsupported post types clearly.
- Snapshot with 1 image, carousel, video placeholder, no media, long hashtags.

---

### 5.10 Inbox and engagement

#### VQA-1001 — Inbox density can become noisy

**Fix**:

- Create `InboxRow` primitive.
- Use consistent state chips.
- Separate urgent SLA from normal status.
- Keep row hover/focus calm.
- Use split-pane hierarchy: list = scanning, detail = action.
- Add snapshots for empty, unassigned, overdue, resolved, and automation-created conversations.

---

#### VQA-1002 — Saved replies and AI suggestions need state clarity

**Problem**: AI suggestions can look like final answers if not visually distinct.

**Fix**:

- Draft state visual treatment.
- “Insert” action separated from “send”.
- Show source/context confidence where applicable.
- Show loading skeleton that does not shift the reply box.

---

### 5.11 Calendar and planning

#### VQA-1101 — Calendar has high responsive risk

**Fix**:

- Mobile: agenda-first.
- Tablet: compact week view.
- Desktop: full calendar grid.
- Add non-drag alternative.
- Snapshot holidays, scheduled posts, failed posts, empty days, dense days, drag hover, resize/reorder state.

---

### 5.12 Analytics and reports

#### VQA-1201 — Analytics visuals need report-grade polish

**Fix**:

- No fake precision.
- Every metric has source and freshness.
- Unsupported providers show honest state.
- Use one chart grammar.
- Add report export visual checks.
- Snapshot campaign ROI cards, post detail sheet, unsupported provider note, partial data.

---

### 5.13 Settings and feature flags

#### VQA-1301 — Settings can become a dumping ground

**Fix**:

- Categorize settings: workspace, team, security, channels, beta features, billing, support.
- Each tab has one primary job.
- Feature flags show status, risk, description, owner, and last changed.
- Snapshot enabled, disabled, toggle pending, and error states.

---

### 5.14 Media and content library

#### VQA-1401 — Media grid needs image-quality states

**Fix**:

- Reserved aspect-ratio boxes.
- Broken image fallback.
- Upload progress.
- Unsupported file type.
- Video thumbnail/loading.
- Selection state.
- Bulk actions state.
- Snapshot 1:1, portrait, landscape, transparent PNG, broken thumbnail.

---

### 5.15 Empty/loading/error states

#### VQA-1501 — Empty states need a visual language

| Type | Use | Visual |
|---|---|---|
| First use | no user data yet | illustration + short benefit + CTA |
| Filter empty | data exists but filter hides it | simple icon + reset-filter action |
| Unsupported | provider cannot provide data | neutral note + reason + docs link |
| Permission denied | user lacks permission | lock icon + request-access action |
| Error | system failed | problem + retry + support path |
| Offline | network unavailable | offline icon + retry + cached status |

---

## 6. Design-system improvements

### 6.1 Stronger design lint

Extend `scripts/lint-design.sh` to catch:

- arbitrary spacing and dimensions;
- unapproved radius and shadow usage;
- unapproved glass usage outside navigation/floating layers;
- icon-only controls that are too small;
- direct infinite/pulsing animations outside an allowlist;
- unapproved platform color usage;
- new exceptions without documentation.

### 6.2 Component visual tests

Add `tests/e2e/visual-components.spec.ts` with deterministic stories for:

- button variants;
- select/dropdown;
- tabs;
- cards;
- chips/badges;
- table rows;
- KPI cards;
- charts;
- empty states;
- forms;
- dialogs/sheets/popovers;
- sidebar sections;
- mobile bottom nav;
- toast/alert/error messages;
- DM automation builder;
- feature flag row.

### 6.3 Route state visual tests

Add `tests/e2e/visual-states.spec.ts` for:

- loading;
- empty;
- error;
- offline;
- permission denied;
- unsupported provider;
- degraded service;
- pending mutation;
- destructive confirmation.

### 6.4 PR visual evidence checklist

Every UI PR must include:

- before/after screenshot;
- mobile screenshot;
- dark mode screenshot;
- loading/empty/error screenshot if async;
- notes for any masked visual areas;
- motion/reduced-motion note;
- keyboard/focus note.

---

## 7. Route-by-route audit checklist

### Dashboard

Check KPI card height, chart baseline alignment, trend chips, no-mask chart output, empty KPI state, real data/freshness label, long Persian labels, dark-mode chart contrast, mobile stacking, and reduced-motion behavior.

Likely issues: chart pulse too noisy, KPI numbers masked, long labels truncating, cards feeling over-animated.

### Compose

Check card rhythm, sticky preview alignment, DM automation collapsed/simple/advanced, AI sheet, platform previews, media uploader, schedule controls, bottom action bar safe area, validation errors, publish pending/success/failure.

Likely issues: too many cards visible, optional surfaces competing with publish action, sticky preview crowding small screens.

### Calendar

Check mobile agenda, dense week view, long titles, holidays, drag/drop states, non-drag alternatives, touch targets, color semantics, dark grid lines.

Likely issues: dense cells cramped, holidays and posts competing, drag affordance weak on touch.

### Inbox

Check row density, unread/assigned/SLA/resolved badges, split pane, reply box, saved replies, AI suggestion state, automation-created messages, long customer messages, empty/error states.

Likely issues: too many chips per row, SLA warnings overpower content, reply actions too small on mobile.

### Analytics

Check chart grammar, unsupported provider state, freshness/source labels, campaign ROI cards, post detail sheet, mobile charts, fake precision, dark chart contrast.

Likely issues: masked charts hide visual problems, unsupported provider state too subtle, legends wrap poorly.

### Settings

Check tab hierarchy, feature flag rows, toggle pending/error states, security/billing density, long descriptions, destructive actions.

Likely issues: sections too similar, feature flags need stronger risk/status hierarchy.

### Channels

Check provider health cards, support badges, permissions/scopes, reconnect state, unavailable/beta labels, logo alignment, platform brand colors.

Likely issues: provider breadth implies equal readiness, brand colors compete with accent.

### Media

Check thumbnail aspect ratio, broken fallback, upload progress, selected state, bulk action bar, transparent image treatment, dark mode media cards.

Likely issues: real media ratios break grid, metadata overflows.

---

## 8. Priority implementation plan

### Phase P0 — Visual QA gate hardening

1. Create `[P0][Visual QA] Small visual defects sweep — all routes, all states, all themes`.
2. Expand route screenshot matrix.
3. Add component visual tests.
4. Lower screenshot tolerance.
5. Reduce masks.
6. Add deterministic chart/KPI tests.
7. Add PR screenshot checklist.

Exit evidence:

- new visual suite runs in CI;
- every core route has mobile/tablet/desktop/dark coverage;
- component snapshots exist for primitives and data components;
- screenshots attached to tracker.

### Phase P0 — Primitive touch/focus fix

1. Update `Button` variants.
2. Update `SelectTrigger`.
3. Update `TabsTrigger`.
4. Update dropdown items.
5. Update icon-only controls.
6. Add tap-target sweep.
7. Unify focus ring.

Exit evidence:

- tap-target test passes at 375px;
- no interactive element under target unless documented exception;
- focus screenshots pass.

### Phase P1 — Motion noise reduction

1. Replace live ping with calm status.
2. Restrict chart pulse.
3. Replace inline transition durations with tokens.
4. Gate decorative animations.
5. Add reduced-motion screenshots.

Exit evidence:

- no infinite decorative motion outside allowlist;
- no unclassified motion;
- reduced-motion tests pass.

### Phase P1 — Theme governance

1. Add glass usage lint.
2. Add shadow/radius lint.
3. Add icon-size lint.
4. Add platform-color usage rules.
5. Add dark/high-contrast snapshots.

Exit evidence:

- design lint catches visual drift;
- exceptions are documented and counted.

### Phase P1 — Route polish sweep

Order:

1. Dashboard + analytics.
2. Compose + DM automation.
3. Inbox.
4. Calendar.
5. Channels + settings.
6. Media + content library.
7. Onboarding/help/status.

Each route gets screenshots, defect list, fixes, updated snapshots, and sign-off.

---

## 9. Issue-ready backlog

### P0 issues

1. `[P0][Visual QA] Expand visual regression to all routes, states, and stricter thresholds`
2. `[P0][Primitives] Enforce touch-safe controls and unified focus ring in UI primitives`
3. `[P0][Charts] Add deterministic no-mask chart and KPI visual baselines`
4. `[P0][Design Lint] Enforce spacing, radius, shadow, glass, icon, and motion rules`
5. `[P0][Route Sweep] Manual screenshot audit at 375/768/1024/1280/1600 light/dark`

### P1 issues

6. `[P1][Motion] Remove decorative infinite motion and tokenize all remaining transitions`
7. `[P1][Theme] Dark/high-contrast/reduced-transparency visual pass`
8. `[P1][Compose] Simplify visual hierarchy and optional feature stacking`
9. `[P1][Inbox] Operational density and SLA/status visual refinement`
10. `[P1][Calendar] Dense mobile/tablet visual polish and drag-state alternatives`
11. `[P1][Analytics] Report-grade chart, legend, source/freshness, unsupported-state polish`
12. `[P1][Settings] Feature flags and settings hierarchy visual refinement`
13. `[P1][Media] Real media aspect-ratio, broken-image, and upload-state polish`

### P2 issues

14. `[P2][Design Docs] Component workbench with canonical examples`
15. `[P2][Design Docs] Visual language guide: icons, illustrations, empty states, charts`
16. `[P2][Brand] Nashrino visual identity refinement beyond generic violet SaaS`
17. `[P2][RUM] Field visual/performance quality dashboard: LCP/INP/CLS by route/device`

---

## 10. Acceptance gates for visual 10/10

### Screenshot gates

- [ ] All major routes covered at 375, 768, 1024, 1280, 1600.
- [ ] Light and dark covered.
- [ ] Reduced motion covered for animated routes.
- [ ] Component snapshots exist for primitives and complex components.
- [ ] Dynamic masks are minimal and justified.
- [ ] No route snapshot uses overly large tolerance.
- [ ] Visual diff artifacts are reviewed, not blindly updated.

### Component gates

- [ ] Buttons touch-safe.
- [ ] Select/tabs/dropdown touch-safe.
- [ ] Focus ring unified.
- [ ] Icon sizes governed.
- [ ] Cards use approved padding/radius/shadow.
- [ ] Tables use row primitives.
- [ ] Charts have deterministic baselines.
- [ ] Empty/error/loading states standardized.

### Motion gates

- [ ] No decorative infinite animation in work surfaces.
- [ ] All JS motion uses `src/lib/motion.tsx` tokens.
- [ ] Reduced-motion mode has complete experience.
- [ ] Animation never hides state or delays task completion.

### Theme gates

- [ ] No raw color classes outside allowlist.
- [ ] No unapproved glass use.
- [ ] No unapproved shadow/radius classes.
- [ ] Dark mode contrast manually reviewed.
- [ ] High-contrast forced-colors checked.
- [ ] Platform brand colors contained to logos/approved chips.

### UX gates

- [ ] Primary action is visually obvious on every route.
- [ ] Secondary actions do not compete.
- [ ] Advanced settings use progressive disclosure.
- [ ] Error messages are visible and actionable.
- [ ] Empty states tell user what to do next.
- [ ] Unsupported provider states are honest and not hidden.
- [ ] Long Persian text does not break layout.

---

## 11. Proposed score after this plan is complete

| Area | Current | After plan |
|---|---:|---:|
| Visual QA safety | 6.5 | 9.4 |
| Theme consistency | 8.0 | 9.3 |
| Typography | 7.4 | 9.2 |
| Layout/responsive | 7.5 | 9.3 |
| Components/primitives | 7.0 | 9.5 |
| Motion | 7.2 | 9.3 |
| Charts/data visualization | 6.8 | 9.2 |
| Mobile/touch | 7.0 | 9.5 |
| Accessibility visual layer | 7.4 | 9.2 |
| Overall visual score | 6.9 | 9.4 |
| Product score | ~8.0 | ~8.7–9.0 |

This plan alone does not make the whole product 10/10. World-class certification still requires activation evidence, provider truth, security, DR, performance field data, external review, and business proof. But it directly targets the biggest current visual weakness: many small visual defects surviving green CI.

---

## 12. Final recommendation

Do not treat the closed UI/theme tracker as the end of visual work. Treat it as the foundation.

The next best move is:

1. Open the new P0 Visual QA tracker.
2. Harden visual regression.
3. Fix touch/focus primitives.
4. Add component visual baselines.
5. Run manual route-by-route screenshot review.
6. Only then continue adding large new visual surfaces.

The product is close enough that visual polish now matters more. Small defects are exactly what separate a strong 8/10 SaaS UI from a world-class 10/10 product.
