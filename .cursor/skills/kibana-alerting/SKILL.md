---
name: kibana-alerting
description: Configure Kibana alerting and rules (stack rules, connector types)
---

# Kibana Alerting

Use when the user wants to create or manage alerting rules in Kibana (threshold, anomaly, or other rule types) and connectors.

## 1. Prompt
- Clarify: rule type (threshold, anomaly, etc.), data source (index, ML job, observability), and actions (email, webhook, Slack, etc.).
- Observability: use `create_alert_rule` and related tools when the rule is APM/logs/metrics-based. For generic stack rules, guide through Kibana.

## 2. Provision
- Ensure connectors exist (Stack Management → Connectors): email, webhook, Slack, etc. Create a connector first if needed.
- Use `kibana_info` for Stack Management; rules are under Stack Management → Rules and Connectors (or Alerts in older UIs).

## 3. Integrate
- Guide: create a rule, select rule type and schedule, define condition (query, threshold, or ML), add actions. Test the rule and enable.
- For APM/logs/metrics alerts, prefer the observability `create_alert_rule` tool when it fits the use case.

## 4. Validate
- Confirm the rule is enabled and runs on schedule; suggest checking rule run history and connector logs if actions don’t fire.
