---
name: elastic-agent-setup
description: Configure Elastic Agent for log and metric collection
---

# Elastic Agent Setup

Use when the user wants to collect logs, metrics, or security data with Elastic Agent.

## 1. Prompt
- Identify OS (Linux, Windows, macOS) and data sources: files, metrics, network, security.
- Confirm they have an Elasticsearch cluster and Fleet (Kibana) or a standalone Elastic Agent policy.

## 2. Provision
- Ensure Fleet is enabled in Kibana (or they have an agent policy URL and enrollment key).
- Use cluster tools to verify connectivity; use Cloud tools if they need a project first.

## 3. Integrate
- Guide them to download and install Elastic Agent (packages or Docker).
- Enroll the agent: Fleet UI in Kibana, or `elastic-agent enroll --url=... --enrollment-token=...`.
- Add integrations (e.g. Logs, Metrics, Nginx, MySQL) from Fleet or policy YAML.

## 4. Validate
- Confirm agent shows as healthy in Fleet; check that data streams appear in Elasticsearch.
- Use `list_indices` or Kibana Index Management to see new indices from the agent.
