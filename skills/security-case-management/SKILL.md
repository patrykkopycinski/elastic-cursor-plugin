---
name: security-case-management
description: Guide for creating and managing security investigation cases — from case creation through alert attachment, investigation tracking, and resolution.
---

# Security Case Management Workflow

Guide the user through Elastic Security case management for tracking investigations.

## Steps

### 1. Assess Current Cases
Call `manage_cases` with `operation: "list"` to get the existing case queue.

Present:
- Open cases by status (open, in-progress, closed)
- Cases by severity
- Recently updated cases
- Unassigned cases

### 2. Create or Select a Case
If creating a new case, ask the user for:
- Case title (suggest based on investigation context)
- Description (what triggered the investigation)
- Severity: low, medium, high, critical
- Tags (e.g., incident type, affected system)
- Assignee (optional)

Call `manage_cases` with `operation: "create"` and the provided details.

If continuing an existing case, call `manage_cases` with `operation: "get"` and the case ID.

### 3. Attach Alerts to Case
Call `triage_alerts` with `operation: "list"` and relevant filters to find alerts related to this investigation.

Present matching alerts and ask which to attach.

Call `manage_cases` with `operation: "add_comment"` to attach alert references, or use `kibana_api` with `POST /api/cases/<case_id>/comments` to attach alert objects directly:
```json
{
  "type": "alert",
  "alertId": "<alert_id>",
  "index": ".alerts-security.alerts-default",
  "rule": { "id": "<rule_id>", "name": "<rule_name>" }
}
```

### 4. Document Investigation Progress
Help the user add investigation notes:
- Findings from alert triage
- Enrichment results (host activity, user behavior)
- IOCs identified (IPs, hashes, domains)
- Containment actions taken

Call `manage_cases` with `operation: "add_comment"` for each note.

### 5. User Decision Point — Case Resolution
When the investigation is complete, ask the user:
- **Close as resolved** — threat confirmed and remediated
- **Close as duplicate** — merged with another case
- **Close as false positive** — no actual threat
- **Escalate** — requires additional response

### 6. Close the Case
Call `manage_cases` with `operation: "update_status"` to close the case with the appropriate status.

If closing, add a final comment summarizing:
- Root cause
- Impact assessment
- Remediation steps taken
- Lessons learned / follow-up actions

### 7. Summary
Present:
- Case ID and final status
- Alerts attached and their disposition
- Investigation timeline
- Recommended follow-ups (new detection rules, process improvements)

## Tools Used
- `manage_cases` — create, list, update, and close security cases
- `triage_alerts` — find and manage alerts for case attachment
- `kibana_api` — attach alerts to cases (`POST /api/cases/<id>/comments`), advanced case operations
- `esql_query` — investigative queries for case evidence

## API References
- `elastic://docs/api/security` — Cases API reference
- `elastic://docs/api/kibana` — Kibana alerting and detection engine APIs

## Prerequisites
- `ES_URL` and `ES_API_KEY` configured
- `KIBANA_URL` configured for case management
- Cases feature enabled in Elastic Security
