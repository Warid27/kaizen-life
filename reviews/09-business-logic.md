# Review — Business Logic & Domain Correctness

> **Reviewed:** 2026-08-23 · Method: subagent audit of habit-recurrence engine, checkins, habits, goals, tasks, transactions, courses/assignments/semesters, dashboard, reviews, import — plus frontend query/mutation usage affecting correctness. Concrete failing scenarios included where constructible.

## Time & Timezone

### BL1. HIGH — Server "today" = UTC; client "today" = WIB — CONFIRMED
`habits.ts:22-28`, `dashboard.ts:21-30`, `reminders.ts:19-34` use bare `new Date()` (UTC on Workers); `stores/ui.ts:32-38` uses browser-local; `users.timezone` column exists (`schema.ts:10`, default "Asia/Jakarta") but **no code ever reads it**.
**Failing scenario:** at 01:00 WIB Aug 24 — Planner shows selectedDate Aug 24 while `GET /habits` creates placeholder logs for Aug 23; check-ins from Habits page write to the previous day; reminders reference the wrong day.
**Fix:** resolve "today" from users.timezone server-side (Intl.DateTimeFormat en-CA trick); client sends explicit date where UI owns the day.

### BL2. HIGH — CollegeApp double date bug — CONFIRMED (verified directly)
`CollegeApp.tsx:517,521-522,637`: (1) UTC ISO date as "today" -> assignments due today count as overdue before 07:00 WIB; (2) **`a.dueDate <= today + 7` is string concatenation** ("2026-08-237") -> lexicographic garbage -> Due Soon structurally ~always 0.
**Fix:** local-date formatter + real 7-day shift (`shiftDate` like dashboard.ts:33-37).

### BL3. MEDIUM — Checkin history window collapses when browsing past — CONFIRMED
`CheckinApp.tsx:63-66`: fixed `from = daysAgo(6), to = selectedDate`; navigate back >6 days -> from>to -> empty result -> form renders blank though entries exist.

### BL4. Verified correct — month-length math
`transactions.ts:79` and `reviews.ts:254` use day-0 trick correctly (leap years fine). No ISO-week logic exists anywhere (only rolling N-day windows) — so no week-start bug, but also no "this week" feature despite domain promise. PASS.

## Habits & Streaks

### BL5. HIGH — Habits page can never show completion/streaks — CONFIRMED
API `.select().from(habits)` returns habit columns only (`habits.ts:55-60`); UI reads `(habit as any).completedCount >= targetCount` -> undefined>=undefined -> false forever (`HabitsApp.tsx:124-126,227-228`). Same habit shows done on Dashboard (joins logs) and undone on Habits page.

### BL6. HIGH — Check-in irreversible — CONFIRMED
Increment-only mutation (`HabitsApp.tsx:76-81` always +1); no decrement/delete-log endpoint exists. Accidental tap permanently completes the day; aria-labels promise undo that silently no-ops; streaks unrepairable except via import overwrite.

### BL7. HIGH — weekly_n semantics break rate & streaks — CONFIRMED
`habit-recurrence.ts:35-50,171-200`: weekly_n treated as active every day; totalScheduledDays counts all days. A "3x/week" habit scored against 7 -> max rate ~43%; streak resets on ANY missed day even when weekly quota met. Placeholder zero-rows auto-created daily pollute logs.

### BL8. MEDIUM — Rate denominator includes pre-creation days; longest streak capped at lookback — CONFIRMED
Habit created Aug 21 -> Aug 23 rate = completions/366 (`habit-recurrence.ts:167-183`). Perfect 2-year habit reports longestStreak <= 365.

### BL9. MEDIUM — custom_days with missing/garbage JSON = zombie habit — CONFIRMED
No schema refinement (`schemas/habit.ts:16`); recurrence `catch { return false }` (:40-47) -> habit created via POST succeeds but never scheduled/invisible/completable-never.

## Money

### BL10. CRITICAL — Frontend create incompatible with API -> saving money fails 100% of the time — CONFIRMED (verified directly)
Client sends `{amountCents, currency, category, description, date}` (`FinanceApp.tsx:636-647` + interface `queries/finance.ts:20-27`); server requires `account: enum[cash,bank]` (no default) and knows `note` not `description` (`transaction.ts:9-17`). Every submit -> 400, swallowed silently (no onError UI).

### BL11. CRITICAL — Real API response crashes Finance page — CONFIRMED
Server summary has no `dailyBalance` key (`transactions.ts:141-151`) but `FinanceApp.tsx:203,325,526-546` maps over `summaryData.dailyBalance` -> TypeError unmounts island once real data arrives. Page currently "works" only via demo fallback.

