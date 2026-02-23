# Agent Builder Demo Script

Building a "knowledge base search" tool for Agent Builder and connecting it to Cursor via MCP.

**Prerequisites:** Elastic deployment with Agent Builder available. ES_URL and ES_API_KEY (or ES_USERNAME/ES_PASSWORD) set. KIBANA_URL set for Agent Builder API access.

---

## Step 1: Populate the knowledge base

**What to say:** "We have 15 internal docs articles -- deployment guides, troubleshooting runbooks, API references. Let's index them."

**Run in terminal:**

```bash
cd examples/agent-builder-and-mcp
npm install
node setup-kb.js
```

**What the audience sees:** Console output confirming 15 articles indexed into `knowledge-base`.

---

## Step 2: Create an Agent Builder tool

**What to say:** "Now let's define a search tool in Agent Builder so an AI agent can query this knowledge base."

**Prompt to type:**

> Create an Agent Builder tool definition called kb-search that takes a query parameter and searches the knowledge-base index

**MCP tool invoked:** `create_agent_builder_tool`

**What the audience sees:** The AI generates a tool definition with name `kb-search`, a `query` string parameter, and the Elasticsearch search action targeting the `knowledge-base` index.

---

## Step 3: Test the tool

**What to say:** "Let's test it with a real question before putting it into production."

**Prompt to type:**

> Test the kb-search tool with query: "how to deploy to production"

**MCP tool invoked:** `test_agent_builder_tool`

**What the audience sees:** Search results returning the "Production Deployment Checklist" and possibly the "CI/CD Pipeline Configuration" articles, demonstrating the tool works end-to-end.

---

## Step 4: List Agent Builder tools

**What to say:** "Let's confirm the tool is registered."

**Prompt to type:**

> List the tools available in Agent Builder

**MCP tool invoked:** `list_agent_builder_tools`

**What the audience sees:** A list of Agent Builder tools including `kb-search` with its description and parameter schema.

---

## Step 5: Get MCP config for Cursor

**What to say:** "The final step is connecting Cursor directly to Agent Builder so the IDE can use these tools in production."

**Prompt to type:**

> Get the MCP config to connect Cursor to my Agent Builder endpoint

**MCP tool invoked:** `get_agent_builder_mcp_config`

**What the audience sees:** A JSON snippet ready to paste into Cursor's MCP settings, pointing to the Agent Builder MCP endpoint.

---

## Step 6: Explain the handoff

**What to say (no prompt needed):**

"This is the key pattern: use this plugin to set up Elastic, create indices, and prototype tools. Then use Agent Builder MCP in production -- your custom tools are served by Agent Builder's own MCP endpoint, and Cursor or Claude can call them directly.

You can run both MCP servers side by side: this plugin for infrastructure and generic Elastic tools, Agent Builder MCP for your organization-specific tools and agents."

---

## Wrap-up

**Key points to highlight:**

- Knowledge base indexed with one script, tool created with one prompt.
- Test the tool before deploying -- no guessing if it works.
- MCP config export makes the setup-to-production handoff seamless.
- Two MCP servers, complementary roles: plugin for setup, Agent Builder for production.
