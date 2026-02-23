import apm from "elastic-apm-node/start.js";

apm.start({
  serviceName: "orders-service",
  serverUrl: process.env.APM_SERVER_URL || "http://localhost:8200",
  secretToken: process.env.APM_SECRET_TOKEN || "",
  environment: process.env.NODE_ENV || "development",
  captureBody: "all",
});

import crypto from "node:crypto";
import { createWriteStream } from "node:fs";
import express from "express";
import pino from "pino";

const logger = pino(
  { level: "info" },
  pino.multistream([
    { stream: process.stdout },
    { stream: createWriteStream("app.log", { flags: "a" }) },
  ])
);

const app = express();
app.use(express.json());

app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    logger.info({
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration_ms: Date.now() - start,
    });
  });
  next();
});

const orders = [
  { id: "ord-001", customer: "alice", item: "Elasticsearch license", amount: 4200, status: "shipped" },
  { id: "ord-002", customer: "bob", item: "Kibana dashboard pack", amount: 1500, status: "pending" },
  { id: "ord-003", customer: "carol", item: "APM agent support", amount: 800, status: "delivered" },
];

function randomDelay(min, max) {
  return new Promise((resolve) => setTimeout(resolve, min + Math.random() * (max - min)));
}

app.get("/api/orders", async (_req, res) => {
  await randomDelay(10, 80);
  res.json(orders);
});

app.get("/api/orders/:id", async (req, res) => {
  await randomDelay(50, 600);
  const order = orders.find((o) => o.id === req.params.id);
  if (!order) {
    logger.warn({ orderId: req.params.id }, "order not found");
    return res.status(404).json({ error: "not found" });
  }
  res.json(order);
});

app.post("/api/orders", async (req, res) => {
  await randomDelay(20, 150);
  const order = {
    id: `ord-${crypto.randomBytes(4).toString("hex")}`,
    customer: req.body.customer || "anonymous",
    item: req.body.item || "unknown",
    amount: req.body.amount || 0,
    status: "pending",
  };
  orders.push(order);
  logger.info({ orderId: order.id }, "order created");
  res.status(201).json(order);
});

app.get("/api/error", () => {
  throw new Error("Deliberate error for APM error tracking demo");
});

app.use((err, _req, res, _next) => {
  logger.error({ err }, "unhandled error");
  apm.captureError(err);
  res.status(500).json({ error: err.message });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info({ port: PORT }, "orders-service started");
});
