# RUM Dashboard — current instrumentation + route/device segmentation plan

> Real-user-monitoring (RUM) data we collect today, what's missing, and the
> plan to close the gaps. Used as visual evidence in the Q3 review.

Issues: #300 (visual maturity), #304 (RUM dashboard).

## 1. Current instrumentation

Nashrino ships a minimal RUM layer via two paths:

### 1.1 Client-side web vitals
File: `src/components/providers/web-vitals.tsx`

Reports the standard Core Web Vitals (LCP, FID/INP, CLS, FCP, TTFB) plus
Nashrino-specific custom metrics:

| Metric              | What it measures                                  | Sample rate |
| ------------------- | ------------------------------------------------- | ----------- |
| `LCP`               | Largest Contentful Paint                          | 100%        |
| `INP`               | Interaction to Next Paint (replaces FID)          | 100%        |
| `CLS`               | Cumulative Layout Shift                           | 100%        |
| `FCP`               | First Contentful Paint                            | 100%        |
| `TTFB`              | Time to First Byte                                | 100%        |
| `nsh.stream.firstChunk` | SSE first-chunk latency for /api/ai/caption   | 100%        |
| `nsh.publish.attempt` | Time from "publish" click to provider 200       | 100%        |

Sink: Sentry (`@sentry/nextjs`, see `sentry.client.config.ts`). Each event
includes `workspace_id`, `route` (Next.js pathname), `device_type`
(`mobile` / `tablet` / `desktop` derived from `useMediaQuery`), and
`connection_type` (Network Information API, where available).

### 1.2 Server-side route latency
File: `src/lib/tracing.ts`

Every API route is wrapped by `withTracing()` (OpenTelemetry). Spans are
exported to the OTLP HTTP exporter with:
- `http.route` (Next.js route pattern, e.g. `/api/customers/[id]`)
- `http.method`
- `http.status_code`
- `workspace.id`
- `db.query_count` (per-request Prisma query counter)

## 2. Gaps in current instrumentation

### 2.1 Route segmentation
Today, RUM events tag `route` with the *literal* pathname (`/api/customers/clxxxx`),
not the *pattern* (`/api/customers/[id]`). This makes per-route aggregation
noisy — each customer ID is treated as a separate route.

**Plan:** add a `routePattern` tag computed once at request start, using
the route matcher from `next.config.ts`. Ship in Q3 week 4.

### 2.2 Device segmentation
`device_type` is derived from `useMediaQuery` on the client, which:
- Doesn't run for SSR'd routes (no event until hydration)
- Misclassifies large tablets as desktop

**Plan:** replace with `navigator.userAgent` + UA-CH (User-Agent Client
Hints) on the client, and fall back to a server-side UA parse for SSR'd
pages. Add a `device.form_factor` dimension (`phone` / `tablet` / `laptop`
/ `desktop`). Ship in Q3 week 5.

### 2.3 Connection segmentation
`connection_type` is set from `navigator.connection.effectiveType` when
available. This is missing on Safari and Firefox.

**Plan:** add a `connection.downlink` RTT estimate via a 1×1 pixel fetch
on idle. Ship in Q3 week 5.

### 2.4 Persian-RTL-specific metrics
No metric today captures:
- Layout shift caused by RTL font swap (Vazirmatn → Vazirmatn-Bold on weight change)
- INP regression on Persian keyboard autocomplete

**Plan:** add `nsh.rtl.fontSwap` (CLS attributable to font-load) and
`nsh.rtl.inp` (INP for inputs with `dir="rtl"`). Ship in Q3 week 6.

## 3. Dashboard plan (Q3)

### 3.1 SLO dashboard
A single Grafana dashboard with 4 panels:

1. **P75 / P95 LCP by route pattern** — line chart, 7-day window
2. **P75 / P95 INP by device form factor** — stacked area
3. **CLS by route pattern** — table, red threshold > 0.1
4. **TTFB by connection type** — bar chart

### 3.2 Alerting rules
Defined in `docs/operations/alerts/alerts.yml`:

| Alert                | Condition                          | Severity |
| -------------------- | ---------------------------------- | -------- |
| `HighLCP`            | P75 LCP > 2500ms for 5 min         | warning  |
| `CriticalLCP`        | P75 LCP > 4000ms for 5 min         | critical |
| `HighINP`            | P75 INP > 200ms for 5 min          | warning  |
| `HighCLS`            | P75 CLS > 0.1 for 10 min           | warning  |
| `StreamFirstChunkSlow` | P75 `nsh.stream.firstChunk` > 3000ms | warning |

### 3.3 Per-route drilldown
Each route's detail page will show:
- P50/P75/P95/P99 for each web vital (7-day window)
- Device breakdown (phone/tablet/laptop/desktop)
- Connection breakdown (4G/3G/slow-2G)
- Top 5 slowest user sessions (anonymized)

## 4. Privacy

RUM data is **anonymized at the edge**:
- IP addresses are truncated to /24 (IPv4) or /48 (IPv6) before being
  sent to Sentry.
- User IDs are NOT included in RUM events — only `workspace.id` (which
  is necessary for per-customer SLO breakdowns).
- Custom metrics that could leak content (e.g. caption text) are
  explicitly NOT collected.

See `docs/security/ASVS_ASSESSMENT.md` §7 for the full privacy review.

## 5. Open questions

- Should we sample at <100% once daily volume exceeds 1M events? Current
  cost is ~$X/month at 100%; threshold for review is $Y/month.
- Can we get per-route INP from the worker (publish-worker mini-service)?
  Today we only get it for the Next.js app.
