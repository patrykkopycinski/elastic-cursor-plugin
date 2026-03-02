---
name: plugin-self-improve
description: Audit and improve the Elastic Cursor Plugin itself — analyze coverage gaps, identify missing tools/skills/rules, assess quality, and implement improvements. Use when asked to improve, extend, audit, or enhance the plugin.
---

# Plugin Self-Improve

Systematic workflow for auditing and improving the Elastic Cursor Plugin. Analyzes the current state across all component types, identifies gaps against the Elastic product surface, and implements targeted improvements.

## Trigger

Use when the user asks to:
- Improve, extend, or enhance the plugin
- Audit plugin quality or coverage
- Find gaps in Elastic product coverage
- Add new capabilities to the plugin
- Review the plugin before a release

## Steps

### 1. Inventory Current State

Read the plugin manifest and enumerate all components:

**Plugin manifest:** `.cursor-plugin/plugin.json`

**MCP Tools** — read `packages/tools-smart/src/index.ts` and list every registered tool:
- Gateway tools: `elasticsearch_api`, `kibana_api`, `cloud_api`, `esql_query`
- Smart tools: every `register*` import in `packages/tools-smart/src/index.ts`
- Workflow tools: `list_workflows`, `run_workflow`, `save_workflow`

**Skills** — list all `skills/*/SKILL.md` files, read each frontmatter for name + description.

**Rules** — list all `rules/*.mdc` files, read each frontmatter for description + scope.

**Agents** — list all `agents/*.md` files, read each frontmatter for name + description.

**Commands** — list all `commands/*.md` files, read each frontmatter for name + description.

**Docs resources** — read `packages/docs-provider/src/index.ts` for registered `elastic://docs/*` URIs.

Present the full inventory as a structured table:

```
| Component Type | Count | Names |
|---|---|---|
| MCP Tools | N | tool1, tool2, ... |
| Skills | N | skill1, skill2, ... |
| Rules | N | rule1, rule2, ... |
| Agents | N | agent1, agent2, ... |
| Commands | N | cmd1, cmd2, ... |
| Doc Resources | N | uri1, uri2, ... |
```

### 2. Map Against Elastic Product Surface

Compare the inventory against the full Elastic product offering:

**Search:**
- Index management (create, mappings, templates, lifecycle)
- Query DSL (full-text, vector/kNN, hybrid, semantic)
- ES|QL
- Search applications and relevance tuning
- Inference endpoints (embeddings, rerank, completion)

**Observability:**
- APM (services, transactions, errors, dependencies)
- Infrastructure monitoring (hosts, containers, pods)
- Log management (shipping, parsing, correlation)
- Synthetics and uptime
- SLOs and burn rate alerts
- Universal Profiling

**Security:**
- SIEM (detection rules, alerts, timelines)
- Endpoint security (Elastic Defend)
- Cloud security posture (CSPM, KSPM, CNVM)
- Threat intelligence
- Investigation (cases, osquery, response actions)
- Entity analytics (risk scoring, asset criticality)

**Platform:**
- Fleet and agent management
- Connectors and actions (Slack, PagerDuty, email, webhook)
- Spaces and RBAC
- Transforms and rollups
- Cross-cluster search and replication
- Machine learning (anomaly detection, data frame analytics)

For each area, classify coverage as:
- **Full** — dedicated tools + skill + rule guidance
- **Partial** — some tools but no skill, or skill without dedicated tools
- **Mentioned** — referenced in docs/rules but no tools or skills
- **Missing** — not covered at all

### 3. Identify Improvement Opportunities

Rank gaps by impact:

**High impact** — core Elastic use cases with no plugin coverage:
- Missing tools for frequently used Kibana/ES APIs
- Elastic product areas with no skills or commands
- Important workflows with no guided experience

**Medium impact** — existing coverage that could be deeper:
- Skills that reference tools that don't exist yet
- Tools that exist but have no corresponding skill workflow
- Rules that could be more specific or actionable

**Low impact** — polish and completeness:
- Missing doc resources for covered areas
- Commands that duplicate skill functionality
- Agents that overlap with existing skills

### 4. Quality Audit

For each existing component, check:

**Tools:**
- Does the tool connect to the right Elastic service? (ES via `esFetch`, Kibana via `kibanaFetch` — never ES transport for Kibana routes)
- Does the input schema cover the most useful parameters?
- Does the output format give actionable information?
- Are error cases handled with clear messages?

