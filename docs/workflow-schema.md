# Workflow YAML Schema

## Introduction

Workflows are multi-step MCP tool orchestrations that chain tool calls together with variable passing, conditional execution, and error handling. Instead of manually calling tools one at a time, a workflow defines a sequence of steps that the MCP server executes in order, piping outputs from earlier steps into later ones.

There are two types of workflows:

- **Built-in workflows** — shipped with the plugin under `packages/mcp-server/workflows/`. These cover common O11Y setup patterns and are available out of the box.
- **Custom workflows** — user-defined YAML files stored in `workflows/<name>.yaml` at the project root (or any path configured in `WORKFLOWS_DIR`). Custom workflows appear alongside built-in ones in `list_workflows` output.

---

## Schema Reference

### Top-level fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | yes | Unique identifier for the workflow. Used when calling `run_workflow`. |
| `description` | `string` | yes | Human-readable summary shown in `list_workflows` output. |
| `version` | `string` | no | Semver version string for tracking changes (e.g. `"1.0.0"`). |
| `variables` | `object` | no | Map of input variables the workflow accepts. Keys are variable names. |
| `steps` | `array` | yes | Ordered list of step objects to execute. |

### Variable definitions

Each key under `variables` is a variable name. The value is an object with:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `description` | `string` | yes | What this variable controls. |
| `type` | `string` | yes | One of `string`, `number`, `boolean`, `object`. |
| `default` | any | no | Default value used when the caller does not supply one. |
| `required` | `boolean` | no | When `true`, the workflow fails if the variable is not provided and has no default. Defaults to `false`. |

Example:

```yaml
variables:
  environment:
    description: Target environment to filter on
    type: string
    default: production
  threshold_ms:
    description: Latency threshold in milliseconds
    type: number
    required: true
```

### Step objects

Each entry in the `steps` array is an object with:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | yes | Unique identifier for this step. Referenced in `${steps.<id>.output}` expressions. |
| `name` | `string` | yes | Human-readable label shown in execution logs. |
| `tool` | `string` | yes | Name of the MCP tool to invoke (e.g. `discover_o11y_data`, `kibana_create_dashboard`). |
| `parameters` | `object` | yes | Arguments passed to the tool. Values support `${…}` variable substitution. |
| `condition` | `string` | no | Expression evaluated before execution. The step is skipped when the condition is falsy. |
| `output_mapping` | `object` | no | Map of output field paths to variable names, making step outputs available as variables for later steps. |
| `on_error` | `string` | no | Behavior when the step fails. One of `stop` (default), `skip`, or `continue`. |

**`on_error` values:**

| Value | Behavior |
|-------|----------|
| `stop` | Abort the workflow immediately (default). |
| `skip` | Log the error and skip to the next step. |
| `continue` | Log the error, store a partial result, and continue. |

---

## Variable Substitution

Step parameters and conditions can reference variables and previous step outputs using `${…}` syntax.

### Input variables

Use `${variables.<name>}` to reference a workflow input variable:

```yaml
parameters:
  title: "Dashboard for ${variables.environment}"
```

### Step outputs

Use `${steps.<stepId>.output}` to reference the full output of a previous step, or dot into nested fields:

```yaml
parameters:
  discovery_result: "${steps.discover.output}"
  first_service: "${steps.discover.output.services[0].name}"
  panel_config: "${steps.summary.output.recommendations.dashboards[0].config.panels}"
```

### Nesting

Substitution works inside strings (interpolation) and as standalone values (full replacement). When the entire parameter value is a single `${…}` expression, the resolved value retains its original type (object, array, number). When embedded in a larger string, it is coerced to a string.

---

## Built-in Workflows

| Workflow | Description | Required Variables |
|----------|-------------|--------------------|
| `full-o11y-setup` | End-to-end O11Y configuration: discovers all data sources, generates a summary with recommendations, and creates dashboards and SLOs. | none |
| `service-dashboard` | Creates an APM service overview dashboard with latency, throughput, and error-rate panels. | `service_name` (string, required) |
| `slo-from-apm` | Creates SLO definitions derived from APM latency and error-rate data for a given service. | `service_name` (string, required) |
| `infrastructure-overview` | Creates a host and container metrics dashboard covering CPU, memory, disk, and network. | none |

Use `list_workflows` to see the current set (built-in + custom) and their variables.

---

## Complete Example

A custom workflow that discovers production O11Y data and creates a dashboard:

```yaml
name: my-custom-setup
description: Discover production services and create dashboards
variables:
  environment:
    description: Target environment
    type: string
    default: production
steps:
  - id: discover
    name: Discover O11Y data
    tool: discover_o11y_data
    parameters:
      time_range_from: "now-7d"

  - id: summary
    name: Generate summary
    tool: get_data_summary
    parameters:
      discovery_result: "${steps.discover.output}"
      format: json

  - id: dashboard
    name: Create dashboard
    tool: kibana_create_dashboard
    condition: "steps.discover.output.services.length > 0"
    parameters:
      title: "O11Y Dashboard - ${variables.environment}"
      panels: "${steps.summary.output.recommendations.dashboards[0].config.panels}"
    on_error: skip
```

### What happens at runtime

1. **discover** — calls `discover_o11y_data` with a 7-day lookback. Output is stored as `steps.discover.output`.
2. **summary** — passes the full discovery result to `get_data_summary`. Output is stored as `steps.summary.output`.
3. **dashboard** — only runs if at least one APM service was discovered (`condition`). Builds the title from the `environment` variable and pulls panel config from the summary recommendations. If the Kibana API call fails, execution continues (`on_error: skip`).

---

## How to Use

Three MCP tools manage workflows:

| Tool | Purpose |
|------|---------|
| `list_workflows` | List all available workflows (built-in and custom) with their descriptions and required variables. |
| `run_workflow` | Execute a workflow by name. Pass `variables` as a JSON object to supply inputs. |
| `save_workflow` | Save a custom workflow definition. Accepts a YAML string or structured object and writes it to the custom workflows directory. |

### Running a workflow

Ask the agent:

> *"Run the full-o11y-setup workflow"*

Or with variables:

> *"Run service-dashboard with service_name set to payment-api"*

The agent calls `run_workflow` with the name and variables, then streams step-by-step progress back to you.

### Creating a custom workflow

1. Write a YAML file following the schema above.
2. Save it via `save_workflow`, or drop the file into `workflows/` manually.
3. Verify with `list_workflows` — your workflow should appear in the list.
