---
name: o11y-full-setup
description: Interactive guide for complete Observability setup — discovers data, presents summary, creates dashboards and SLOs based on user approval.
---

# O11Y Full Setup Workflow

Guide the user through a complete Observability configuration for their Elastic deployment.

## Steps

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
For each approved dashboard, call `kibana_create_dashboard` with the recommended configuration.
Report each created dashboard with its URL.

### 5. User Decision Point — SLOs
Ask the user which recommended SLOs they want to create:
- Present each as a numbered option with service name, indicator type, and target
- Allow "all" or specific selections
- Allow the user to adjust targets before creation

### 6. Create SLOs
For each approved SLO, call `create_slo` with the recommended configuration.
Report each created SLO with its ID and URL.

### 7. Summary
Present a final summary:
- Total dashboards created with URLs
- Total SLOs created with IDs
- Any warnings or issues encountered
- Suggested next steps (set up alerts, add more services, etc.)

## Tools Used
- `discover_o11y_data`
- `get_data_summary`
- `kibana_create_dashboard`
- `create_slo`

## Prerequisites
- `ES_URL` and `ES_API_KEY` (or basic auth) configured
- `KIBANA_URL` and `KIBANA_API_KEY` (or basic auth) configured
- At least some O11Y data flowing into Elasticsearch
