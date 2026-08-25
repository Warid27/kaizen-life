import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { createDb } from "./db/client";
import type { Bindings, AppDb } from "./db/client";
import { userIdMiddleware } from "./middleware/auth";
import { apiError } from "./lib/api";
import health from "./routes/health";
import auth from "./routes/auth";
import capture from "./routes/capture";
import search from "./routes/search";
import checkins from "./routes/checkins";
import diary from "./routes/diary";
import tasks from "./routes/tasks";
import habitsRouter from "./routes/habits";
import dashboardRouter from "./routes/dashboard";
import coursesRouter from "./routes/courses";
import assignmentsRouter from "./routes/assignments";
import semestersRouter from "./routes/semesters";
import projectsRouter from "./routes/projects";
import clientsRouter from "./routes/clients";
import standupsRouter from "./routes/standups";
import meetingsRouter from "./routes/meetings";
import transactionsRouter from "./routes/transactions";
import goalsRouter from "./routes/goals";
import reviewsRouter from "./routes/reviews";
import remindersRouter from "./routes/reminders";
import importRouter from "./routes/import";
import statsRouter from "./routes/stats";
import settingsRouter from "./routes/settings";
import exportRouter from "./routes/export";
import pushRouter from "./routes/push";
import { handleScheduled } from "./cron";

type Variables = { db: AppDb; userId: string };

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// ─── Middleware: baseline security headers ───────────────────────────────────
app.use("*", secureHeaders());

// ─── Middleware: CORS (web app lives on a different origin in prod) ──────────
// Localhost origins are only allowed when ENVIRONMENT !== "production" (S5).
app.use(
  "*",
  async (c, next) => {
    const isProd = c.env.ENVIRONMENT === "production";
    const origins = [
      "https://kaizen-life.warid.web.id",
      "https://kaizenlife-app.pages.dev",
      ...(isProd ? [] : ["http://localhost:4321", "http://localhost:3001"]),
    ];
    return cors({
      origin: origins,
      allowMethods: ["GET", "POST", "PATCH", "DELETE", "PUT", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization"],
      // Sessions ride a cookie on the API origin; the web app is a different
      // origin, so cross-origin fetches need credentials + exact origins.
      credentials: true,
      maxAge: 86400,
    })(c, next);
  },
);

// ─── Middleware: never let proxies/browsers cache personal API data (P8) ─────
app.use("/api/*", async (c, next) => {
  await next();
  c.header("Cache-Control", "private, no-store");
});

// ─── Middleware: inject D1-backed db into context ────────────────────────────
app.use("*", async (c, next) => {
  c.set("db", createDb(c.env));
  await next();
});

// ─── Middleware: per-request identity (+ optional bearer-token gate) ─────────
app.use("*", userIdMiddleware);

// ─── Unified error envelope for uncaught errors (A6/B4) ──────────────────────
app.onError((err, c) => {
  console.error(`[api] ${c.req.method} ${c.req.path}:`, err);
  return apiError(c, 500, "INTERNAL", "Internal server error");
});

// ─── API Routes ──────────────────────────────────────────────
app.route("/api", health);
app.route("/api", auth);
app.route("/api", capture);
app.route("/api", search);
app.route("/api", checkins);
app.route("/api", diary);
app.route("/api", tasks);
app.route("/api", habitsRouter);
app.route("/api", dashboardRouter);
app.route("/api", coursesRouter);
app.route("/api", assignmentsRouter);
app.route("/api", semestersRouter);
app.route("/api", projectsRouter);
app.route("/api", clientsRouter);
app.route("/api", standupsRouter);
app.route("/api", meetingsRouter);
app.route("/api", transactionsRouter);
app.route("/api", goalsRouter);
app.route("/api", reviewsRouter);
app.route("/api", remindersRouter);
app.route("/api", importRouter);
app.route("/api", statsRouter);
app.route("/api", settingsRouter);
app.route("/api", exportRouter);
app.route("/api", pushRouter);

export default {
  fetch: app.fetch,
  // Cron Triggers (wrangler.toml): due reminders + daily digest push delivery.
  scheduled: handleScheduled,
};
