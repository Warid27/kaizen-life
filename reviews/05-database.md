# Review — Database

> **Reviewed:** 2026-08-23 · Method: full read of `schema.ts` (450 lines), both migrations + journal, seed script; cross-referenced query patterns across all route files. Cloudflare D1 (SQLite) via Drizzle.

## Schema Design

- **LOW — Dates/times as TEXT:** `YYYY-MM-DD` dates and `HH:mm` times throughout (`schema.ts:24-26,82,103-105,...`). Lexicographic comparison works for ISO format and routes rely on it (`tasks.ts:32-33`). Zero-padded `HH:mm` enforced by regex in courses (:32). Pragmatic choice, fragile if formats ever diverge (Excel serial-number dates are the live risk via import — import.ts maps raw cells through Zod only).
- **CRITICAL D1 — Epoch timestamps in TWO units: seed = milliseconds, API = seconds** — CONFIRMED
  - `seed.ts:46-51` `epochMs(...)` -> `d.getTime()` (ms) for ALL `created_at/updated_at/archived_at/completed_at/trigger_at`.
  - Every route writes seconds: `tasks.ts:64,133,178` etc. `Math.floor(Date.now()/1000)`; `reminders.ts:37-38` endOfDay in seconds.
  - Consequence: seeded rows (~1.7e12) rank above all app-created rows (~1.7e9) forever in every `ORDER BY created_at DESC`; seeded `reminders.trigger_at` comparisons wrong by ~1000x.
  - **Fix:** pick seconds; regenerate seed; one-time backfill of remote data.
- **LOW — Denormalization/duplicated state:** `habitLogs.targetCount` snapshots habit target at log time but stats mix old/new targets; `projects.progressPct` hand-maintained never recomputed from tasks; JSON-in-text columns (`tasks.tags`, `habits.customDays`, `monthlyReviews.autoSummaryJson`) unqueryable.
- **MEDIUM (NEEDS-INVESTIGATION) — Money unit ambiguity:** column is `amountCents integer` (good), but seed comment says "nominal Rupiah x 100" (`seed.ts:510`) while pushing raw Rupiah values (`4_500_000` salary -> would be Rp45,000 if truly cents). Decide semantics: rename to minor-units and fix seed, or drop the "cents" fiction. Display math is consistent either way.

## Relationships & Integrity

### DB1. HIGH — Zero foreign keys defined — CONFIRMED
- No `.references()` anywhere in schema.ts; migration SQL confirms plain text columns, no `REFERENCES`. Nothing sets PRAGMA (D1 enables FK enforcement by default, but there is nothing to enforce).
- Orphan-prone edges (parent soft-deletes, children untouched): project delete -> tasks/meetings/standups dangle; course delete -> assignments/schedule/tasks; semester delete -> courses/events; habit delete -> habit_logs + goals.linked_habit_id; client delete -> projects/followups; team member delete -> standups; meeting delete -> action items.
- Only ONE manual cascade in codebase: `goals.ts:239-243` nulls children's parentGoalId.
- User-visible consequence: dashboard joins followups to clients with no parent-deletedAt filter (`dashboard.ts:245`) -> follow-ups of deleted clients still render.
- **Fix:** `.references(..., { onDelete: "set null" })` where sensible + explicit child cleanup per DELETE handler + join filters including parent deletedAt.

## Indexes

Complete inventory of the entire database (CONFIRMED from migration SQL):

| Constraint | Table | Columns |
|---|---|---|
| UNIQUE | checkins | (user_id, date) |
| UNIQUE | diary_entries | (user_id, date) |
| UNIQUE | habit_logs | (habit_id, date) |
| UNIQUE | monthly_reviews | (user_id, year, month) |

That's it — PKs plus these four. **Zero non-unique secondary indexes in the whole database.**

### DB2. HIGH — Every list/dashboard/search endpoint is a full scan
Hot unindexed paths: tasks (`user_id + deleted_at [+ date/status/project]`, ORDER BY date DESC — `tasks.ts:27-45`, `dashboard.ts:61-69,188-207`); transactions (date BETWEEN — `transactions.ts:40-50`, `dashboard.ts:154-162`, reviews); assignments (`ORDER BY due_date`, due-date windows — `dashboard.ts:220-229`); reminders designed for `(status, trigger_at)` polling with no index (`schema.ts:441-446`). Search leading-wildcard LIKE x3 tables inherently unindexable (fine at this scale).
**Fix:** partial indexes e.g. `tasks(user_id, date) WHERE deleted_at IS NULL`; same shape transactions/assignments/standups/meetings; reminders(status, trigger_at).

