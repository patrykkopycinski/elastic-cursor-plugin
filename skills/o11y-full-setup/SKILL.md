---
name: o11y-full-setup
description: Interactive guide for complete Observability setup — discovers data, presents summary, creates dashboards and SLOs based on user approval.
---

# O11Y Full Setup Workflow

Guide the user through a complete Observability configuration for their Elastic deployment.

> **This is the umbrella skill.** For focused tasks, see the related skills: `o11y-slo-setup` for SLO creation, `o11y-service-dashboard` for individual service dashboards.

## Trigger

Use when the user asks to:
- "Set up observability"
- "Configure O11Y"
- "Observability onboarding"
- "Monitor my services"
- "Full monitoring setup"

Also activates on keywords: "observability setup", "O11Y onboarding", "monitoring setup", "full observability", "end-to-end monitoring"

Do NOT use when:
- "Create SLO" only (→ use `o11y-slo-setup`)
- "Create dashboard" only (→ use `o11y-service-dashboard`)

## Steps

### 0. Get Cluster Context
Call `get_cluster_context` to get cached cluster awareness — version, health, installed features, and observability capabilities. This determines what's already configured and what needs setup.

### 1. Discover Data
Call `discover_o11y_data` with no filters to get a complete picture of available data.

Present the results to the user as a summary:
- How many APM services were found
- How many hosts/containers are sending metrics
- How many log sources exist
- Data freshness status

### 2. Generate Summary with Recommendations
Call `get_data_summary` with the discovery results and `format: "json"`.

Present the recommendations to the user:
- "I found N dashboardable services and M SLO candidates"
- List each recommended dashboard with its type and what it covers
- List each recommended SLO with its indicator type and target

### 3. User Decision Point — Dashboards
Ask the user which recommended dashboards they want to create:
- Present each as a numbered option
- Allow "all" or specific selections
- Allow the user to customize titles or skip entirely

### 4. Create Dashboards
For each approved dashboard, call `kibana_api` with `POST /api/dashboards/dashboard` and the recommended configuration as the request body.
Report each created dashboard with its URL.

### 5. User Decision Point — SLOs
Ask the user which recommended SLOs they want to create:
- Present each as a numbered option with service name, indicator type, and target
- Allow "all" or specific selections
- Allow the user to adjust targets before creation

### 6. Create SLOs
For each approved SLO, call `kibana_api` with `POST /api/observability/slos` and the configured parameters as the request body.
Report each created SLO with its ID and URL.

### 7. Summary
Present a final summary:
- Total dashboards created with URLs
- Total SLOs created with IDs
- APM instrumentation status
- Log shipping status
- Alert rules configured
- Any warnings or issues encountered
- Suggested next steps (add more services, configure additional alert rules, etc.)

### 8. Set Up Application Instrumentation (Optional)
If APM data is missing or the user wants to add new services, call `setup_apm` to guide application instrumentation:
- Language-specific agent installation
- Configuration for connecting to the Elastic APM server
- Verification that data is flowing

### 9. Set Up Log Shipping (Optional)
If log data is missing or incomplete, call `setup_log_shipping` to configure log ingestion:
- Identify log sources (application logs, system logs, container logs)
- Configure Elastic Agent or Filebeat
- Set up log parsing and field extraction

### 10. Create Alert Rules (Optional)
After dashboards and SLOs are created, offer to set up alerting using `create_alert_rule`:
- Latency threshold alerts for critical services
- Error rate spike alerts
- SLO burn rate alerts
- Infrastructure health alerts (CPU, memory, disk)

## Tools Used
- `get_cluster_context` — cached cluster awareness (version, health, capabilities)
- `discover_o11y_data` — discover available O11Y data
- `get_data_summary` — generate summary with recommendations
- `setup_apm` — guide application instrumentation setup
- `setup_log_shipping` — configure log ingestion
- `create_alert_rule` — create alert rules for services and infrastructure
- `create_dashboard` — high-level dashboard creation from discovered data
- `kibana_api` — create dashboards (`POST /api/dashboards/dashboard`) and SLOs (`POST /api/observability/slos`)

## API References
- `elastic://docs/api/kibana` — Kibana REST API reference for dashboard and SLO endpoints

## Prerequisites
- `ES_URL` and `ES_API_KEY` (or basic auth) configured
- At least some O11Y data flowing into Elasticsearch

## Related Skills
- `o11y-slo-setup` — focused SLO creation workflow
- `o11y-service-dashboard` — focused service dashboard creation
