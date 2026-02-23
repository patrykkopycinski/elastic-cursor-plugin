---
name: siem-quickstart
description: Security monitoring and SIEM setup with Elastic Security
---

# SIEM Quickstart

Use when the user wants to set up security monitoring or SIEM with Elastic.

## 1. Prompt
- **Ask deployment preference**: Cloud (managed) or on-prem (Docker). If they already have a cluster, skip.
- Clarify data sources: logs, network, endpoints.

## 2. Provision
- If no cluster: use **get_deployment_guide** with their preference. For **Cloud**: `create_cloud_project`; for **on-prem**: use the Docker stack in `examples/on-prem-docker/` (ES, Kibana, Fleet, APM server, agents). Ensure Security is enabled (default in Cloud; for Docker it’s in the stack).
- Use Security tools: `siem_quickstart`, `create_detection_rule`, `list_detection_rules`, `enable_detection_rules` when available.

## 3. Integrate
- Guide them to install Elastic Agent or Beats (Filebeat, Winlogbeat) and connect to the cluster.
- Point to Security app in Kibana for rules, alerts, and dashboards.

## 4. Validate
- Confirm agents are reporting; run `get_security_alerts` (or equivalent) to verify alert flow.
- Suggest enabling key detection rules and tuning exceptions.
