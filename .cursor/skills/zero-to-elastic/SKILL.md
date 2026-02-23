---
name: zero-to-elastic
description: Complete onboarding from no infrastructure to a working Elasticsearch-backed app
---

# Zero to Elastic

Use when the user has no Elastic infrastructure and wants to go from zero to a working app.

## 1. Prompt

- **Ask for deployment preference first**: "Do you prefer a **Cloud-based** solution (Elastic Cloud, managed, no servers to run) or **on-prem** (self-hosted with Docker: Elasticsearch, Kibana, Fleet server, APM server, Elastic Agent)?"
- Clarify primary use case: search, vectors, observability, or security.
- If they don’t have a preference, briefly compare: Cloud = no ops, fast start; on-prem = full control, Docker-based stack in this repo.

## 2. Provision

**If Cloud:**

- Use `create_cloud_project` (with ELASTIC_CLOUD_API_KEY set) with name and region_id (e.g. us-east-1); or guide them to sign up at cloud.elastic.co and create a deployment.
- Use `get_connection_config` to generate the client snippet for their language (node, python, java, go, dotnet).
- Use `create_project_api_key` if they need a scoped key (Serverless projects only).
- For **traditional (non-Serverless) deployments**: `create_project_api_key` does NOT work. Instead:
  - Reset the `elastic` password via Cloud API: `POST https://api.elastic-cloud.com/api/v1/deployments/{id}/elasticsearch/{ref_id}/_reset-password` with the `ELASTIC_CLOUD_API_KEY` header.
  - Find deployment ID with `GET https://api.elastic-cloud.com/api/v1/deployments` (look for the deployment by name or ES cluster ID in the URL alias).
  - Use `ref_id: "main-elasticsearch"` for the ES resource ref.

**If on-prem:**

- Use `get_deployment_guide` with `preference: "on_prem"` to return the step-by-step guide.
- Point them to `examples/on-prem-docker/`: run `docker compose up -d` to start Elasticsearch, Kibana, and APM server; optionally add Fleet server and Elastic Agent (see that README).
- Use `get_connection_config` with `url: "http://localhost:9200"` and their password or API key after the stack is up.

## 3. Integrate

- Add the Elasticsearch client to their app using the generated config.
- Create an index with `create_index`; index sample data with `index_document` or `bulk_index`.
- Run a first `search` or `esql_query` to validate connectivity.
- For APM (Cloud or on-prem): use `setup_apm` with the appropriate server URL (Cloud APM URL or on-prem http://localhost:8200).

### OTLP Native Intake (ES 9.x+)
- ES 9.x+ supports native OTLP at `/_otlp/v1/{metrics,traces,logs}` — no APM Server or OTel collector required.
- **Critical**: ES native OTLP only accepts `application/x-protobuf`. Use proto-based OTel exporters, not JSON/HTTP variants.
- When auto-detecting OTLP endpoints, skip local service detection (ports 4318, 8200) if `ES_URL` points to a remote/Cloud host — otherwise unrelated local services intercept traffic.

## 4. Validate

- Confirm `cluster_health` is green; run `list_indices` and a simple search.
- Point them to Kibana (Cloud URL from project, or on-prem http://localhost:5601) for exploration and dashboards.
