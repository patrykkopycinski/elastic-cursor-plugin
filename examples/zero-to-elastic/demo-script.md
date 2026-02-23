# Bookstore Search Demo: Presenter Script

This walkthrough takes a fresh machine from zero infrastructure to a working
bookstore search API backed by Elasticsearch, entirely from the Cursor chat
panel using the Elastic Cursor Plugin MCP tools.

**Time:** approximately 5 minutes.

**Prerequisites:**
- Cursor with the Elastic Cursor Plugin configured (see root README).
- Node.js 20+.
- For on-prem: Docker installed.
- For Cloud: an Elastic Cloud account.

---

## Step 1: Provision Elasticsearch

**What to say:** "Let's start from zero -- no Elasticsearch, no cluster. We just ask the AI to set it up."

Open Cursor chat and type:

```
Set up Elastic for me. I want to use it for a bookstore search app.
```

**What happens:** The AI asks whether you prefer Cloud (managed) or on-prem
(Docker). Pick one.

- **Cloud path:** The AI calls `get_deployment_guide` with `preference: "cloud"`,
  then `create_cloud_project` to provision a serverless project and returns the
  URL and API key.
- **On-prem path:** The AI calls `get_deployment_guide` with
  `preference: "on_prem"` and walks you through `docker compose up -d` from
  `examples/on-prem-docker/`.

**Result:** You have `ES_URL` and credentials (API key or username/password).

---

## Step 2: Create the books index

**What to say:** "Now let's create an index with proper mappings for our bookstore data."

Type in Cursor chat:

```
Create an Elasticsearch index called "books" with mappings for: title (text with keyword subfield), author (text with keyword subfield), genre (keyword), year (integer), isbn (keyword), rating (float), description (text).
```

**MCP tool used:** `create_index`

The AI sends a `create_index` call with the index name and mapping body. You
will see the created index confirmation in the response.

---

## Step 3: Seed sample data

**What to say:** "We have 20 books in a JSON file. Let's ask the AI to bulk-index them."

Type in Cursor chat:

```
Bulk-index the books from examples/zero-to-elastic/seed-data.json into the books index.
```

**MCP tool used:** `bulk_index`

The AI reads `seed-data.json`, builds the bulk payload, and calls `bulk_index`.
It reports how many documents were indexed.

---

## Step 4: Full-text search

**What to say:** "Now the fun part -- let's search our data using natural language."

Type in Cursor chat:

```
Search the books index for "science fiction"
```

**MCP tool used:** `search`

The AI calls `search` with a `multi_match` query across title, author,
description, and genre. It returns matching books ranked by relevance.

Try variations:

```
Search books for "detective murder"
```

```
Search books for "Kleppmann"
```

---

## Step 5: ES|QL analytics

**What to say:** "ES|QL lets us run SQL-like analytics directly on Elasticsearch. Let's aggregate our book data."

Type in Cursor chat:

```
Run an ES|QL query on the books index: find the average rating per genre, sorted by average rating descending.
```

**MCP tool used:** `esql_query`

The AI constructs and sends:

```
FROM books | STATS avg_rating = AVG(rating) BY genre | SORT avg_rating DESC
```

The result comes back as a tabular dataset showing each genre and its average
rating.

Try another:

```
ES|QL: show all books published before 1980, sorted by year
```

```
FROM books | WHERE year < 1980 | SORT year ASC | KEEP title, author, year, genre
```

---

## Step 6: Run the Express API

**What to say:** "Finally, let's show that the same Elasticsearch data powers a real application."

Now show that the same Elasticsearch data powers a real application.

```bash
cd examples/zero-to-elastic
npm install
ES_URL=http://localhost:9200 ES_USERNAME=elastic ES_PASSWORD=changeme node app.js
```

(Replace credentials with the values from Step 1.)

Test the endpoints:

```bash
# Health check
curl http://localhost:3000/health

# Seed data (if you skipped Step 3 or want to re-seed via the app)
curl -X POST http://localhost:3000/seed

# Full-text search
curl "http://localhost:3000/search?q=science+fiction"

# Get a single book by ID
curl http://localhost:3000/books/1
```

---

## Recap

| Step | Prompt | MCP Tool |
|------|--------|----------|
| 1 | "Set up Elastic for me" | `get_deployment_guide`, `create_cloud_project` or Docker |
| 2 | "Create an index called books with these mappings" | `create_index` |
| 3 | "Bulk-index the books from seed-data.json" | `bulk_index` |
| 4 | "Search books for science fiction" | `search` |
| 5 | "ES|QL: average rating per genre" | `esql_query` |
| 6 | Run `node app.js` and curl the API | (application code) |

From zero to a working search API in under 5 minutes, without leaving the IDE.
