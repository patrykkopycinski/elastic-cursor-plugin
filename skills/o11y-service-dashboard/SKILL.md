---
name: o11y-service-dashboard
description: Interactive guide for creating an APM service overview dashboard — discovers service data, presents metrics, and creates a tailored dashboard.
---

# O11Y Service Dashboard Workflow

Guide the user through creating a comprehensive dashboard for a specific APM service.

## Trigger

Use when the user asks to:
- "Create service dashboard"
- "APM dashboard"
- "Service overview"
- "Monitor service"
- "Dashboard for my service"

Also activates on keywords: "service dashboard", "APM overview", "service monitoring", "application dashboard", "service metrics"

Do NOT use when:
- "Create SLO" (→ use `o11y-slo-setup`)
- "Full monitoring setup" (→ use `o11y-full-setup`)

## Steps

### 0. Get Cluster Context
Call `get_cluster_context` to get cached cluster awareness — version, health, installed features, and APM capabilities. This confirms APM data is available.

### 1. Identify Target Service
If the user hasn't specified a service name, call `discover_o11y_data` to find available APM services.

Present the list of discovered services:
- Service name, environment, language
- Throughput and data freshness

Ask the user which service they want to dashboard.

### 2. Discover Service Data
Call `discover_o11y_data` with `service_names: ["<selected_service>"]` to get detailed data for the target service.

### 3. Generate Service Summary
Call `get_data_summary` with the scoped discovery result.

Present the service profile:
- Transaction types and throughput
- Error rate
- Available metrics
- Suggested dashboard panels

### 4. User Decision Point — Dashboard Configuration
Ask the user:
- Dashboard title (suggest: "<Service Name> - Service Overview")
- Time range (suggest: last 24 hours)
- Any additional panels or customizations
- Whether to include related infrastructure or log panels (if data exists)

### 5. Create Dashboard
Call `kibana_api` with `POST /api/dashboards/dashboard` and the service-overview template configuration populated with the service data as the request body.

**Alternative:** Use `create_dashboard` for a higher-level approach — it generates service-overview panels automatically from the discovered data, reducing the need to manually compose panel configurations.

### 6. Report
Present:
- Dashboard URL (clickable link)
- List of panels created
- Suggested follow-ups: create an SLO, set up alerts, add to a composite dashboard

## Tools Used
- `get_cluster_context` — cached cluster awareness (version, health, capabilities)
- `discover_o11y_data` — discover APM services and their data
- `get_data_summary` — generate service profile and panel suggestions
- `create_dashboard` — high-level dashboard creation from discovered data
- `kibana_api` — create the dashboard (`POST /api/dashboards/dashboard`)

## API References
- `elastic://docs/api/kibana` — Kibana REST API reference for dashboard endpoints

## Prerequisites
- `ES_URL` and `ES_API_KEY` configured
- APM data for at least one service

## Related Skills
- `o11y-full-setup` — complete observability setup including dashboards and SLOs
- `o11y-slo-setup` — create SLOs to complement service dashboards
