import { Hono } from "hono";
import { QuickCaptureSchema } from "@kaizenlife/shared";
import type { Bindings, AppDb } from "../db/client";
import { tasks } from "../db/schema";
import { apiError } from "../lib/api";

const capture = new Hono<{ Bindings: Bindings; Variables: { db: AppDb; userId: string } }>();

// POST /capture — Quick Capture: create a task with just a title
capture.post("/capture", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const parsed = QuickCaptureSchema.safeParse(await c.req.json());

  if (!parsed.success) {
    return apiError(c, 400, "VALIDATION_ERROR", "Validation failed", parsed.error.flatten());
  }

  const data = parsed.data;
  const now = Math.floor(Date.now() / 1000);
  const id = crypto.randomUUID();

  const values = {
    id,
    userId,
    title: data.title,
    description: data.description ?? null,
    date: data.date ?? null,
    startTime: data.startTime ?? null,
    endTime: data.endTime ?? null,
    estimatedDurationMin: data.estimatedDurationMin ?? null,
    priority: data.priority ?? ("medium" as const),
    status: "todo" as const,
    projectId: data.projectId ?? null,
    courseId: data.courseId ?? null,
    tags: data.tags ?? null,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };

  await db.insert(tasks).values(values).run();

  return c.json({ task: values }, 201);
});

export default capture;
