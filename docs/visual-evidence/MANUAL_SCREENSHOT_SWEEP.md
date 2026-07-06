# Manual Route Screenshot Sweep — Issue #288

## Purpose

Automated visual regression catches regressions but cannot replace human review.
This document is the manual review checklist for every P0 route at every
required viewport and theme combination.

## Screenshot Matrix

### Viewports

| Name | Width | Height | Purpose |
|---|---|---|---|
| sm-mobile | 360 | 740 | Smallest Android |
| mobile | 375 | 812 | Standard mobile |
| tablet | 768 | 1024 | iPad portrait |
| laptop | 1024 | 768 | Small laptop |
| desktop | 1280 | 800 | Standard desktop |
| wide | 1600 | 1000 | Wide work surface |

### Themes

- Light (default)
- Dark
- Reduced motion (for animated routes)

### Routes to review

- [ ] `/` — Dashboard
- [ ] `/compose` — Compose
- [ ] `/calendar` — Calendar
- [ ] `/inbox` — Inbox
- [ ] `/analytics` — Analytics
- [ ] `/settings` — Settings
- [ ] `/channels` — Channels
- [ ] `/campaigns` — Campaigns
- [ ] `/media` — Media library
- [ ] `/content` — Content library
- [ ] `/smart-pages` — Smart Pages
- [ ] `/auth/signin` — Sign in (public)

## Review Checklist (per route × viewport × theme)

### Layout
- [ ] No horizontal overflow
- [ ] Page header has clear hierarchy
- [ ] Primary action is obvious
- [ ] Secondary actions do not compete
- [ ] Cards align to the same grid
- [ ] Empty space feels intentional
- [ ] Mobile stacking order matches task priority
- [ ] Sticky elements do not cover content

### Typography
- [ ] Persian text is readable
- [ ] No cramped microcopy
- [ ] Line-height is comfortable
- [ ] Long labels truncate or wrap gracefully
- [ ] Mixed RTL/LTR content displays correctly
- [ ] Numbers align in tables and KPIs

### Color/Theme
- [ ] Light mode contrast is strong
- [ ] Dark mode is not muddy or neon
- [ ] Semantic colors are used correctly
- [ ] Provider colors do not dominate
- [ ] Disabled state is visible but not confused with inactive data
- [ ] Selected, hover, focus, and active states are distinct

### Interaction
- [ ] Tap targets are safe (≥44px at mobile)
- [ ] Focus ring is visible and consistent
- [ ] Hover states are subtle
- [ ] Disabled state has explanation where needed
- [ ] Destructive actions require confirmation
- [ ] Pending state prevents double submit

### Motion
- [ ] No unnecessary loop distracts from work
- [ ] Motion explains hierarchy or state
- [ ] Reduced motion still works
- [ ] Skeletons do not shimmer forever after loading
- [ ] Page transitions do not delay task flow

### Data Visualization
- [ ] Charts have clear baseline/axis/context
- [ ] Color meaning is consistent
- [ ] Legends do not wrap badly
- [ ] Empty/unsupported/partial data is honest
- [ ] No fake precision
- [ ] Source/freshness is visible where important

## Defect Filing

For every confirmed visual defect, create a GitHub issue with:

```md
## Visual defect

**Route/component:** /analytics
**Viewport:** 375px
**Theme:** dark
**Screenshot:** (attach)

### Problem
Chart legend overlaps with the X-axis labels.

### Expected
Legend should wrap to a second line, not overlap.

### Fix
Add `flex-wrap` to the legend container.

### Acceptance
- [ ] Before screenshot attached
- [ ] After screenshot attached
- [ ] Visual test added/updated
- [ ] Dark mode checked
- [ ] Mobile checked
```

## Known Exceptions

Document any intentional visual deviations here:

| Route | Viewport | Exception | Justification |
|---|---|---|---|
| (none yet) | | | |

## Sign-off

| Route | Reviewer | Date | Status |
|---|---|---|---|
| (pending) | | | |

---

*Generated from Issue #288 — part of the Visual 10/10 Execution Bible (#283).*
