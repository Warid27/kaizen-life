# Review — Backend API & Error Handling

> **Reviewed:** 2026-08-23 · Method: subagent audit of all 20 route modules + cross-check against frontend query layer. Status labels included per finding.

## Endpoint Wiring

### B1. CRITICAL — Frontend calls endpoints that do not exist server-side — CONFIRMED
- `GET /api/stats/overview` (`queries/stats.ts:66`) — no stats router registered (`index.ts:52-71` mounts 19 routers, none named stats). Stats page runs entirely on `Math.random()` demo fallbacks.
- Monthly reviews unreachable: web calls `GET/PUT /api/reviews/${month}` where month = `"2026-08"` (`queries/review.ts:44,57`) but server defines two-segment paths `"/reviews/:year/:month"` (`reviews.ts:53,86`) -> guaranteed 404. Save silently swallowed; fake review rendered as real (`ReviewApp.tsx:94`).
- Settings/backups/export: `/api/settings`, `/api/backups`, `/api/export/json` called by `queries/settings.ts:76-130` have no server implementation -> Settings page fully demo-backed too.
- Several GET-by-date paths consumed by islands (e.g. `queries/checkin.ts:31`, `diary.ts:29`) do not match server registrations.
- **Why it matters:** silent 404s + demo fallbacks make broken features indistinguishable from working ones.
- **Fix:** contract test (or generated client from shared/OpenAPI spec) failing CI on path drift; implement missing endpoints or remove the pages.

### B2. HIGH — Reviews PUT requires body fields duplicating path params
`UpdateReviewSchema` requires numeric `year`/`month` in the body (`schemas/monthlyReview.ts:4-11`; enforced `reviews.ts:95-104`) even though both arrive in the path — any compliant REST caller gets 400.

## Validation

- **PASS overall:** universal validation (manual safeParse or zValidator) — see security review §4.
- **MEDIUM — Validation mechanism split:** `zValidator` middleware (transactions, assignments) vs inline `safeParse` (habits, clients, standups, capture, search...) -> inconsistent error shapes (see B4).
- **MEDIUM — `UpdateTaskSchema` accepts arbitrary strings for `date`/`startTime`/`endTime`** (`schemas/task.ts:14-15`; applied `tasks.ts:139-141`) while `QuickCaptureSchema` regex-validates them. `"next Tuesday"` or `date:"25:99"` accepted via POST/PATCH /tasks -> malformed dates poison calendar queries silently.
- **MEDIUM — `custom_days` habits without valid `customDays` become zombies:** schema allows `customDays` nullable/optional with no JSON/array refinement (`schemas/habit.ts:16`); recurrence treats parse failure as never-scheduled with `catch { return false }` (`habit-recurrence.ts:40-47`). Habit created but invisible in due lists, never completable.
- **MEDIUM — No referential validation on most writes:** `assignments.ts:91-116` (courseId unchecked), `courses.ts:91-115` (semesterId unchecked), `tasks.ts:67-87` (projectId/courseId unchecked); zero FKs at DB level. Only goals validate parents (`goals.ts:113-129`). Orphan rows render forever (see database review).
- **MEDIUM — Semesters lack range sanity:** no `.refine(endDate > startDate)` (`semesters.ts:17-34`); reversed ranges accepted; semester-progress math then clamps weirdly. Assignments may sit outside their semester's range unchecked.
- **LOW — Length drift:** capture title max 200 vs task title max 500; Zod maxes vs unbounded TEXT columns (DB looser than app everywhere — consistent direction, but task date gap above is real).

## State Machine & Write Logic

