import { Hono } from "hono";
import { Bindings, AppDb, createDb } from "./db/client";
import health from "./routes/health";
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

type Variables = { db: AppDb };

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// ─── Middleware: inject D1-backed db into context ────────────────────────────
app.use("*", async (c, next) => {
  c.set("db", createDb(c.env));
  await next();
});

// ─── API Routes ──────────────────────────────────────────────
app.route("/api", health);
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

export default app;
