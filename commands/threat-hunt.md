---
name: threat-hunt
description: Proactive threat hunting with iterative ES|QL queries
argument-hint: "[MITRE technique, IOC, or behavioral pattern]"
---

# /elastic:threat-hunt

Guided threat hunting workflow.

## Workflow

1. Use the argument as the hunt hypothesis (MITRE technique, IOC, or behavioral pattern)
2. Call `discover_security_data` to identify which data sources are available for this hunt
3. Map hypothesis to data sources and fields
4. Build iterative ES|QL queries — start broad, narrow based on findings:
   - Call `esql_query` for each iteration
   - Present results and refine
5. For each significant finding:
   - Assess confidence (high/medium/low)
   - Ask whether to create a detection rule, open a case, or continue hunting
6. Operationalize findings: convert confirmed patterns into detection rules with `manage_detection_rules`
7. Summarize the hunt: hypothesis, data queried, findings, actions taken

## Examples

```
/elastic:threat-hunt T1059 Command and Scripting Interpreter
/elastic:threat-hunt malicious IP 203.0.113.42
/elastic:threat-hunt unusual admin account activity
/elastic:threat-hunt lateral movement from compromised host
```