- **MEDIUM — `completedAt` never cleared/re-stamped:** leaving `done` keeps stale timestamp; re-completing keeps old one (`tasks.ts:144-149`) -> invalid state `status='todo', completedAt=X`; any future completed-this-month metric keyed on completedAt is corrupted.
- **MEDIUM — Soft-delete resurrection bugs:** checkin/diary PUT existence checks ignore `deletedAt` and never reset it (`checkins.ts:74-88`, `diary.ts:74-88`) -> update hits an invisible soft-deleted row and the save silently disappears; same pattern reviews (`reviews.ts:108-139`).
- **MEDIUM — Habit log re-create after soft delete = UNIQUE violation 500** (`habits.ts:335-345` checks `deletedAt IS NULL`, finds nothing, INSERTs against `UNIQUE(habit_id,date)`).
- **LOW — Increment cap uses frozen log target:** `Math.min(existing.completedCount + increment, existing.targetCount)` uses the log row's snapshot target, not current habit target (`habits.ts:351-354`) -> lowering a target leaves old rows over target forever.
- **LOW — Assignment transitions unguarded:** `not_started -> graded` legal; grade settable while not started; status can regress from graded (`assignments.ts:120-171`). Overdue exists only UI-side.

## Import Pipeline (largest route, 643 lines)

- **HIGH — Partial commits on failure:** batches of 100 inserted sequentially; one bad row fails its whole batch AFTER earlier batches committed (`import.ts:674-684`) -> partial import, no rollback; error message mislabels offending Excel row (`row: i + 1`).
- **HIGH — No upserts/dedup for naturally-keyed entities:** re-import duplicates tasks/transactions/etc. (only habit_logs/checkins/diary/monthly_reviews have unique keys) -> double expenses on retry.
- **MEDIUM — In-memory session Map breaks across Worker isolates** (upload and execute may hit different isolates -> intermittent "Session not found") — feature unreliable in prod by design.
- **MEDIUM — `TABLE_MAP` includes `users`** — public write path into user table (see security review S7).

## Error Handling

### B4. HIGH — Three incompatible error envelopes (architecture cross-ref)
`habits.ts` `{error:{code,message,field?}}` + `{data}` wrapping (:84-91) vs `transactions.ts`/`clients.ts` `{error:"string"}` + raw rows (:26-29,:175) vs dashboard `{error:{code:"INTERNAL"}}` (:280-284). Blocks any unified client error handling.

### B5. MEDIUM — PATCH/DELETE WHERE clauses drop guards
UPDATE/DELETE statements filter `WHERE id = ?` only, losing `userId` + `deletedAt` guards present in the preceding SELECT — same pattern across `tasks.ts:154-157,180-183`, `courses.ts:163,195`, `semesters.ts:154,186`, `standups.ts:146,347`, `meetings.ts:149,175,324,356`, `clients.ts:124,150,299,331`, `assignments.ts:166,198`, `reviews.ts:202,236`. Harmless while single hardcoded user; becomes an authorization hole the moment auth lands.

### B6. HIGH — Health endpoints don't check health
`/status` hardcodes `"Database": { status: "ok" }` without touching D1 — no `SELECT 1` (`health.ts:53-58,25-72`). `process.memoryUsage()` in a Worker reports isolate-local numbers; uptime is per-isolate and resets constantly. Monitoring built on this would be fiction.

### B7. MEDIUM — Search endpoint weaknesses
No result LIMIT, unescaped LIKE wildcards, missing userId scope (`search.ts:22-58`) — cheap full-scan DoS vector on a public endpoint.

## Done Well

- Parameterized queries everywhere (zero SQLi).
- Universal body/query validation; explicit field mapping (no mass assignment).
- Consistent soft-delete filtering on list reads across all routes.
- Currency-aware summary aggregation done correctly in `transactions.ts:101-150` (per-currency buckets) — though consumers were never updated (see business-logic review C3).
- Batched import insert strategy itself (batches of 100) is structurally right; transactionality around it is what's missing.

## Top 5 Backend Issues

1. CRITICAL — endpoints called by the UI that don't exist (stats/settings/backups/review paths).
2. HIGH — soft-delete resurrection bugs silently losing saves + UNIQUE-violation 500s.
3. HIGH — health check lies about DB; combined with zero observability you fly blind.
4. HIGH — guard-dropping UPDATE/DELETE WHERE clauses (latent authz hole).
5. MEDIUM — validation gaps: task date strings, custom_days zombies, semester ranges, referential integrity on writes.
