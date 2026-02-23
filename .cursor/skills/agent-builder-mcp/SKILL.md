---
name: agent-builder-mcp
description: Use Elastic Agent Builder and Agent Builder MCP from the IDE (define tools, test, connect Cursor/Claude)
---

# Agent Builder and Agent Builder MCP

Use this skill when the user wants to create or use custom tools with Elastic Agent Builder, or connect their IDE to Agent Builder’s MCP endpoint.

## 1. Prompt

- Clarify whether they need to: define a new tool, list existing Agent Builder tools, test a tool, or get MCP config to connect Cursor/Claude to Agent Builder.
- Confirm they have access to Agent Builder (Kibana or org endpoint) and, if needed, the MCP endpoint URL.

## 2. Provision

- For **defining a tool**: Use `create_agent_builder_tool` with name, description, and optional input_schema. The output is a tool definition to create in Agent Builder (UI or API).
- For **listing tools**: Use `list_agent_builder_tools` with the Agent Builder endpoint (or set `AGENT_BUILDER_ENDPOINT`).
- For **testing**: Use `test_agent_builder_tool` with tool name and sample arguments.

## 3. Integrate

- For **Agent Builder MCP handoff**: Use `get_agent_builder_mcp_config` with the Agent Builder MCP URL (e.g. `https://your-kibana/api/agent_builder/mcp`) and transport (e.g. `streamable_http`). Add the returned JSON to the user’s MCP config (Cursor Settings → MCP, or Claude Code config) so the IDE uses Agent Builder’s MCP server.
- Explain the split: this plugin for setup and generic Elastic tools; Agent Builder MCP for organization-specific tools and production agents.

## 4. Validate

- After adding the MCP config, the user should see Agent Builder tools in Cursor/Claude. Suggest they run a simple tool call to confirm.
- For new tools, suggest they run `test_agent_builder_tool` with sample input before relying on them in production.
