---
name: security-detection-engineering
description: Guide for authoring custom detection rules — from threat hypothesis through rule creation, testing, and tuning with KQL, EQL, ES|QL, and threshold rules.
---

# Security Detection Engineering Workflow

Guide the user through creating custom detection rules tailored to their environment.

## Steps

### 1. Understand the Threat
Ask the user what they want to detect:
- Specific MITRE ATT&CK technique (e.g., T1059 Command and Scripting Interpreter)
- Behavioral pattern (e.g., brute force login, data exfiltration)
- Compliance requirement (e.g., unauthorized admin access)
- Custom use case

### 2. Assess Available Data
Call `discover_security_data` with relevant `data_sources` filter to confirm the required data exists.

Present:
- Which data sources are available for this detection
- Field availability (e.g., process.name, event.action, source.ip)
- Data volume to estimate rule performance impact

### 3. Choose Rule Type
Based on the use case, recommend the appropriate rule type:
- **KQL query** — simple field matching and boolean logic; best for log-based detections
- **EQL sequence** — ordered event correlation; best for multi-step attack patterns
- **ES|QL** — aggregation-based analytics; best for statistical anomalies
- **Threshold** — count-based alerting; best for brute force and volumetric detections
- **Machine Learning** — anomaly detection; best for behavioral baselines

Explain the trade-offs and let the user confirm.

### 4. Draft the Detection Query
Help the user write the detection query:

**For KQL:**
Test with `esql_query` using a translated query, or use `elasticsearch_api` to run the KQL against the target index.

**For EQL:**
```
sequence by host.name with maxspan=5m
  [process where event.action == "start" and process.name == "powershell.exe"]
  [network where destination.port == 443]
```

**For ES|QL:**
Test with `esql_query`:
```
FROM logs-endpoint* | WHERE event.action == "start" AND process.name == "powershell.exe" | STATS count = COUNT(*) BY host.name | WHERE count > 10
```

**For Threshold:**
Define the field to aggregate, the threshold value, and the group-by fields.

### 5. Validate the Query
Run the query against real data using `elasticsearch_api` or `esql_query`:
- Confirm it matches expected events (true positives)
- Check for excessive matches (false positives)
- Verify the time range and performance

Present results and iterate if needed.

### 6. User Decision Point — Rule Configuration
Ask the user to confirm or adjust:
- Rule name (suggest based on MITRE technique or use case)
- Severity: low, medium, high, critical
- Risk score: 0–100
- MITRE ATT&CK mapping (tactic + technique)
- Run interval (suggest 5m for most rules)
- Index patterns to target
- Whether to enable immediately

### 7. Create the Detection Rule
Call `manage_detection_rules` with `operation: "create"` and the full rule configuration.

### 8. Test the Rule
After creation, monitor for initial alerts:
- Call `triage_alerts` to check for new alerts from this rule
- If too many false positives, suggest exception creation
- If no matches, verify the query and data availability

### 9. Tune the Rule (Optional)
If tuning is needed:
- Create exceptions via `kibana_api` with `POST /api/detection_engine/rules/<id>/exceptions`
- Adjust the query to exclude known benign patterns
- Modify severity or risk score based on observed signal quality

### 10. Summary
Present:
- Rule created with ID and name
- MITRE mapping
- Expected detection coverage
- Tuning recommendations
- Suggested companion rules for broader coverage

## Tools Used
- `discover_security_data` — verify data source availability
- `manage_detection_rules` — create and manage detection rules
- `triage_alerts` — check for alerts from the new rule
- `elasticsearch_api` — test KQL/EQL queries against real data
- `esql_query` — test ES|QL detection queries
- `kibana_api` — advanced rule management and exception creation

## API References
- `elastic://docs/api/kibana` — Detection Engine API for rules, exceptions
- `elastic://docs/api/security` — Security API reference

## Prerequisites
- `ES_URL` and `ES_API_KEY` configured
- `KIBANA_URL` configured for rule management
- Security data sources producing relevant events
