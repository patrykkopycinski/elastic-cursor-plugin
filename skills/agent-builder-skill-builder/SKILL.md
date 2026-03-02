---
name: agent-builder-skill-builder
description: Guide for building, testing, and deploying custom Agent Builder skills — from tool creation through agent configuration and MCP handoff.
---

# Agent Builder Skill Builder

Build custom tools and agents in Kibana's Agent Builder, then connect them to Cursor or other MCP clients for production use.

## Steps

### 1. Discover Existing Tools and Agents

Call `list_agent_builder_tools` to see what tools are already registered (builtin and custom).
Call `list_agent_builder_agents` to see available agents.

Present the results:
- Count of builtin vs custom tools
- Each custom tool with its ID, type, and description
- Each agent with its name, description, and assigned tools

### 2. Plan the Custom Tool

Based on the user's requirements, determine:
- **Tool type**: `esql` (pre-defined query with parameters) or `index_search` (natural language search scoped to an index pattern)
- **Tool ID**: kebab-case unique identifier
- **Description**: clear description of what the tool does
- **Configuration**: the query/pattern and any parameters

For ES|QL tools, help the user write the query first using `esql_query` to test it against real data.
For index_search tools, use `discover_data` to find the right index pattern.

### 3. Create the Tool

Call `create_agent_builder_tool` with the planned configuration.

**ES|QL tool example:**
```json
{
  "id": "sales-summary",
  "type": "esql",
  "description": "Summarize sales by region for a given time period",
  "tags": ["analytics", "sales"],
  "configuration": {
    "query": "FROM sales-* | WHERE @timestamp >= ?start | STATS total=SUM(amount) BY region | SORT total DESC",
    "params": {
      "start": { "type": "date", "description": "Start date for the summary" }
    }
  }
}
```

**Index search tool example:**
```json
{
  "id": "kb-search",
  "type": "index_search",
  "description": "Search the internal knowledge base for documentation",
  "tags": ["search", "docs"],
  "configuration": {
    "pattern": "knowledge-base"
  }
}
```

### 4. Test the Tool

Call `test_agent_builder_tool` with a realistic query to verify the tool works:
- Use a clear, specific query that exercises the tool's intended use case
- Check the response contains the expected data shape
- If results are wrong, iterate on the tool configuration

### 5. Create a Custom Agent (Optional)

If the user wants a specialized agent, call `create_agent_builder_agent` with:
- A descriptive name and instructions
- The list of tool IDs the agent should have access to
- Both builtin tools (e.g. `platform.core.search`) and custom tools

### 6. Generate MCP Config for Production

Call `get_agent_builder_mcp_config` to generate the JSON configuration for connecting MCP clients directly to Agent Builder.

Present the config and explain:
- This plugin handles infrastructure setup and generic Elastic tools
- Agent Builder MCP serves organization-specific custom tools and agents
- Both MCP servers can run side by side

## Tools Used
- `list_agent_builder_tools` — list registered tools
- `create_agent_builder_tool` — create ES|QL or index_search tools
- `delete_agent_builder_tool` — remove custom tools
- `test_agent_builder_tool` — test tools via the converse API
- `list_agent_builder_agents` — list registered agents
- `create_agent_builder_agent` — create custom agents with tools
- `delete_agent_builder_agent` — remove custom agents
- `get_agent_builder_mcp_config` — generate MCP client configuration
- `discover_data` — discover indices/data streams for tool configuration
- `esql_query` — test ES|QL queries before creating tools
- `kibana_api` — direct Kibana API access for advanced operations

## API References
- `elastic://docs/api/kibana` — Kibana REST API reference
- Agent Builder API: `POST /api/agent_builder/tools`, `POST /api/agent_builder/agents`, `POST /api/agent_builder/converse`

## Prerequisites
- `KIBANA_URL` configured and pointing to a Kibana instance with Agent Builder enabled
- `ES_URL` and authentication (`ES_API_KEY` or `ES_USERNAME`/`ES_PASSWORD`) configured
- Agent Builder feature must be enabled in the Kibana deployment
