import { Hono } from "hono";
import { SearchQuerySchema } from "@kaizenlife/shared";
import type { Bindings, AppDb } from "../db/client";
import { tasks, assignments, projects } from "../db/schema";
import { and, like, or, isNull } from "drizzle-orm";

const search = new Hono<{ Bindings: Bindings; Variables: { db: AppDb } }>();

// GET /search?q= — Command Palette search across tasks, assignments, projects
search.get("/search", async (c) => {
  const db = c.get("db");
  const raw = c.req.query("q");
  const parsed = SearchQuerySchema.safeParse({ q: raw });

  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", issues: parsed.error.issues },
      400,
    );
  }

  const q = `%${parsed.data.q}%`;

  // Search tasks (exclude deleted)
  const matchedTasks = (await db
    .select({
      id: tasks.id,
      title: tasks.title,
      type: tasks.status,
    })
    .from(tasks)
    .where(and(or(like(tasks.title, q), like(tasks.description, q)), isNull(tasks.deletedAt)))
    .all())
    .map((t) => ({ ...t, kind: "task" as const }));

  // Search assignments (exclude deleted)
  const matchedAssignments = (await db
    .select({
      id: assignments.id,
      title: assignments.title,
      type: assignments.status,
    })
    .from(assignments)
    .where(and(or(like(assignments.title, q), like(assignments.description, q)), isNull(assignments.deletedAt)))
    .all())
    .map((a) => ({ ...a, kind: "assignment" as const }));

  // Search projects (exclude deleted)
  const matchedProjects = (await db
    .select({
      id: projects.id,
      title: projects.name,
      type: projects.status,
    })
    .from(projects)
    .where(and(or(like(projects.name, q), like(projects.description, q)), isNull(projects.deletedAt)))
    .all())
    .map((p) => ({ ...p, kind: "project" as const }));

  const results = [...matchedTasks, ...matchedAssignments, ...matchedProjects];

  return c.json({ results, total: results.length });
});

export default search;
