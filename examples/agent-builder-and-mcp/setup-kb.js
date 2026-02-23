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

const INDEX = "knowledge-base";

async function run() {
  const exists = await client.indices.exists({ index: INDEX });
  if (exists) {
    await client.indices.delete({ index: INDEX });
    console.log(`Deleted existing index: ${INDEX}`);
  }

  await client.indices.create({
    index: INDEX,
    mappings: {
      properties: {
        id: { type: "keyword" },
        title: { type: "text", fields: { keyword: { type: "keyword" } } },
        content: { type: "text" },
        tags: { type: "keyword" },
        last_updated: { type: "date" },
      },
    },
  });
  console.log(`Created index: ${INDEX}`);

  const articles = JSON.parse(
    readFileSync("seed-knowledge-base.json", "utf-8")
  );

  const operations = articles.flatMap((doc) => [
    { index: { _index: INDEX, _id: doc.id } },
    doc,
  ]);

  const { items } = await client.bulk({ operations, refresh: "wait_for" });
  const failed = items.filter((i) => i.index?.error);
  console.log(
    `Indexed ${items.length - failed.length}/${items.length} articles into ${INDEX}`
  );
  if (failed.length > 0) {
    console.error("Sample failure:", JSON.stringify(failed[0].index.error));
  }

  const { count } = await client.count({ index: INDEX });
  console.log(`Total documents in ${INDEX}: ${count}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
