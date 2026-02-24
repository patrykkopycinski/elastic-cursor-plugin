---
name: siem-quickstart
description: Security monitoring and SIEM setup with Elastic Security
---

# SIEM Quickstart

Use when the user wants to set up security monitoring or SIEM with Elastic.

## 1. Discover
- **Run `discover_security_data`** to auto-detect existing security data sources (Endpoint, Auditbeat, cloud logs, network data).
- **Run `get_security_summary`** to get a security posture assessment with coverage gaps and MITRE ATT&CK mapping.
- If no security data exists, proceed to Provision.

## 2. Prompt
- **Ask deployment preference**: Cloud (managed) or on-prem (Docker). If they already have a cluster, skip.
- Clarify data sources: logs, network, endpoints.

## 3. Provision
- If no cluster: use **get_deployment_guide** with their preference. For **Cloud**: `create_cloud_project`; for **on-prem**: use the Docker stack in `examples/on-prem-docker/` (ES, Kibana, Fleet, APM server, agents). Ensure Security is enabled (default in Cloud; for Docker it's in the stack).
- Use Security tools: `siem_quickstart`, then `kibana_api` for detection rule management.

## 4. Integrate
- Guide them to install Elastic Agent or Beats (Filebeat, Winlogbeat) and connect to the cluster.
- Point to Security app in Kibana for rules, alerts, and dashboards.

## 5. Validate
- Run `discover_security_data` again to confirm agents are reporting.
- Run `get_security_summary` to verify detection coverage and alert flow.
- Suggest enabling key detection rules and tuning exceptions based on the summary recommendations.
