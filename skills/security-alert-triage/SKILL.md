---
name: security-alert-triage
description: Interactive workflow for investigating and triaging security alerts — from alert review through enrichment, investigation, and resolution.
---

# Security Alert Triage Workflow

Guide the user through investigating and resolving security alerts in their Elastic Security deployment.

## Trigger

Use when the user asks to:
- "Triage alerts"
- "Investigate alert"
- "Review security alerts"
- "Handle alerts"
- "Alert queue"
- "SOC triage"

Also activates on keywords: "alert triage", "alert investigation", "SOC workflow", "alert queue", "security alerts", "alert review"

Do NOT use when:
- "Set up security" (→ use `security-full-setup`)
- "Create detection rule" (→ use `security-detection-engineering`)

## Steps

### 0. Get Cluster Context
Call `get_cluster_context` to get cached cluster awareness — version, health, installed features, and alerting capabilities.

### 1. Review Open Alerts
Call `triage_alerts` with `operation: "list"` to get the current alert queue.

Present the alert overview:
- Total open alerts by severity (critical, high, medium, low)
- Top alerting rules with counts
- Time distribution (last 1h, 4h, 24h)

Ask the user which alerts to investigate:
- By severity (e.g., "all critical")
- By rule name
- By host or user
- Specific alert ID

### 2. Deep-Dive on Selected Alert
Call `triage_alerts` with `operation: "get"` and the alert ID to retrieve full alert details.

Present the alert context:
- Rule name, severity, risk score
- MITRE ATT&CK technique mapping
- Source event details (host, user, process, network)
- Timeline of related events
- Reason field (why the rule triggered)

### 3. Enrich the Investigation
Gather additional context around the alert:

**Host context:**
Call `esql_query` to find recent activity on the affected host:
```
FROM logs-endpoint* | WHERE host.name == "<host>" AND @timestamp >= NOW() - 1h | STATS count = COUNT(*) BY event.action | SORT count DESC | LIMIT 20
```

**User context:**
Call `esql_query` to find the user's recent authentication activity:
```
FROM logs-* | WHERE user.name == "<user>" AND event.category == "authentication" AND @timestamp >= NOW() - 24h | STATS count = COUNT(*) BY event.outcome, source.ip | SORT count DESC
```

**Process tree (for endpoint alerts):**
Call `elasticsearch_api` to query the process tree using `process.entity_id`.

Present the enrichment findings and highlight anomalies.

### 4. User Decision Point — Verdict
Ask the user for their assessment:
- **True Positive** — confirmed malicious activity, escalate
- **Benign True Positive** — expected behavior, create exception
- **False Positive** — rule needs tuning, create exception
- **Needs more investigation** — continue enrichment

### 5A. True Positive — Escalate
Call `manage_cases` with `operation: "create"` to create a case:
- Attach the alert to the case
- Set severity and assignee
- Add investigation notes

Call `triage_alerts` with `operation: "update_status"` to set the alert to `acknowledged`.

### 5B. Benign / False Positive — Create Exception
Call `kibana_api` with `POST /api/detection_engine/rules/<rule_id>/exceptions` to create an exception:
- Define exception conditions based on the benign pattern
- Choose exception scope (this rule only vs. all rules)

Call `triage_alerts` with `operation: "update_status"` to set the alert to `closed`.

### 5C. Needs More Investigation
Suggest additional investigative queries:
- Network connections from the source host
- File modifications around the alert time
- Lateral movement indicators
- Return to Step 3 with expanded scope

### 6. Summary
Present:
- Alerts triaged with verdicts
- Cases created (if any)
- Exceptions added (if any)
- Remaining open alerts
- Suggested next steps

## Tools Used
- `get_cluster_context` — cached cluster awareness (version, health, capabilities)
- `triage_alerts` — list, view, and update alert status
- `manage_cases` — create and manage investigation cases
- `esql_query` — run investigative queries for enrichment
- `elasticsearch_api` — deep queries for process trees, network activity
- `kibana_api` — create exceptions, manage rule configuration

## API References
- `elastic://docs/api/kibana` — Detection Engine, Alerting, and Exception APIs
- `elastic://docs/api/security` — Cases, Timeline, and Investigation APIs

## Prerequisites
- `ES_URL` and `ES_API_KEY` configured
- `KIBANA_URL` configured for alert and case management
- Active security alerts in the deployment

## Related Skills
- `security-case-management` — escalate triaged alerts into investigation cases
- `security-detection-engineering` — tune or create rules based on triage findings
