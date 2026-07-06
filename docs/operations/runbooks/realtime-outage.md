# Runbook: realtime-outage

## Severity
See [ALERT_RULES.md](../ALERT_RULES.md) for severity classification.

## Symptoms
- Alert: realtime-outage
- User impact: (varies by incident)

## Diagnosis
1. Check service health: `curl /api/readyz`
2. Check metrics dashboard for anomalies
3. Check logs: `journalctl -u nashrino-* --since "10 min ago" | grep ERROR`

## Safe Actions
1. (Service-specific safe actions — see alert annotation)

## Rollback/Replay
- Rollback: `docker compose up -d --no-deps app worker realtime`
- Replay dead-letter: `POST /api/outbox/[id]/replay`

## User Communication
- Template: "We are investigating an issue with [service]. Some publications may be delayed."

## Post-Incident
- File blameless postmortem within 48 hours
- Update this runbook with lessons learned
