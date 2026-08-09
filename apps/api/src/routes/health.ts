import { Hono } from "hono";
import { APP_VERSION, APP_NAME } from "../version";

const health = new Hono();
const startTime = Date.now();

health.get("/health", (c) => {
  const uptimeMs = Date.now() - startTime;
  const uptimeSec = Math.floor(uptimeMs / 1000);
  const hours = Math.floor(uptimeSec / 3600);
  const minutes = Math.floor((uptimeSec % 3600) / 60);
  const seconds = uptimeSec % 60;

  return c.json({
    status: "ok",
    app: APP_NAME,
    version: APP_VERSION,
    uptime: `${hours}h ${minutes}m ${seconds}s`,
    uptimeMs,
    timestamp: new Date().toISOString(),
  });
});

// Detailed status endpoint
health.get("/status", (c) => {
  const uptimeMs = Date.now() - startTime;
  const uptimeSec = Math.floor(uptimeMs / 1000);
  const hours = Math.floor(uptimeSec / 3600);
  const minutes = Math.floor((uptimeSec % 3600) / 60);
  const seconds = uptimeSec % 60;

  const startedAt = new Date(startTime).toISOString();
  const memUsage = process.memoryUsage();

  return c.json({
    app: {
      name: APP_NAME,
      version: APP_VERSION,
      status: "operational",
      uptime: `${hours}h ${minutes}m ${seconds}s`,
      uptimeMs,
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
        status: "ok",
        type: "Cloudflare D1",
      },
      {
        name: "Runtime",
        value: "Cloudflare Workers",
        status: "ok",
        type: "Edge",
      },
    ],
    memory: {
      heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024 * 100) / 100} MB`,
      heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024 * 100) / 100} MB`,
      rss: `${Math.round(memUsage.rss / 1024 / 1024 * 100) / 100} MB`,
    },
  });
});

export default health;
