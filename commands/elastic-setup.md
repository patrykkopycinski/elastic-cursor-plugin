---
name: elastic-setup
description: Guided first-time Elastic setup — Cloud or on-prem, connection config, first query.
argument-hint: "[cloud|on-prem]"
---

# Elastic Setup

Set up Elastic from scratch with a guided workflow.

## Steps

1. Ask the user's preference (or use the argument): Cloud (managed) or on-prem (Docker)?
2. **Cloud path**: Use `get_deployment_guide` with `preference: cloud`, then help configure `cloud_api` credentials
3. **On-prem path**: Use `get_deployment_guide` with `preference: on_prem`, guide through Docker Compose setup
4. Generate connection config using `get_connection_config` for the user's language (Node, Python, Go, Java, etc.)
5. Verify the connection: Use `elasticsearch_api` to call `GET /` and confirm the cluster responds
6. Run a first query: Use `esql_query` with `SHOW INFO` to display cluster version
7. Summarize the setup and suggest next steps (discover data, set up observability, configure security)

## Examples

```
/elastic:setup cloud
/elastic:setup on-prem
/elastic:setup
```
