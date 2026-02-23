---
name: elastic-workflows
description: Build automation and workflows with alerting, ingest pipelines, security, and Agent Builder
---

# Elastic Workflows

Use this skill when the user wants to set up automation or workflows on Elastic: alerting, ingest pipelines, security detection/response, or orchestration with Agent Builder.

## 1. Prompt

- Identify workflow type: alerting (rules + connectors), ingest (enrich then index), security (detect → alert → triage), or Agent Builder–driven (custom tools/agents).
- Confirm they have Kibana (and, for Agent Builder, access to Agent Builder and optionally its MCP endpoint).

## 2. Provision

- **Alerting**: Use `create_alert_rule` and `list_alert_rules` (Observability). In Kibana, add connectors and attach to rules.
- **Ingest**: Use `create_ingest_pipeline` and `list_ingest_pipelines`; index with the pipeline to run the workflow on each document.
- **Security**: Use `siem_quickstart`, then `create_detection_rule`, `list_detection_rules`, `enable_detection_rules`, `get_security_alerts`, `update_alert_status`, `add_rule_exception`.
- **Agent Builder**: Use `create_agent_builder_tool`, `list_agent_builder_tools`, `test_agent_builder_tool`, and `get_agent_builder_mcp_config` to define tools and connect the IDE to Agent Builder MCP.

## 3. Integrate

- Combine building blocks: e.g. ingest pipeline → enriched index → search/alert; or detection rule → connector → Slack/index; or Agent Builder agent calling Elasticsearch and external APIs.
- For handoff to Agent Builder, use `get_agent_builder_mcp_config` and add the config to Cursor/Claude so workflows can use custom Agent Builder tools.

## 4. Validate

- For alerting: trigger the rule and confirm the connector runs.
- For ingest: index a sample doc with the pipeline and verify the result.
- For security: run `get_security_alerts` and optionally `update_alert_status`.
- For Agent Builder MCP: run a tool from the IDE after adding the MCP config.
