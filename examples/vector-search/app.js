import { Client } from "@elastic/elasticsearch";
import express from "express";
import { readFile } from "node:fs/promises";

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

const INDEX = "movies";
const app = express();
app.use(express.json());

app.post("/seed", async (_req, res) => {
  try {
    const raw = await readFile(
      new URL("./seed-data.json", import.meta.url),
      "utf-8"
    );
    const movies = JSON.parse(raw);

    const operations = movies.flatMap((doc) => [
      { index: { _index: INDEX } },
      doc,
    ]);

    const { items } = await client.bulk({ operations, refresh: "wait_for" });
    const failed = items.filter((i) => i.index?.error);

    res.json({
      indexed: items.length - failed.length,
      failed: failed.length,
      errors: failed.map((i) => i.index.error),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/search", async (req, res) => {
  try {
    const q = req.query.q;
    if (!q) return res.status(400).json({ error: "missing ?q= parameter" });

    const result = await client.search({
      index: INDEX,
      knn: {
        field: "plot_embedding",
        query_vector_builder: {
          text_embedding: { model_id: "elser", model_text: q },
        },
        k: 5,
        num_candidates: 20,
      },
      _source: ["title", "year", "director", "genres", "plot", "rating"],
    });

    res.json(
      result.hits.hits.map((hit) => ({
        score: hit._score,
        ...hit._source,
      }))
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/hybrid", async (req, res) => {
  try {
    const q = req.query.q;
    if (!q) return res.status(400).json({ error: "missing ?q= parameter" });

    const result = await client.search({
      index: INDEX,
      query: {
        bool: {
          should: [
            { match: { plot: q } },
            { match: { title: q } },
            { match: { genres: q } },
          ],
        },
      },
      knn: {
        field: "plot_embedding",
        query_vector_builder: {
          text_embedding: { model_id: "elser", model_text: q },
        },
        k: 5,
        num_candidates: 20,
      },
      _source: ["title", "year", "director", "genres", "plot", "rating"],
      size: 10,
    });

    res.json(
      result.hits.hits.map((hit) => ({
        score: hit._score,
        ...hit._source,
      }))
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Vector search demo listening on http://localhost:${PORT}`);
});
