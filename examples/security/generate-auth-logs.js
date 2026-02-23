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

const INDEX = "auth-logs";

const USERS = [
  "alice.chen",
  "bob.martinez",
  "carol.johnson",
  "dave.kumar",
  "eve.oconnor",
  "frank.wong",
  "grace.petrov",
  "ci-bot",
  "deploy-service",
  "admin",
];

const SOURCE_IPS = [
  "10.0.1.15",
  "10.0.1.22",
  "10.0.2.100",
  "172.16.0.5",
  "192.168.1.50",
  "203.0.113.42",
  "198.51.100.77",
  "45.33.32.156",
  "91.108.56.200",
  "185.220.101.33",
];

const COUNTRIES = [
  "US",
  "US",
  "US",
  "CA",
  "GB",
  "DE",
  "RU",
  "CN",
  "BR",
  "AU",
];

const USER_AGENTS = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Firefox/121.0",
  "Mozilla/5.0 (X11; Linux x86_64) Chrome/119.0",
  "curl/8.4.0",
  "python-requests/2.31.0",
  "Go-http-client/2.0",
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomTimestamp(hoursBack = 24) {
  const now = Date.now();
  return new Date(
    now - Math.floor(Math.random() * hoursBack * 60 * 60 * 1000)
  ).toISOString();
}

function generateNormalEvents(count) {
  const events = [];
  for (let i = 0; i < count; i++) {
    const action = Math.random() < 0.85 ? "login_success" : "login_failure";
    events.push({
      "@timestamp": randomTimestamp(),
      user: pick(USERS),
      source_ip: pick(SOURCE_IPS.slice(0, 6)),
      action,
      geo: { country: pick(COUNTRIES.slice(0, 5)) },
      user_agent: pick(USER_AGENTS.slice(0, 3)),
    });
  }
  return events;
}

function generateBruteForce() {
  const events = [];
  const targetUser = pick(["alice.chen", "admin", "bob.martinez"]);
  const attackerIp = pick(SOURCE_IPS.slice(6));
  const baseTime = Date.now() - Math.floor(Math.random() * 12 * 60 * 60 * 1000);

  for (let i = 0; i < 15; i++) {
    const offsetMs = i * (10_000 + Math.floor(Math.random() * 20_000));
    events.push({
      "@timestamp": new Date(baseTime + offsetMs).toISOString(),
      user: targetUser,
      source_ip: attackerIp,
      action: i < 13 ? "login_failure" : "login_success",
      geo: { country: pick(COUNTRIES.slice(5)) },
      user_agent: pick(USER_AGENTS.slice(3)),
    });
  }
  return events;
}

function generatePrivilegeEscalations() {
  const events = [];
  for (let i = 0; i < 5; i++) {
    events.push({
      "@timestamp": randomTimestamp(6),
      user: pick(["dave.kumar", "eve.oconnor", "admin"]),
      source_ip: pick(SOURCE_IPS.slice(2, 6)),
      action: "privilege_escalation",
      geo: { country: pick(COUNTRIES.slice(0, 4)) },
      user_agent: pick(USER_AGENTS.slice(0, 3)),
    });
  }
  return events;
}

function generateAccountLockouts() {
  const events = [];
  for (let i = 0; i < 5; i++) {
    events.push({
      "@timestamp": randomTimestamp(12),
      user: pick(["alice.chen", "bob.martinez", "frank.wong"]),
      source_ip: pick(SOURCE_IPS.slice(6)),
      action: "account_lockout",
      geo: { country: pick(COUNTRIES.slice(4)) },
      user_agent: pick(USER_AGENTS.slice(3)),
    });
  }
  return events;
}

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
        "@timestamp": { type: "date" },
        user: { type: "keyword" },
        source_ip: { type: "ip" },
        action: { type: "keyword" },
        geo: {
          properties: {
            country: { type: "keyword" },
          },
        },
        user_agent: { type: "text" },
      },
    },
  });
  console.log(`Created index: ${INDEX}`);

  const events = [
    ...generateNormalEvents(170),
    ...generateBruteForce(),
    ...generatePrivilegeEscalations(),
    ...generateAccountLockouts(),
  ];

  events.sort((a, b) => a["@timestamp"].localeCompare(b["@timestamp"]));

  const operations = events.flatMap((doc) => [{ index: { _index: INDEX } }, doc]);

  const { items } = await client.bulk({ operations, refresh: "wait_for" });
  const failed = items.filter((i) => i.index?.error);
  console.log(
    `Indexed ${items.length - failed.length}/${items.length} events into ${INDEX}`
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
