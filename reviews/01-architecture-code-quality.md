# Review — Architecture & Code Quality

> **Reviewed:** 2026-08-23 · Method: subagent audit, verified against source (not docs).
> Stack: Bun workspaces. `apps/api` = Hono on Cloudflare Workers + D1/Drizzle (~20 flat route modules). `apps/web` = Astro static + React islands + TanStack Query + Zustand. `packages/shared` = Zod schemas.

## Layering

**CONFIRMED:** exactly ONE service exists (`services/habit-recurrence.ts`). The other ~19 route modules are self-contained: validation -> inline Drizzle -> `c.json`. No repository layer anywhere.

| Route | Validation | Data access | Notes |
|---|---|---|---|
| `routes/transactions.ts` | `zValidator` middleware (:24-31) | inline Drizzle (:46-51) | spreads body into insert |
| `routes/clients.ts` | manual `safeParse` (:55-63) | inline Drizzle | hand-copies PATCH fields (:114-119) |
| `routes/habits.ts` | manual `safeParse` + try/catch (:74-125) | inline Drizzle + the one service (:41,:405) | wraps responses `{data}` |
| `routes/dashboard.ts` | none (GET) | **8 sequential inline queries** in one handler (:64-254) | aggregation inline |

### A1. HIGH — Service/repository fused; writes inside a GET
- **Location:** `habit-recurrence.ts:67-117`; invoked from `habits.ts:41`.
- `ensureTodayLogs` runs SELECT + possible INSERT per active habit inside `GET /habits` — sequential awaits (N+1 round trips), non-idempotent read, race-prone under concurrency (unique index prevents dup rows but not wasted work/errors).
- **Fix:** extract query layer; move recurrence materialization to scheduled trigger or one batched `IN` existence check.

### A2. HIGH — `USER_ID = "default-user"` duplicated across 18 route files
- e.g. `capture.ts:27` (with `// TODO: replace with auth session user`), `tasks.ts:9`, `clients.ts:15`, `dashboard.ts:18`, `import.ts:41`, `seed.ts:29`; `habits.ts:19` uses `DEFAULT_USER_ID`.
- When auth arrives this is an 18-file shotgun edit with high miss risk.
- **Fix:** single middleware setting `c.set("userId", ...)`.

## Shared Package Value

**Genuinely dual-used (positive):** 33 import sites; 15 API route files validate via `@kaizenlife/shared`; web queries/islands import inferred types (e.g. `queries/habits.ts:3-10`, `islands/HabitsApp.tsx:29`).

### A3. CRITICAL — Finance contract drift (runtime-breaking)
- Shared `CreateTransactionSchema` requires `account: z.enum(["cash","bank"])`, has `note?` (`packages/shared/src/schemas/transaction.ts:9-17`).
- Web hand-writes its own `CreateTransaction` interface with `description`, **no `account`** (`queries/finance.ts:20-27`); FinanceApp submits exactly that (`FinanceApp.tsx:639-646`).
- Result: every UI transaction creation returns 400; `description` silently stripped. Also drifts: `createdAt: string` claimed vs epoch-seconds number returned (`transactions.ts:197`); `MonthlySummary.dailyBalance` never returned by `/finance/summary` (`transactions.ts:141-151`) so charts only work via demo-data fallback; date filters named `startDate/endDate` vs API's `from/to` (`finance.ts:29-33`) — silently ignored server-side.
- **Fix:** delete web-side duplicate interfaces; derive types from shared package; add CI type-level check (or tRPC/OpenAPI derivation).

### A4. MEDIUM — College domain bypasses shared entirely
No semester/course/assignment schemas in shared; `assignments.ts:17-31` (and courses/semesters) define local Zod schemas while `queries/college.ts:4-69` hand-writes 5 mirrored interfaces ("not in @kaizenlife/shared"). Same drift pattern waiting to happen.

### A5. LOW — Dead export
`UserSchema`/`User` (`shared/src/schemas/user.ts`) imported nowhere.

## Coupling & Duplication

