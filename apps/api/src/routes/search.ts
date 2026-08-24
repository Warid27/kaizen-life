import { Hono } from "hono";
import { SearchQuerySchema } from "@kaizenlife/shared";
import { and, or, isNull, eq, sql } from "drizzle-orm";
import type { Column } from "drizzle-orm";
import type { Bindings, AppDb } from "../db/client";
import { tasks, assignments, projects } from "../db/schema";
import { apiError } from "../lib/api";

type RouteEnv = { Bindings: Bindings; Variables: { db: AppDb; userId: string } };

const search = new Hono<RouteEnv>();

// Per-table cap: search used to be three unbounded full scans (S3/B7).
const PER_TABLE_LIMIT = 20;

/** Escape LIKE wildcards so `q=%` can't force degenerate scans. */
function escapeLike(input: string): string {
  return input.replace(/[\\%_]/g, "\\$&");
}

/** Parameterized LIKE with an explicit ESCAPE clause (Drizzle's like() lacks one). */
function likeSafe(col: Column, pattern: string) {
  const escape = String.fromCharCode(92); // single backslash
  return sql`${col} LIKE ${pattern} ESCAPE ${escape}`;
}

// GET /search?q= — Command Palette search across tasks, assignments, projects
search.get("/search", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const parsed = SearchQuerySchema.safeParse({ q: c.req.query("q") });

  if (!parsed.success) {
    return apiError(c, 400, "VALIDATION_ERROR", "Validation failed", parsed.error.flatten());
  }

  const q = `%${escapeLike(parsed.data.q)}%`;

  // Search tasks (exclude deleted, scoped to user)
  const matchedTasks = (await db
    .select({
      id: tasks.id,
      title: tasks.title,
      type: tasks.status,
    })
    .from(tasks)
    .where(and(or(likeSafe(tasks.title, q), likeSafe(tasks.description, q)), eq(tasks.userId, userId), isNull(tasks.deletedAt)))
    .limit(PER_TABLE_LIMIT)
    .all())
    .map((t) => ({ ...t, kind: "task" as const }));

  // Search assignments (exclude deleted, scoped to user)
  const matchedAssignments = (await db
    .select({
      id: assignments.id,
      title: assignments.title,
      type: assignments.status,
    })
    .from(assignments)
    .where(
      and(
        or(likeSafe(assignments.title, q), likeSafe(assignments.description, q)),
        eq(assignments.userId, userId),
        isNull(assignments.deletedAt),
      ),
    )
    .limit(PER_TABLE_LIMIT)
    .all())
    .map((a) => ({ ...a, kind: "assignment" as const }));

  // Search projects (exclude deleted, scoped to user)
  const matchedProjects = (await db
    .select({
      id: projects.id,
      title: projects.name,
      type: projects.status,
    })
    .from(projects)
    .where(
      and(
        or(likeSafe(projects.name, q), likeSafe(projects.description, q)),
        eq(projects.userId, userId),
        isNull(projects.deletedAt),
      ),
    )
    .limit(PER_TABLE_LIMIT)
    .all())
    .map((p) => ({ ...p, kind: "project" as const }));

  const results = [...matchedTasks, ...matchedAssignments, ...matchedProjects];

  return c.json({ results, total: results.length });
});

export default search;