## N+1 & Expensive Queries

- **HIGH — Write-inside-GET N+1:** `ensureTodayLogs` (`habit-recurrence.ts:81-120`) = one SELECT (+INSERT) per active habit inside `GET /habits` (habits.ts:41). Non-idempotent GET, sequential awaits.
- **HIGH — Reminders loops:** per-habit log lookup loop (:77-88); entire tasks table selected then date/status-filtered in JS (:104-146); same for meetings (:174-198), followups (:149-171), action items (:201-223).
- **MEDIUM — JS-side aggregation instead of SQL:** dashboard 7-day sleep avg (:120-145) and month finance totals (:148-172); reviews finance/habit rollups (:260-282,:314-335); done-count via fetch-all-then-length instead of COUNT(*) (:361-374); computeHabitStats builds a 365-day JS calendar per request (:149-160).
- **MEDIUM — Import:** correct batch-of-100 shape (:634-685) BUT one bad row fails its whole batch after prior batches committed (:674-683) -> partial imports; no db.batch() transactionality; rows bypass unique pre-checks.

## Migrations

- Journal consistent (2 entries, sqlite v6, breakpoints true); 0000 full-create matches schema.ts column-by-column (spot-checked); 0001 ALTER matches. No destructive statements. No current drift. CONFIRMED.
- **MEDIUM — Drift hazard:** `db:push` script targets local file `./kaizenlife.db` bypassing the journal; CI has no `d1 migrations apply --remote` step anywhere -> remote schema maintained by manual ritual (see devops review).

## Unique Constraints

Present: the four listed above. **CONFIRMED gaps below.**

### DB3. HIGH — Unique constraints collide with soft-delete lifecycle
- Habit-log re-create after soft delete: existence check filters `deletedAt IS NULL`, finds nothing, INSERTs -> UNIQUE violation -> **500** (`habits.ts:335-386`; also breaks ensureTodayLogs path).
- Checkins/diary/reviews PUTs find existing row WITHOUT deletedAt filter and never reset it (`checkins.ts:74-88`, `diary.ts:74-88`, `reviews.ts:108-139`) -> update lands on invisible soft-deleted row -> **save silently disappears**.
- **Fix:** partial unique indexes `WHERE deleted_at IS NULL` (raw SQL migration — Drizzle sqlite unique() can't express partial) or always resurrect (`deletedAt: null`) on upsert.

### DB4. MEDIUM — Missing business-key uniqueness
Nothing prevents two standups per member per day (want `UNIQUE(team_member_id, date)`); users.email nullable+non-unique; tasks/transactions have no natural key so import duplicates freely.

## Data Consistency

- **MEDIUM — Guard-dropping writes:** UPDATE/DELETE statements filter `id` only, dropping `userId`/`deletedAt` guards used in preceding SELECTs (~14 handlers: tasks.ts:154-157,180-183; courses.ts:163,195; standups.ts:146,347; meetings.ts:149,175,324,356; clients.ts:124,150,299,331; assignments.ts:166,198; reviews.ts:202,236). Latent authz hole once auth exists.
- Enums via Drizzle `text({enum:[...]})` are TS-only — SQLite accepts any string; free-text category columns fragment analytics on typos/casing. LOW-MEDIUM.
- Soft-delete filtering on reads is otherwise consistently applied (positive), with join-level gaps noted above.

## Top 5 Database Issues

1. CRITICAL — epoch unit mismatch seed(ms) vs runtime(s) corrupting ordering/comparisons (`seed.ts:46-51` vs `tasks.ts:64`).
2. HIGH — zero FKs / no cascade strategy -> orphaned children on every parent soft-delete; joins ignore parent deletedAt.
3. HIGH — unique-vs-soft-delete collisions: 500s on habit-log re-create; silently lost saves for checkins/diary/reviews.
4. HIGH — zero secondary indexes: every hot query full-scans.
5. MEDIUM — N+1/scan-then-filter patterns (ensureTodayLogs, reminders, JS-side SUM/COUNT).
