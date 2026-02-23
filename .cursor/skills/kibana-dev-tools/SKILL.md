---
name: kibana-dev-tools
description: Use Kibana Dev Tools (Console) for Elasticsearch API calls
---

# Kibana Dev Tools (Console)

Use when the user wants to run Elasticsearch API requests from the browser (Console), test queries, or debug indices.

## 1. Prompt
- Clarify: what they want to run (e.g. search, index settings, reindex, _cat APIs) and which cluster.
- Use `kibana_info` to give the Dev Tools link: `/app/dev_tools#/console`.

## 2. Provision
- Ensure they have Kibana access and (if needed) ES_URL/ES_API_KEY or Cloud connection. Console uses the same credentials as Kibana.

## 3. Integrate
- Guide: open Dev Tools → Console, paste or write the request (e.g. GET index/_search, GET _cat/indices).
- For complex queries, you can generate the JSON body; they paste it into Console. Prefer ESQL or Search API tools in MCP when automation is needed.

## 4. Validate
- Confirm the request runs and the response is as expected. Suggest saving snippets in Kibana or in the project for repeated use.
