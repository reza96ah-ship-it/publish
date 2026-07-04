# Bundle Report

**Generated:** 2026-06-27
**Method:** `ANALYZE=true bun run build` + build output analysis

## Route-level bundle sizes (First Load JS)

All routes share the same layout (AppShell + Sidebar + CommandBar), so the First Load JS is consistent:

| Route           | First Load JS | Notes                                                        |
| --------------- | ------------- | ------------------------------------------------------------ |
| `/` (dashboard) | ~350 KB       | Dashboard panels (OperationalSummary, PublishingPulse, etc.) |
| `/compose`      | ~350 KB       | Tiptap editor loaded on-demand (React.lazy)                  |
| `/calendar`     | ~350 KB       | dnd-kit loaded on-demand (React.lazy)                        |
| `/analytics`    | ~350 KB       | Recharts loaded on-demand (React.lazy)                       |
| `/content`      | ~350 KB       | Content table                                                |
| `/inbox`        | ~350 KB       | Inbox list                                                   |
| `/channels`     | ~350 KB       | Platform cards                                               |
| `/media`        | ~350 KB       | Media grid                                                   |
| `/campaigns`    | ~350 KB       | Campaign list                                                |
| `/settings`     | ~350 KB       | Settings form                                                |

## Optimization status

### Done (Phase 10 + Sprint A)

- ✅ `React.lazy` + `Suspense` for all 9 views (Sprint A)
- ✅ Route-level code splitting (each view is a separate page.tsx)
- ✅ Tiptap, Recharts, dnd-kit loaded on-demand (not in initial bundle)
- ✅ Removed `@mdxeditor/editor` (Quick Win #50)
- ✅ `@next/bundle-analyzer` installed with `ANALYZE=true bun run build`

### Performance budget (target)

- Main bundle: < 350 KB gzipped (currently ~350 KB — at target)
- Per-view chunk: < 50 KB (achieved via React.lazy)
- Lighthouse Performance: ≥ 90 (to be measured)

### Web Vitals tracking

- `POST /api/vitals` — receives LCP/INP/CLS/FCP/TTFB from browser
- `WebVitals` component in `(dashboard)/layout.tsx` — auto-reports
- INP optimization: `scheduler.yield()` polyfill in `src/lib/yield.ts`

## How to run analysis

```bash
bun run analyze
```

This runs `ANALYZE=true bun run build` which generates `.next/analyze/` with
interactive treemap visualizations of the bundle.
