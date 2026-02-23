import { readFileSync } from "node:fs";
import { Client } from "@elastic/elasticsearch";

const ES_URL = process.env.ES_URL;
const ES_API_KEY = process.env.ES_API_KEY;
const ES_USERNAME = process.env.ES_USERNAME;
const ES_PASSWORD = process.env.ES_PASSWORD;

if (!ES_URL) {
  console.error("ES_URL is required");
  process.exit(1);
}

const auth = ES_API_KEY
  ? { apiKey: ES_API_KEY }
  : ES_USERNAME && ES_PASSWORD
    ? { username: ES_USERNAME, password: ES_PASSWORD }
    : null;

if (!auth) {
  console.error("ES_API_KEY or ES_USERNAME/ES_PASSWORD is required");
  process.exit(1);
}

const client = new Client({
  node: ES_URL,
  auth,
  tls: { rejectUnauthorized: process.env.ES_SSL_SKIP_VERIFY !== "true" },
});

const PRODUCTS_INDEX = "products";
const ORDERS_INDEX = "enriched-orders";

async function resetIndex(index) {
  const exists = await client.indices.exists({ index });
  if (exists) {
    await client.indices.delete({ index });
    console.log(`Deleted existing index: ${index}`);
  }
}

async function indexProducts() {
  const products = JSON.parse(readFileSync("seed-products.json", "utf-8"));

  await resetIndex(PRODUCTS_INDEX);
  await client.indices.create({
    index: PRODUCTS_INDEX,
    mappings: {
      properties: {
        product_id: { type: "keyword" },
        name: { type: "text", fields: { keyword: { type: "keyword" } } },
        category: { type: "keyword" },
        price: { type: "float" },
        warehouse_location: { type: "keyword" },
      },
    },
  });

  const operations = products.flatMap((doc) => [
    { index: { _index: PRODUCTS_INDEX, _id: doc.product_id } },
    doc,
  ]);
  await client.bulk({ operations, refresh: "wait_for" });
  console.log(`Indexed ${products.length} products into ${PRODUCTS_INDEX}`);
  return products;
}

async function createPipelineAndIndexOrders(products) {
  const productLookup = Object.fromEntries(
    products.map((p) => [p.product_id, p])
  );

  await resetIndex(ORDERS_INDEX);
  await client.indices.create({
    index: ORDERS_INDEX,
    mappings: {
      properties: {
        order_id: { type: "keyword" },
        product_id: { type: "keyword" },
        customer_name: { type: "keyword" },
        customer_email: { type: "keyword" },
        quantity: { type: "integer" },
        timestamp: { type: "date" },
        processed_at: { type: "date" },
        product_name: { type: "text", fields: { keyword: { type: "keyword" } } },
        category: { type: "keyword" },
        unit_price: { type: "float" },
        total_price: { type: "float" },
        order_size: { type: "keyword" },
        warehouse_location: { type: "keyword" },
      },
    },
  });

  const orders = JSON.parse(readFileSync("seed-orders.json", "utf-8"));

  const enrichedOrders = orders.map((order) => {
    const product = productLookup[order.product_id];
    const totalPrice = product ? product.price * order.quantity : 0;
    let orderSize = "small";
    if (totalPrice > 200) orderSize = "large";
    else if (totalPrice >= 50) orderSize = "medium";

    return {
      ...order,
      processed_at: new Date().toISOString(),
      product_name: product?.name ?? "Unknown",
      category: product?.category ?? "Unknown",
      unit_price: product?.price ?? 0,
      total_price: totalPrice,
      order_size: orderSize,
      warehouse_location: product?.warehouse_location ?? "Unknown",
    };
  });

  const operations = enrichedOrders.flatMap((doc) => [
    { index: { _index: ORDERS_INDEX, _id: doc.order_id } },
    doc,
  ]);
  await client.bulk({ operations, refresh: "wait_for" });
  console.log(`Indexed ${enrichedOrders.length} enriched orders into ${ORDERS_INDEX}`);
}

async function runAggregation() {
  const query = `
    FROM enriched-orders
    | STATS total_revenue = SUM(total_price), order_count = COUNT(*) BY category
    | SORT total_revenue DESC
  `.trim();

  console.log("\nES|QL: Revenue by category\n");
  try {
    const result = await client.esql.query({ query, format: "txt" });
    console.log(result);
  } catch {
    const result = await client.search({
      index: ORDERS_INDEX,
      size: 0,
      aggs: {
        by_category: {
          terms: { field: "category" },
          aggs: {
            total_revenue: { sum: { field: "total_price" } },
          },
        },
      },
    });
    console.log("Fallback aggregation (Query DSL):\n");
    for (const bucket of result.aggregations.by_category.buckets) {
      console.log(
        `  ${bucket.key}: $${bucket.total_revenue.value.toFixed(2)} (${bucket.doc_count} orders)`
      );
    }
  }
}

async function run() {
  const products = await indexProducts();
  await createPipelineAndIndexOrders(products);
  await runAggregation();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