- **MEDIUM — Per-route boilerplate x20:** router type annotation, USER_ID, `now = Math.floor(Date.now()/1000)`, `crypto.randomUUID()`, ownership-check->mutate->soft-delete sequence re-implemented per module (compare `transactions.ts:236-298` vs `clients.ts:136-154`).
- **MEDIUM — Date utilities duplicated >=15x:** `todayStr()` in `dashboard.ts:21`, `habits.ts:22`, `reminders.ts:19`, `stores/ui.ts:32`, `FinanceApp.tsx:65`, `CheckinApp.tsx:28`, `WorkApp.tsx:106`; `formatDate` variants in `habit-recurrence.ts:12`, `DiaryApp.tsx:36`, `DeadlinesCard.tsx:29`, `FollowupsCard.tsx:28`. None live in packages/shared. Several copies are subtly WRONG (UTC vs local — see business-logic review).
- **LOW — Copy-pasted invalidation blocks:** `invalidateQueries` counts — work.ts 47, college.ts 29, habits.ts 11, tasks.ts 7; every mutation repeats `qc.invalidateQueries({queryKey:['dashboard']})` (`queries/habits.ts:77-121`).

## Dead Code / Orphans (verified)

| Item | Verdict |
|---|---|
| `routes/clients.ts` + clients UI | NOT dead — full vertical exists (route, hooks `work.ts:145+`, WorkApp island :827, page `work/clients.astro`, nav link) |
| teamMember endpoints | Used but misplaced — live inside `standups.ts:23-180`, consumed by `WorkApp.tsx:153` |
| Dependencies | None unused (xlsx, chart.js, cva, zustand, clsx/twMerge all consumed) |
| `audit-report.md` (2026-08-09) | STALE/MISLEADING — still "Status: FAIL", but finding #1 fixed (`finance.ts:63` hits `/api/transactions`), #3 fixed (`WorkApp.tsx:376`), hydration fixed in commit f1b2777 |
| `scenario.md` | Leftover test script from same round |
| `specs/active/restructuring-folder/plan.md` | Executed but unarchived — repo is already the consolidated main-branch monorepo it planned for; belongs in `specs/completed/` |

## Consistency

### A6. HIGH — Three incompatible error envelopes in production code
- `habits.ts`: `{error:{code,message,field?}}`, success wrapped `{data}` (:84-91)
- `transactions.ts`/`clients.ts`: `{error:"string", details?}`, raw row bodies (:26-29,:175)
- `dashboard.ts`:500: `{error:{code:"INTERNAL",...}}` (:280-284)
Validation also splits: `zValidator` middleware (transactions, assignments) vs inline `safeParse` (habits, clients, standups). Consequence: `api-client.ts` can only throw opaque `ApiError(status, body)` — no client-wide error rendering possible without per-hook branching.

**TS strictness PASS:** api + shared `strict:true` + `noUncheckedIndexedAccess`; web extends `astro/tsconfigs/strict`. One leak: `status as any` (`assignments.ts:44`). Import styles consistent per-app. Naming kebab-case except team-members-inside-standups.

## Scalability Verdict

What breaks first at 10x features:
1. Contract-drift compounding — college + finance prove each new domain tends toward hand-mirrored types; at 10x you get N parallel "sources of truth" and silent UI breakage as the default failure mode.
2. Auth retrofit — 18 hardcoded USER_IDs + user-scoping interleaved with SQL in every handler.
3. Envelope divergence — blocks any global toast/error/loading layer.
4. GET-with-writes recurrence engine degrades under concurrent list fetches.
5. Zero route/integration tests mean the eventual refactor happens blind.

## Done Well (honest positives)

1. Zod-as-shared-contract architecture — right model, mostly executed.
2. Disciplined soft-delete + multi-tenant-shaped queries — `deletedAt IS NULL` and userId filters applied consistently across route reads even pre-auth.
3. Clean infra seams — generic typed `api-client.ts` with `ApiError(status,body)`; db injected via Hono context middleware (`index.ts:46-49`); strict TS everywhere including Astro; currency-aware summary aggregation refusing to mix currencies (`transactions.ts:101-139`).

## Top 5 Debt Issues

1. CRITICAL — finance CreateTransaction contract drift (UI create broken against current schema).
2. HIGH — no service/repository boundary; 18x duplicated USER_ID makes auth a risky shotgun change.
3. HIGH — three incompatible error envelopes + split success wrapping across 20 modules.
4. HIGH — entire college domain + finance interfaces bypass the shared package.
5. MEDIUM — test coverage ~0% for API/web; stale audit/spec docs asserting FAIL states that were fixed.
