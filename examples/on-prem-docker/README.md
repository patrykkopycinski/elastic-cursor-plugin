# On-prem deployment with Docker

Use this when the user prefers **on-prem** over Elastic Cloud. This stack runs **Elasticsearch**, **Kibana**, **APM server**, and optionally **Fleet server** and **Elastic Agent** in Docker.

## Ask first

Before provisioning, ask: **"Do you prefer a Cloud-based solution (Elastic Cloud, managed) or on-prem (self-hosted with Docker)?"**

- **Cloud** → Use the Cloud path: `get_deployment_guide` with `preference: "cloud"`, then `create_cloud_project`, `get_connection_config`.
- **On-prem** → Use this Docker stack and `get_deployment_guide` with `preference: "on_prem"`.

## Quick start (Elasticsearch + Kibana + APM server)

1. **Set password** (optional; default is `changeme`):
   ```bash
   export ELASTIC_PASSWORD=your-secure-password
   ```

2. **Start the stack** (from this directory):
   ```bash
   docker compose up -d
   ```

   This starts:
   - **Elasticsearch** at http://localhost:9200
   - **Kibana** at http://localhost:5601
   - **APM server** at http://localhost:8200

3. **Log in to Kibana**: Open http://localhost:5601 and sign in with `elastic` and your `ELASTIC_PASSWORD`.

4. **Use the plugin**: Set in your env (or Cursor MCP env):
   - `ES_URL=http://localhost:9200`
   - `ES_USERNAME=elastic`
   - `ES_PASSWORD=your-secure-password`  
   Or create an API key in Kibana (Management → Security → API Keys) and set `ES_API_KEY`.

5. **APM**: From your app, use APM Server URL `http://localhost:8200` (or `http://host.docker.internal:8200` from a container). Use the plugin’s `setup_apm` tool with this URL.

## Fleet server (optional)

To run **Fleet server** and manage **Elastic Agents** from Kibana:

1. Start Elasticsearch and Kibana (steps above), then open Kibana.
2. Go to **Management → Fleet** and complete Fleet setup if prompted.
3. **Add Fleet Server**: In Fleet, choose “Add Fleet Server”, create a policy, and copy the **enrollment token**.
4. Start Fleet Server with that token:
   ```bash
   export FLEET_SERVER_ENROLLMENT_TOKEN=<token-from-kibana>
   docker compose --profile fleet up -d fleet-server
   ```
5. After Fleet Server is enrolled, you can **Add Elastic Agent** in Fleet and enroll agents (on the host or in Docker) using the agent enrollment token from Kibana.

## Elastic Agent (optional)

To run an **Elastic Agent** in Docker (e.g. to ship logs or metrics):

1. Ensure Fleet (and optionally Fleet Server) is running and set up in Kibana.
2. In Kibana → Fleet → Add agent, create an agent policy and copy the **enrollment token**.
3. Run the agent:
   ```bash
   docker run -d \
     --name=elastic-agent \
     -e FLEET_ENROLLMENT_TOKEN=<your-agent-enrollment-token> \
     -e FLEET_URL=http://fleet-server:8220 \
     -e FLEET_INSECURE=true \
     --network=on-prem-docker_default \
     docker.elastic.co/beats/elastic-agent:8.17.0
   ```
   (Use the actual network name from `docker network ls` if different.)

Or install the agent on the host: see [Elastic Agent installation](https://www.elastic.co/guide/en/fleet/current/elastic-agent-installation.html).

## Summary

| Service         | Port | Purpose                          |
|----------------|------|-----------------------------------|
| Elasticsearch  | 9200 | Search, storage                  |
| Kibana         | 5601 | UI, Fleet, dashboards            |
| APM server     | 8200 | APM intake                       |
| Fleet server   | 8220 | Optional; for managed agents     |

Always **ask the user for Cloud vs on-prem preference**, then use **Cloud tools** or this **Docker stack** accordingly.
