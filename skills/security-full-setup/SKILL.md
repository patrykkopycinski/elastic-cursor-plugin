---
name: security-full-setup
description: Interactive guide for complete Elastic Security setup — discovers data sources, assesses detection coverage, configures rules, and creates security dashboards.
---

# Security Full Setup Workflow

Guide the user through a complete Elastic Security configuration for their deployment.

## Steps

### 1. Discover Security Data
Call `discover_security_data` with no filters to get a complete picture of available security data.

Present the results to the user as a summary:
- How many data sources were found and their categories (endpoint, audit, windows, network, cloud)
- Data freshness status for each source
- Current detection rule coverage (total, enabled, disabled)
- Open alert volume and severity breakdown

### 2. Generate Security Summary
Call `get_security_summary` with the discovery results.

Present the posture assessment:
- Overall health rating
- Detection coverage percentage
- MITRE ATT&CK tactic coverage (N/14 tactics)
- Coverage gaps identified
- Recommended actions

### 3. User Decision Point — Detection Rules
Based on the gaps identified, ask the user which areas to improve:
- Present uncovered MITRE tactics as numbered options
- Suggest enabling disabled high-severity rules
- Offer to enable prebuilt rule packages by category (endpoint, cloud, network, etc.)
- Allow "all recommended" or specific selections

### 4. Enable Detection Rules
For each approved rule category, call `manage_detection_rules` with `operation: "bulk_enable"` and the appropriate filters.

Report results:
- Number of rules enabled per category
- Any rules that failed to enable (permission issues, missing dependencies)

### 5. User Decision Point — Alert Rules
Ask the user if they want threshold-based alerting on security metrics:
- High-severity alert volume spike
- New critical detection rule matches
- Data source health degradation (stale data)

### 6. Create Alert Rules
For each approved alert, call `kibana_api` with `POST /api/alerting/rule` and the configured parameters.

### 7. User Decision Point — Dashboard
Ask the user if they want a security overview dashboard:
- SOC Overview (alert volume, severity trends, top rules)
- MITRE ATT&CK Coverage Map
- Data Source Health
- Custom combination

### 8. Create Dashboard
Call `kibana_api` with `POST /api/dashboards/dashboard` and the selected dashboard configuration.

### 9. Summary
Present a final summary:
- Data sources discovered with freshness status
- Detection rules enabled (before → after)
- MITRE coverage improvement
- Dashboards created with URLs
- Alert rules configured
- Suggested next steps (deploy Elastic Defend, add cloud integrations, configure cases)

## Tools Used
- `discover_security_data` — discover security data sources, rules, and alerts
- `get_security_summary` — generate posture assessment with gaps and recommendations
- `manage_detection_rules` — enable/disable detection rules in bulk
- `kibana_api` — create dashboards (`POST /api/dashboards/dashboard`), alert rules (`POST /api/alerting/rule`), and query rules (`GET /api/detection_engine/rules/_find`)

## API References
- `elastic://docs/api/kibana` — Kibana REST API reference for security, dashboard, and alerting endpoints
- `elastic://docs/api/security` — Security-specific API reference for cases, exceptions, and timelines

## Prerequisites
- `ES_URL` and `ES_API_KEY` (or basic auth) configured
- `KIBANA_URL` configured for detection rule and dashboard management
- At least some security data flowing into Elasticsearch (Elastic Defend, Auditbeat, cloud logs, etc.)
