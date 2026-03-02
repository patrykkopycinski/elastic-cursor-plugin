---
name: create-detection-rule
description: Guided detection rule creation — from threat hypothesis to deployed rule
argument-hint: "[MITRE technique or threat description]"
---

# /elastic:create-detection-rule

Step-by-step detection rule authoring.

## Workflow

1. If the user provides a MITRE technique or threat description, use it as the starting hypothesis
2. Call `discover_security_data` to verify required data sources exist
3. Recommend a rule type (KQL, EQL, ES|QL, threshold, ML) based on the use case
4. Help draft the detection query — test it with `esql_query` or `elasticsearch_api`
5. Validate against real data: check for true positives and estimate false positive rate
6. Ask the user to confirm: rule name, severity, risk score, MITRE mapping, interval
7. Call `manage_detection_rules` with `operation: "create"` to deploy the rule
8. Monitor for initial results with `triage_alerts`

## Examples

```
/elastic:create-detection-rule T1059.001 PowerShell abuse
/elastic:create-detection-rule brute force SSH login
/elastic:create-detection-rule unusual outbound network connections
```
