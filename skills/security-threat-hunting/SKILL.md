---
name: security-threat-hunting
description: Interactive threat hunting workflow using ES|QL and Elasticsearch queries — from hypothesis formulation through data exploration, IOC search, and finding documentation.
---

# Security Threat Hunting Workflow

Guide the user through proactive threat hunting in their Elastic Security deployment.

## Steps

### 1. Define the Hunt Hypothesis
Ask the user what they want to hunt for. Common starting points:
- **MITRE technique** — e.g., "Hunt for T1059.001 PowerShell abuse"
- **IOC-based** — e.g., "Search for known malicious IPs/domains/hashes"
- **Behavioral** — e.g., "Find unusual outbound connections from servers"
- **Anomaly-driven** — e.g., "Identify hosts with abnormal process execution"

### 2. Identify Relevant Data Sources
Call `discover_security_data` with relevant `data_sources` to confirm data availability.

Map the hypothesis to required data:
- **Process activity** → `logs-endpoint*` (Elastic Defend)
- **Network connections** → `packetbeat-*`, `logs-network_traffic*`
- **Authentication** → `auditbeat-*`, `logs-system*`, `winlogbeat-*`
- **Cloud activity** → `logs-aws.cloudtrail*`, `logs-gcp.audit*`, `logs-azure.activitylogs*`
- **DNS** → `packetbeat-*`, `logs-*` with `dns.*` fields
- **File activity** → `logs-endpoint*` with `file.*` fields

### 3. Explore with ES|QL
Build iterative ES|QL queries to explore the data. Start broad and narrow down.

**Example: Hunt for unusual PowerShell execution**
```
FROM logs-endpoint* 
| WHERE process.name == "powershell.exe" AND @timestamp >= NOW() - 7d 
| STATS exec_count = COUNT(*), unique_args = COUNT_DISTINCT(process.args) BY host.name, user.name 
| WHERE exec_count > 50 OR unique_args > 20 
| SORT exec_count DESC 
| LIMIT 20
```

Call `esql_query` to run each iteration. Present results and refine based on findings.

**Example: Hunt for rare outbound connections**
```
FROM logs-network_traffic* 
| WHERE @timestamp >= NOW() - 24h AND direction == "outbound" 
| STATS conn_count = COUNT(*), unique_hosts = COUNT_DISTINCT(source.ip) BY destination.ip, destination.port 
| WHERE unique_hosts == 1 AND conn_count < 5 
| SORT conn_count ASC 
| LIMIT 50
```

**Example: Hunt for brute force attempts**
```
FROM logs-* 
| WHERE event.category == "authentication" AND event.outcome == "failure" AND @timestamp >= NOW() - 24h 
| STATS fail_count = COUNT(*) BY source.ip, user.name 
| WHERE fail_count > 20 
| SORT fail_count DESC
```

### 4. IOC Enrichment (Optional)
If specific IOCs are identified during the hunt:

**Search for IP addresses:**
```
FROM logs-* | WHERE (source.ip == "1.2.3.4" OR destination.ip == "1.2.3.4") AND @timestamp >= NOW() - 30d | STATS hits = COUNT(*) BY _index | SORT hits DESC
```

**Search for file hashes:**
```
FROM logs-endpoint* | WHERE process.hash.sha256 == "<hash>" AND @timestamp >= NOW() - 30d | STATS hits = COUNT(*) BY host.name, process.name
```

**Search for domains:**
Call `elasticsearch_api` with a wildcard query against `dns.question.name` or `url.domain`.

### 5. Document Findings
For each significant finding, present:
- What was found (hosts, users, processes, network activity)
- Why it's suspicious (deviation from baseline, known bad pattern)
- Confidence level (high, medium, low)
- Recommended response action

### 6. User Decision Point — Act on Findings
For each finding, ask the user:
- **Create detection rule** — convert the hunt query into a persistent detection (use `manage_detection_rules`)
- **Create case** — escalate to investigation (use `manage_cases`)
- **Add exception** — if it's a known benign pattern
- **Continue hunting** — refine the query and dig deeper
- **Document only** — note the finding for future reference

### 7. Operationalize Findings
For findings that should become detections:
- Call `manage_detection_rules` to create a rule from the hunt query
- Set appropriate severity and MITRE mapping
- Configure alert actions

For findings that need investigation:
- Call `manage_cases` to create a case
- Attach relevant evidence and queries

### 8. Summary
Present the hunt results:
- Hypothesis tested
- Data sources queried
- Findings (with confidence levels)
- Actions taken (rules created, cases opened)
- Suggested follow-up hunts

## Tools Used
- `discover_security_data` — verify data source availability for the hunt
- `esql_query` — run iterative hunt queries
- `elasticsearch_api` — complex search queries (EQL sequences, nested, wildcard)
- `manage_detection_rules` — convert hunt findings into detection rules
- `manage_cases` — escalate findings to investigation cases
- `triage_alerts` — check if existing detections already cover the finding
- `kibana_api` — timeline creation, saved query management

## API References
- `elastic://docs/api/elasticsearch` — Search API for complex hunt queries
- `elastic://docs/api/kibana` — Detection Engine for operationalizing hunt findings
- `elastic://docs/api/security` — Timeline and investigation APIs

## Prerequisites
- `ES_URL` and `ES_API_KEY` configured
- Security data sources with sufficient history (7+ days recommended for behavioral hunts)
- `KIBANA_URL` configured for rule creation and case management
