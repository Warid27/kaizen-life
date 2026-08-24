# Review — Testing

> **Reviewed:** 2026-08-23 · Method: repo-wide test inventory, full read of both test files + vitest config + setup, `bun run test` executed (66/66 pass, ~7s), CI workflow inspection.

## Inventory

| Item | Fact |
|---|---|
| Test files | **2 total** (repo-wide): `packages/shared/src/schemas/import.test.ts` (36 tests), `import-logic.test.ts` (30 tests). Zero spec files. |
| Cases | 66 `it(` / 21 `describe(` — all green. |
| Config | Single flat `vitest.config.ts`; `globals: true`; jsdom for EVERYTHING; one shared setup; alias to packages/shared. Coverage v8 includes only `packages/shared/src/**/*.ts` + `apps/web/src/**/*.tsx` — **excludes web lib/*.ts and ALL of apps/api/**. |
| Setup | `apps/web/src/test-setup.ts` mocks matchMedia/IntersectionObserver/ResizeObserver/scrollTo/createObjectURL — ready for component tests that don't exist. |

## Quality of Existing Tests

- `import.test.ts` — genuinely good: real assertions against production schemas, happy path + rejections (bad dates, negative amounts, enum/range violations), default pinning, meta-consistency checks across the 22-entity maps (:356-395). No mocking needed.
- `import-logic.test.ts` — **~60% is a shadow test that can never fail on production regressions**: re-implements `validateFile` inline (:17-34) instead of importing the route's version (`import.ts`), duplicates column-mapping loop (:190-260), session Map/TTL cleanup (:266-314), batching loop (:367-405), cents rounding (:328-344). Only the XLSX parse round-trip exercises third-party code.
- Weakest cases: `expect(now).toBeGreaterThan(0)`, randomUUID uniqueness x2 — testing Node/V8, not KaizenLife.

## Coverage Gap Analysis vs Risk Surface

**(a) API routes — 20 files, ~4,900 lines, ZERO tests. CONFIRMED.** Most critical five to test first:
1. POST /transactions (money math, custom zValidator error handlers :24,:63,:186,:221)
2. Habit checkin/streak path (writes keyed by server date)
3. Import flow (upload->preview->commit, largest file 643 lines)
4. GET /dashboard/today (fan-out feeding home screen)
5. POST /reviews/generate/:year/:month (writes derived history not recomputable from UI)

**(b) `habit-recurrence.ts` — zero tests.** Highest-value pure logic in repo: `isScheduledOnDate` (:35), streak walk with grace day (:202-232), longest-streak scan (:234-246), rate denominator over full 365-day lookback even before habit creation (:167-183).

**(c) Frontend — zero component/hook tests despite infrastructure installed.** Root has vitest+jsdom+jest-dom but NOT `@testing-library/react` or `@testing-library/user-event` -> component testing configured but impossible until deps land.

**(d) Date/timezone utilities — zero tests AND a live hazard:** `todayStr()` uses server-local (=UTC on Workers) while users are +07:00 -> wrong-day writes 00:00–06:59 WIB. Exactly the kind of bug fixed-time tests pin down.

## Infrastructure Reality Check

- `bun run test` passes right now (verified: 66/66).
- apps/api/package.json: NO test script, NO test deps. apps/web/package.json: NO test script either (only root run reaches it).
- jsdom bootstrapped for pure schema tests (~9s of the 7s run wasted); no per-project environments.
- Suspicion surfaced by reading tests: import sessions in module-scope Map on stateless Workers may already be broken in prod; shadow test manufactures local confidence about it. NEEDS-INVESTIGATION (impact).

## Findings

| # | Sev | Finding | Location | Status |
|---|-----|---------|----------|--------|
| T1 | Critical | CI deploys straight after install; no test/typecheck/lint job anywhere | deploy-api.yml:12-32, deploy-apps.yml:17-82 | CONFIRMED |
| T2 | Critical | Zero route tests for entire API surface (~4.9k lines) | apps/api/src/routes/* | CONFIRMED |
| T3 | High | Shadow tests duplicate production logic inline; can never fail on regression | import-logic.test.ts:17-405 | CONFIRMED |
| T4 | High | Streak/recurrence math untested (grace day, weekly_n, garbage custom_days) | habit-recurrence.ts | CONFIRMED |
| T5 | High | UTC-vs-WIB day boundary untested and live | habits.ts:22-28; habit-recurrence.ts:12-23 | CONFIRMED (code) / NEEDS-INVESTIGATION (observed impact) |
| T6 | Medium | jest-dom present but @testing-library/react absent; coverage excludes api/ + web lib/ | package.json:21-25; vitest.config.ts:15 | CONFIRMED |
| T7 | Medium | Per-package test scripts missing despite setup file living in web | apps/*/package.json | CONFIRMED |

Missing hooks: no husky/, no core.hooksPath, no lint-staged, no pre-commit config, no CI test job. All absent — CONFIRMED.

## Top Regression Risks (ranked)

1. UTC-vs-WIB day boundary in habits/checkins — daily wrong-day writes, streak corruption.
2. Import commit path — largest/most complex route, shadow-tested only, session store possibly prod-broken.
3. Transaction create/update validation — cents errors corrupt finance totals/reports.
4. Streak & completion-rate computation — subtle changes change motivation-critical numbers users see.
5. Dashboard /today aggregation — single endpoint feeding home screen.
6. Monthly review generate — bad rollup persists in derived history.
7. Shared CRUD schema edits — guarded only for *import* variants today.
8. api-client/query-hook contract — no contract test catches API shape drift before deploy (already shipped one: finance).

## Top 5 Testing Gaps

1. CI never runs the tests that exist — one job fixes the highest-leverage gap (T1).
2. Zero API route tests — Hono `app.request()` tests with mocked D1 for top-5 endpoints (T2).
3. Shadow tests instead of imported production logic — export real functions, delete copies (T3).
4. No tests for habit-recurrence/date logic — most testable pure code, guards the timezone hazard (T4/T5).
5. Component-testing stack configured but unusable — add RTL + user-event, per-package scripts, fix coverage includes (T6/T7).
