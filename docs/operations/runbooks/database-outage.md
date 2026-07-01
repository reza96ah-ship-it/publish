# Runbook: database-outage

## Severity
See [ALERT_RULES.md](../ALERT_RULES.md) for severity classification.

## Symptoms
- (To be filled based on actual incident patterns)

## Diagnosis
1. Check service health: `curl /api/readyz`
2. Check logs for errors: `journalctl -u nashrino-* --since "10 min ago"`
3. Check metrics dashboard for anomalies

## Safe Actions
1. (Service-specific safe actions)

## Rollback/Replay
- (Conditions and commands for rollback)

## User Communication
- Template: "We are investigating an issue with [service]. Some [feature] may be temporarily unavailable."

## Post-Incident
- File blameless postmortem within 48 hours
- Update this runbook with lessons learned
