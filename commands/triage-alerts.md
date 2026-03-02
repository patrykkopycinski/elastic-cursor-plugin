---
name: triage-alerts
description: Triage open security alerts — review, investigate, and resolve
argument-hint: "[severity or rule name filter]"
---

# /elastic:triage-alerts

Interactive alert triage workflow.

## Workflow

1. Call `triage_alerts` with `operation: "summary"` to get the current alert landscape
2. Present the overview: total open alerts by severity, top rules, top hosts
3. Ask the user which alerts to investigate (by severity, rule, or specific ID)
4. For each selected alert, call `triage_alerts` with `operation: "get"` for full details
5. Enrich with `esql_query` — recent host activity, user authentication history
6. Ask for a verdict: true positive (escalate), false positive (exception), or needs investigation
7. Act on the verdict: update alert status, create a case, or add an exception

If the user provides an argument, use it as a severity or rule name filter.

## Examples

```
/elastic:triage-alerts
/elastic:triage-alerts critical
/elastic:triage-alerts "Suspicious PowerShell"
```
