import { Hono } from "hono";
import { APP_VERSION, APP_NAME } from "../version";
import type { Bindings, AppDb } from "../db/client";

const health = new Hono<{ Bindings: Bindings; Variables: { db: AppDb } }>();
const startTime = Date.now();

health.get("/health", (c) => {
  const uptimeMs = Date.now() - startTime;
  return c.json({
    status: "ok",
    app: APP_NAME,
    version: APP_VERSION,
    // Per-isolate uptime: Workers isolate constantly — informational only.
    isolateUptimeMs: uptimeMs,
    timestamp: new Date().toISOString(),
  });
});

// Detailed status endpoint — actually verifies the D1 binding with SELECT 1
// (was previously hardcoded "ok" without touching the database: B6/D11).
health.get("/status", async (c) => {
  const uptimeMs = Date.now() - startTime;
  const startedAt = new Date(startTime).toISOString();

  let dbOk = false;
  let dbLatencyMs: number | null = null;
  try {
    const t0 = Date.now();
    const result = await c.env.DB.prepare("SELECT 1 AS one").first<{ one: number }>();
    dbLatencyMs = Date.now() - t0;
    dbOk = result?.one === 1;
  } catch {
    dbOk = false;
  }

  return c.json(
    {
      app: {
        name: APP_NAME,
        version: APP_VERSION,
        status: dbOk ? "operational" : "degraded",
        isolateUptimeMs: uptimeMs,
        startedAt,
      },
      environment: c.env?.ENVIRONMENT || "development",
      timestamp: new Date().toISOString(),
      components: [
        {
          name: "Application",
          value: APP_NAME,
          status: "ok",
          version: APP_VERSION,
        },
        {
          name: "Database",
          value: "D1",
          status: dbOk ? "ok" : "unreachable",
          type: "Cloudflare D1",
          latencyMs: dbLatencyMs,
          checkedWith: "SELECT 1",
        },
      ],
    },
    dbOk ? 200 : 503,
  );
});

export default health;
