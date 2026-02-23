# Elastic Workflows Demo Script

E-commerce order enrichment: ingest pipelines, enriched indices, ES|QL analytics, and alerting.

**Prerequisites:** Elastic deployment with ES_URL and ES_API_KEY (or ES_USERNAME/ES_PASSWORD) set. KIBANA_URL set for alerting.

---

## Step 1: Create an ingest pipeline

**What to say:** "Let's build an ingest pipeline that enriches raw orders with computed fields."

**Prompt to type:**

> Create an ingest pipeline called order-enrichment that: sets a processed_at timestamp, calculates total_price from price * quantity, and categorizes orders by value (under $50 = small, $50-200 = medium, over $200 = large)

**MCP tool invoked:** `create_ingest_pipeline`

**What the audience sees:** The AI creates a pipeline with set, script, and conditional processors. The pipeline definition is returned with the three processors described.

---

## Step 2: Create the enriched-orders index

**What to say:** "Now we need an index that uses this pipeline by default."

**Prompt to type:**

> Create an index called enriched-orders with the order-enrichment pipeline as the default pipeline

**MCP tool invoked:** `create_index`

**What the audience sees:** The AI creates the index with `default_pipeline: "order-enrichment"` in the settings and appropriate field mappings.

---

## Step 3: Seed the data

**What to say:** "This script indexes products and then runs orders through the enrichment pipeline."

**Run in terminal:**

```bash
cd examples/elastic-workflows
npm install
node run-workflow.js
```

**What the audience sees:** Console output showing 10 products indexed, 20 enriched orders indexed, and a revenue-by-category breakdown.

---

## Step 4: Search for large orders

**What to say:** "Let's use natural language to find the high-value orders."

**Prompt to type:**

> Search enriched-orders and show me the large orders

**MCP tool invoked:** `search`

**What the audience sees:** Search results filtered to `order_size: "large"`, showing orders over $200 with product details, total price, and customer info.

---

## Step 5: ES|QL analytics

**What to say:** "Now let's run an ES|QL query for a quick revenue summary."

**Prompt to type:**

> Run an ES|QL query: FROM enriched-orders | STATS total_revenue = SUM(total_price), order_count = COUNT(*) BY order_size | SORT total_revenue DESC

**MCP tool invoked:** `esql_query`

**What the audience sees:** A tabular result with revenue and count broken down by order size (large, medium, small).

---

## Step 6: Create an alert rule

**What to say:** "Finally, let's set up monitoring so we know when a big order comes in."

**Prompt to type:**

> Create an alert rule that fires when an order over $1000 is placed

**MCP tool invoked:** `create_alert_rule`

**What the audience sees:** The AI creates a threshold alert rule on `enriched-orders` with condition `total_price > 1000`.

---

## Wrap-up

**Key points to highlight:**

- Ingest pipeline built through conversation -- no JSON hand-editing.
- Data flows through: raw order -> pipeline enrichment -> searchable index.
- ES|QL gives instant analytics without leaving the IDE.
- Alert rules close the loop: enrich, search, monitor.
