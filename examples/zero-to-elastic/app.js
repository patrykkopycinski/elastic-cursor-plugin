import express from "express";
import { Client } from "@elastic/elasticsearch";
import { readFile } from "node:fs/promises";

const INDEX = "books";
const PORT = process.env.PORT || 3000;

function createClient() {
  const url = process.env.ES_URL;
  if (!url) throw new Error("ES_URL is required");

  const opts = { node: url };

  if (process.env.ES_API_KEY) {
    opts.auth = { apiKey: process.env.ES_API_KEY };
  } else if (process.env.ES_USERNAME && process.env.ES_PASSWORD) {
    opts.auth = {
      username: process.env.ES_USERNAME,
      password: process.env.ES_PASSWORD,
    };
  }

  if (process.env.ES_SSL_SKIP_VERIFY === "true") {
    opts.tls = { rejectUnauthorized: false };
  }

  return new Client(opts);
}

const client = createClient();
const app = express();
app.use(express.json());

app.get("/health", async (_req, res) => {
  try {
    const health = await client.cluster.health();
    res.json({ status: "ok", cluster: health });
  } catch (err) {
    res.status(503).json({ status: "error", message: err.message });
  }
});

app.post("/seed", async (_req, res) => {
  try {
    const exists = await client.indices.exists({ index: INDEX });
    if (!exists) {
      await client.indices.create({
        index: INDEX,
        body: {
          mappings: {
            properties: {
              title: { type: "text", fields: { keyword: { type: "keyword" } } },
              author: { type: "text", fields: { keyword: { type: "keyword" } } },
              genre: { type: "keyword" },
              year: { type: "integer" },
              isbn: { type: "keyword" },
              rating: { type: "float" },
              description: { type: "text" },
            },
          },
        },
      });
    }

    const raw = await readFile(new URL("./seed-data.json", import.meta.url), "utf-8");
    const books = JSON.parse(raw);

    const operations = books.flatMap((doc, i) => [
      { index: { _index: INDEX, _id: String(i + 1) } },
      doc,
    ]);

    const result = await client.bulk({ refresh: true, operations });
    res.json({
      indexed: books.length,
      errors: result.errors,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/search", async (req, res) => {
  const q = req.query.q;
  if (!q) return res.status(400).json({ error: "query parameter 'q' is required" });

  try {
    const result = await client.search({
      index: INDEX,
      body: {
        query: {
          multi_match: {
            query: q,
            fields: ["title^3", "author^2", "description", "genre"],
          },
        },
      },
    });

    const hits = result.hits.hits.map((h) => ({
      id: h._id,
      score: h._score,
      ...h._source,
    }));

    res.json({ total: result.hits.total.value, hits });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/books/:id", async (req, res) => {
  try {
    const doc = await client.get({ index: INDEX, id: req.params.id });
    res.json({ id: doc._id, ...doc._source });
  } catch (err) {
    if (err.meta?.statusCode === 404) {
      return res.status(404).json({ error: "book not found" });
    }
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Bookstore API listening on http://localhost:${PORT}`);
});
