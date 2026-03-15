---
name: o11y-setup
description: Set up observability monitoring — discover data, create dashboards, configure SLOs and alerts.
argument-hint: "[service-name]"
---

# Observability Setup

Set up full observability monitoring for your Elastic cluster.

## Steps

1. Call `get_cluster_context` for cluster orientation
2. Call `discover_o11y_data` to find APM services, metrics, and log sources
3. Call `get_data_summary` for dashboard and SLO recommendations
4. If no APM data exists, offer to set up instrumentation with `setup_apm`
5. If no log data exists, offer to configure log shipping with `setup_log_shipping`
6. Create service dashboards with `create_dashboard` for discovered services
7. Offer to configure SLOs via `kibana_api` for key services
8. Offer to create alert rules with `create_alert_rule` for critical thresholds
9. Summarize everything that was configured

## Examples

- `/elastic:o11y-setup` — Full observability setup
- `/elastic:o11y-setup payment-service` — Focus on a specific service