### BL12. HIGH — Currency mixing in dashboard & monthly review totals — CONFIRMED
Dashboard sums amountCents ignoring currency (SELECT doesn't even fetch currency — `dashboard.ts:164-172,267-272`); reviews same (:277-282,:377-383). IDR 5,000,000 + USD 350 cents added raw. `/finance/summary` already buckets per-currency correctly — consumers were never updated.

### BL13. MEDIUM — List filters silently ignored — CONFIRMED
UI sends startDate/endDate; API expects from/to (`queries/finance.ts:29-33` vs TransactionQuerySchema) -> Zod strips unknowns -> filter UI does nothing; full history returned then sliced to 50 client-side.

### BL14. PASS — Money at rest
Integer amountCents end-to-end (`Math.round(x*100)` UI; int+min(0) server; SQLite INTEGER); income/expense sign convention consistent; import coerces safely.

## Status Machines

### BL15. MEDIUM — completedAt never cleared/re-stamped — CONFIRMED
Planner cycles todo->done->todo leaving status='todo' WITH stale completedAt (`tasks.ts:144-149`); re-completing keeps old timestamp -> any completedAt-keyed metric corrupted.

### BL16. MEDIUM — Goal percent NaN / zero targets pass creation — CONFIRMED
`GoalsApp.tsx:217-222,389`: target 0 -> NaN or Infinity->100 rendered; negative currentValue -> negative %; only disabled-button heuristic guards creation.

### BL17. LOW/MEDIUM — Goal side effects
Progress click resurrects abandoned goals to in_progress (:258-265); weekly/monthly goals hard-coded Jan1–Dec31 period (:251-252) -> never match any month in review generation (reviews matches only fully-contained months :293-296).

### BL18. MEDIUM — References never validated on write (orphans) — CONFIRMED
assignments.courseId, courses.semesterId, tasks.projectId/courseId unchecked (zero FKs too); only goals validate parents. Orphan rows render forever in lists/dashboard deadlines/college stats.

### BL19. LOW — Assignment transitions unguarded
not_started->graded legal; grade while not started; regression from graded allowed (`assignments.ts:120-171`); overdue computed only UI-side.

## Semester / Course

### BL20. MEDIUM — No semester range sanity — CONFIRMED
No refine(endDate>startDate) (`semesters.ts:17-34`); reversed ranges accepted -> progress bar computes negative elapsed -> clamps weirdly. GPA/grade math absent by design (grade free-text) — nothing else to audit here.

## Cross-Domain Consistency

### BL21. CRITICAL — Reviews module wired to routes that don't exist — CONFIRMED (verified both sides)
Web: `/api/reviews/${month}` one segment (`queries/review.ts:44,57`); server: `/reviews/:year/:month` two segments (`reviews.ts:53,86`); body field names differ too. Load->404->fabricated review shown as real diary; Save->404 silently dropped.

### BL22. CRITICAL — Fabricated demo data presented as real in 4+ modules — CONFIRMED
Stats (endpoint absent -> Math.random()), Review (above), Finance fallback, Goals fallback, hardcoded Habits chart. Users make decisions off noise indistinguishable from real data.

### BL23. HIGH — Dashboard disagrees with every module about "today" — CONFIRMED
Server-UTC task list labeled today vs planner's local date; omits undated AND overdue-past tasks entirely (date=today only, :64-69) while upcomingDeadlines includes done items (no status filter, :188-207).

### BL24. MEDIUM — Dashboard habit list ignores scheduling — CONFIRMED
leftJoin over ALL active habits without isScheduledOnDate filter (`dashboard.ts:72-96`) though the service function exists precisely for this; custom-days habits appear on off-days; completedCount may be NULL -> renders incomplete.

### BL25. HIGH — Import as corruption vector — CONFIRMED
Re-import duplicates everything lacking natural keys -> double expenses on retry; partial multi-batch commits on failure; imports into `users` table possible; backfilled habitLogs fabricate streaks that can't be corrected via UI (no undo). Mitigated well: strict date/amount format validation, serial-number dates fail loudly.

## Invalid States & Guards (summary table)

| # | Finding | Sev | Location | Status |
|---|---------|-----|----------|--------|
| G1 | Soft-deleted checkin/diary resurrection: PUT updates invisible row, never resets deletedAt -> save vanishes | Low-Med | checkins.ts:74-88, diary.ts:74-88 | CONFIRMED |
| G2 | UpdateTaskSchema accepts arbitrary date/time strings | Medium | schemas/task.ts:14-15 | CONFIRMED |
| G3 | Category free-form string fragments analytics | Low | transaction.ts:14 | CONFIRMED |
| G4 | Sleep minutes unbounded above (typo 4200 skews averages) | Low | checkin.ts:34-35 | CONFIRMED |
| G5 | Review PUT requires year/month duplicating path params | Low | monthlyReview.ts:4-11, reviews.ts:95-104 | CONFIRMED |
| G6 | Review-generate habit rate can exceed 100% (numerator includes inactive/deleted habits' logs) | Medium | reviews.ts:314-335 | CONFIRMED |
| G7 | Tasks-completed keyed on scheduled date misses undated tasks; goals matched only if month-contained | Medium | reviews.ts:285-297,361-374 | CONFIRMED |
| G8 | GET-by-date/settings/backups/export endpoints called by web don't exist server-side | Medium | queries/* vs index.ts:52-71 | CONFIRMED |

## Top 5 Domain-Correctness Issues

1. Money entry point broken + finance crash-on-real-data (BL10/BL11).
2. Fabricated data masquerading as real across Stats/Review/Finance/Goals/Habits-chart (BL22/BL21).
3. Split-brain "today" + College date bugs — nightly wrong-day window (BL1/BL2/BL23).
4. Habit loop contradictions: page can't complete, can't undo, dead toggle, weekly_n capped ~43% (BL5-BL7, BL24).
5. Import as corruption vector: duplication, partial commits, fabricated permanent streaks (BL25 + BL6).

**Cross-cutting root causes (fix once):** centralize today-resolution behind users.timezone; derive frontend types from shared Zod instead of hand-mirrors (every BL10-class bug is drift); forbid post-hydration synthetic-data substitution; add .references() + D1 foreign_keys strategy.
