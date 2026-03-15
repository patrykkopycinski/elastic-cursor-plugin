---
name: cluster-onboarding
description: Guide users from zero to a working Elastic cluster — Cloud or on-prem, connection config, first queries, and next steps.
---

# Cluster Onboarding

Help users go from nothing to a fully connected Elastic cluster in under 5 minutes.

## Trigger

Use when the user asks to:
- "Set up Elasticsearch"
- "Connect to my cluster"
- "Get started with Elastic"
- "Configure my connection"
- "First time using Elastic"

Also activates on keywords: "onboarding", "getting started", "new cluster", "connect to Elastic"

Do NOT use when:
- User already has a connected cluster and wants to query data (→ use tools directly)
- User wants to set up observability (→ `o11y-full-setup`)
- User wants to set up security (→ `security-full-setup`)

## Tools Used

- `get_deployment_guide` — Cloud vs on-prem setup instructions
- `get_connection_config` — Language-specific connection snippets
- `cloud_api` — Elastic Cloud project management
- `elasticsearch_api` — Verify cluster connectivity
- `esql_query` — First-query validation
- `get_cluster_context` — Cluster orientation after connection

## Workflow

### Step 0: Determine Deployment Preference
Ask once: "Do you prefer **Cloud** (managed, no servers) or **on-prem** (Docker)?"

### Step 1: Cloud Path
1. Call `get_deployment_guide` with `preference: "cloud"`
2. Help the user create a project via `cloud_api` with `POST /api/v1/serverless/projects/elasticsearch`
3. Generate an API key via `cloud_api`
4. Call `get_connection_config` for their preferred language

### Step 1 (alt): On-Prem Path
1. Call `get_deployment_guide` with `preference: "on_prem"`
2. Guide through `docker compose up -d` from the provided template
3. Call `get_connection_config` with `http://localhost:9200`

### Step 2: Verify Connection
Call `elasticsearch_api` with `GET /` to confirm the cluster is reachable.

### Step 3: First Query
Run `esql_query` with `SHOW INFO` to display cluster version and validate everything works.

### Step 4: Cluster Orientation
Call `get_cluster_context` to understand what's already in the cluster.

### Step 5: Next Steps
Based on the user's use case, suggest:
- **Search**: Index design, mappings, vector search
- **Observability**: `o11y-full-setup` skill
- **Security**: `security-full-setup` skill
- **Data exploration**: `discover_data` tool

## Output Format

- Present setup as numbered steps with copy-paste code blocks
- Include connection config in the user's preferred language
- Show the cluster response as confirmation
- End with 3-4 recommended next steps

## Prerequisites

- Internet access (for Cloud path) or Docker installed (for on-prem path)
- No existing Elastic configuration required — this is the zero-to-connected workflow

## Related Skills

- `o11y-full-setup` — After onboarding, set up monitoring
- `security-full-setup` — After onboarding, set up security
- `agent-builder-skill-builder` — Build custom tools on top of the cluster
