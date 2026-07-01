# Dashboards

## Dashboard Definitions

Grafana dashboard JSON files are in `docs/operations/dashboards/`.

## Available Dashboards
1. **Service Health** — executive overview of all services
2. **Publishing Funnel** — acceptance → queue → worker → provider → success/failure
3. **Schedule Latency** — scheduled time vs actual dispatch
4. **Outbox/Queue/Worker** — outbox age, queue depth, worker utilization
5. **Retries & Unknown Outcomes** — retry rate, unknown outcome count, duplicates
6. **Credentials & Channel Health** — token expiry, scope validation, failure rate
7. **API/Database/Redis** — latency, connections, memory, CPU
8. **Realtime Connections** — socket count, event delivery, reconnect rate
9. **Frontend Web Vitals** — LCP, INP, CLS by route and device
10. **Release Comparison** — metrics comparison by SHA
