const BASE = process.env.BASE_URL || "http://localhost:3000";
const DURATION_MS = 60_000;
const ORDER_IDS = ["ord-001", "ord-002", "ord-003", "ord-999"];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDelay(min, max) {
  return new Promise((resolve) => setTimeout(resolve, min + Math.random() * (max - min)));
}

async function request(method, path, body) {
  const url = `${BASE}${path}`;
  const opts = { method, headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);

  try {
    const res = await fetch(url, opts);
    const data = await res.text();
    console.log(`${res.status} ${method} ${path} — ${data.slice(0, 120)}`);
  } catch (err) {
    console.error(`ERR  ${method} ${path} — ${err.message}`);
  }
}

const actions = [
  () => request("GET", "/api/orders"),
  () => request("GET", `/api/orders/${pick(ORDER_IDS)}`),
  () => request("POST", "/api/orders", { customer: "demo-user", item: "Widget", amount: Math.floor(Math.random() * 500) }),
  () => request("GET", "/api/error"),
];

async function run() {
  const end = Date.now() + DURATION_MS;
  let count = 0;

  console.log(`Generating traffic against ${BASE} for ${DURATION_MS / 1000}s...`);

  while (Date.now() < end) {
    await pick(actions)();
    count++;
    await randomDelay(200, 1500);
  }

  console.log(`Done. Sent ${count} requests.`);
}

run();