**Skills:**
- Does the skill reference only tools that actually exist in `packages/tools-smart/src/index.ts`?
- Are the API References URIs valid (`elastic://docs/api/*`)?
- Does the workflow have clear user decision points?
- Is the step sequence logical and complete?

**Rules:**
- Does each rule have proper frontmatter (`description`, `alwaysApply: true` or `globs`)?
- Is the guidance specific and actionable (not generic)?
- Does it reference real tool names and API patterns?

**Agents:**
- Does the agent list only tools that exist?
- Is the trigger description clear about when to use it?
- Does it cover a coherent workflow, not a grab-bag?

**Commands:**
- Does the command have `name`, `description`, and `argument-hint`?
- Is the workflow achievable with the tools that exist?

### 5. Present Findings

Present to the user:
1. **Coverage map** — which Elastic areas are fully covered, partially covered, or missing
2. **Top 5 high-impact gaps** — with suggested implementations
3. **Quality issues found** — mismatches between skills and tools, broken references, etc.
4. **Recommended improvements** — prioritized list with estimated effort (small/medium/large)

### 6. User Decision Point

Ask the user which improvements to implement:
- Numbered list of suggested improvements
- Allow "all high-impact" or specific selections
- For each selection, confirm the approach before implementing

### 7. Implement Improvements

For each approved improvement:

**New MCP tool:**
1. Create `packages/tools-smart/src/<tool-name>.ts` following existing patterns (zod schema, `textResponse`/`errorResponse`, `esFetch`/`kibanaFetch`)
2. Add `register<ToolName>` export and import in `packages/tools-smart/src/index.ts`
3. Run `npm run build -w @elastic-cursor-plugin/tools-smart` and `npm run typecheck -w @elastic-cursor-plugin/tools-smart`

**New skill:**
1. Create `skills/<skill-name>/SKILL.md` with `name`, `description` frontmatter
2. Follow the Steps / Tools Used / API References / Prerequisites structure
3. Reference only tools that exist

**New rule:**
1. Create `rules/<rule-name>.mdc` with `description` and `alwaysApply: true` frontmatter
2. Keep guidance specific and actionable

**New agent:**
1. Create `agents/<agent-name>.md` with `name`, `description` frontmatter
2. Include Trigger, Workflow, Tools Used, Output sections

**New command:**
1. Create `commands/<command-name>.md` with `name`, `description`, `argument-hint` frontmatter
2. Include concise workflow steps

**New doc resource:**
1. Add the content constant to `packages/docs-provider/src/content.ts`
2. Register the URI in `packages/docs-provider/src/index.ts`
3. Add the path mapping in `getDocByPath()`

### 8. Validate

After implementing:
1. Run `npm run build` — all packages must compile
2. Run `npm run typecheck` — no type errors
3. Run `npx eslint <changed-files>` — no lint errors
4. Verify all skill tool references point to real registered tools
5. Verify all doc resource URIs resolve

### 9. Summary

Present:
- Components added/modified (by type)
- Coverage improvement (before → after)
- Remaining gaps for future work
- Suggested next round of improvements

## Plugin Structure Reference

```
elastic-cursor-plugin/
├── .cursor-plugin/
│   ├── plugin.json            ← manifest with component path declarations
│   └── marketplace.json
├── skills/                    ← skills/<name>/SKILL.md
├── rules/                     ← rules/<name>.mdc
├── agents/                    ← agents/<name>.md
├── commands/                  ← commands/<name>.md
├── packages/
│   ├── mcp-server/            ← MCP server entry point
│   ├── tools-smart/           ← smart MCP tools (register pattern)
│   ├── tools-gateway/         ← REST API gateways (ES, Kibana, Cloud, ES|QL)
│   ├── tools-workflows/       ← workflow engine
│   ├── docs-provider/         ← MCP doc resources (elastic://docs/*)
│   ├── knowledge-base/        ← cluster knowledge caching
│   ├── shared-types/          ← shared TS types
│   └── shared-http/           ← HTTP clients (esFetch, kibanaFetch)
├── examples/                  ← demo apps
└── mcp.json                   ← MCP server command config
```

## Build Commands
- `npm run build` — build all packages in order
- `npm run typecheck` — type check all workspaces
- `npm run lint:fix` — eslint with auto-fix
- `npm run build -w @elastic-cursor-plugin/tools-smart` — build single package

## Prerequisites
- Node.js 20+
- npm workspaces configured (root `package.json`)
- TypeScript, tsup, zod available
