import client from "prom-client";

client.collectDefaultMetrics();

export const register = client.register;

export const httpDuration = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request duration",
  labelNames: ["method", "route", "status"],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5]
});

export const httpInFlight = new client.Gauge({
  name: "http_requests_in_flight",
  help: "Number of HTTP requests currently being processed",
  labelNames: ["route"]
});
export const mongoDuration = new client.Histogram({
  name: "mongo_query_duration_seconds",
  help: "MongoDB query duration",
  labelNames: ["operation", "collection"],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2]
});

export const redisDuration = new client.Histogram({
  name: "redis_command_duration_seconds",
  help: "Redis command duration",
  labelNames: ["command"],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5]
});

export const queueDepth = new client.Gauge({
  name: "bullmq_queue_jobs",
  help: "BullMQ job counts by queue and state",
  labelNames: ["queue", "state"] // state: waiting | active | completed | failed | delayed
});
