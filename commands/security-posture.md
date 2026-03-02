---
name: security-posture
description: Run a full security posture assessment — discover data, analyze coverage, and get recommendations
argument-hint: "[time range, e.g. 24h or 7d]"
---

# /elastic:security-posture

Run a comprehensive Elastic Security posture assessment.

## Workflow

1. Call `discover_security_data` to scan all security data sources, detection rules, and alert volumes
2. Call `get_security_summary` with the discovery results to generate a posture assessment
3. Present findings to the user:
   - Data source health (active, stale, missing)
   - Detection rule coverage (enabled vs disabled, by type and severity)
   - MITRE ATT&CK coverage (N/14 tactics)
   - Open alert summary
   - Coverage gaps
   - Prioritized recommendations

If the user provides a time range argument, use it as `time_range_from` (e.g., "7d" → "now-7d").

## Examples

```
/elastic:security-posture
/elastic:security-posture 7d
/elastic:security-posture 30d
```
