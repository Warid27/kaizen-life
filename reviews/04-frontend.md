# Review — Frontend

> **Reviewed:** 2026-08-23 · Method: subagent audits of islands, query hooks, stores, service worker; lead-reviewer spot verification. Astro static + React islands + TanStack Query + Zustand.

## API Integration Correctness

### F1. CRITICAL — Finance write path incompatible with API — CONFIRMED (verified directly)
- Hand-written interface `queries/finance.ts:20-27`: `{type, amountCents, currency, category, description, date}` — **no `account`**, uses `description`.
- Server schema requires `account` (`transaction.ts:15`, no default) and knows `note`, not `description`.
- Every "+Income/+Expense" submit returns 400; **no onError UI** -> dialog just stays open. No transaction can be created from the UI.
- If accepted, list would render blank titles anyway (`FinanceApp.tsx:428` reads `tx.description`; DB stores `note`).
- Related crash: server summary returns no `dailyBalance` (`transactions.ts:141-151`) but `FinanceApp.tsx:203,325,526-546` dereferences `summaryData.dailyBalance` -> TypeError unmounts the island once real data flows. Today masked by demo fallback.

### F2. CRITICAL — Fabricated "demo" data masquerades as real — CONFIRMED
| Module | Fallback | Location |
|---|---|---|
| Stats | `/api/stats/overview` doesn't exist -> 100% `Math.random()` datasets rebuilt every render/range switch | `StatsApp.tsx:61-189`, `queries/stats.ts:66` |
| Review | 404 (path mismatch) -> `generateDemoReview(month)` shown as your real diary | `ReviewApp.tsx:94` |
| Finance | any API hiccup -> 30 days of fake transactions + fake balance chart | `FinanceApp.tsx:202-203` |
| Goals | first-load flash or error -> 6 fictional goals with fictional progress | `GoalsApp.tsx:209` |
| Habits chart | hardcoded pseudo-random monthly chart (comment admits it) | `HabitsApp.tsx:321-328` |

**Why it matters:** users make decisions off noise rendered identically to real data. **Fix:** distinguish loading/error/empty states; forbid synthetic-data substitution after hydration.

### F3. HIGH — Date handling bugs in UI
- `CollegeApp.tsx:517,522`: `today = new Date().toISOString().split('T')[0]` (UTC — wrong before 07:00 WIB) and **`a.dueDate <= today + 7` is string concatenation** ("2026-08-237") -> Due Soon structurally ~always 0. Verified directly.
- `CheckinApp.tsx:63-66`: browsing >6 days into the past makes `from > to` -> empty results, form renders blank though entries exist.
- Split-brain "today": client-local (`stores/ui.ts:32-38`) vs server UTC — nightly disagreement between planner/dashboard/habits/reminders.

### F4. MEDIUM — Transaction filters silently ignored
UI sends `startDate/endDate` (`queries/finance.ts:29-33,58-68`); API expects `from/to`. Zod strips unknown keys -> From/To/Type filter UI does nothing; full history always fetched then client-sliced to 50 rows (`FinanceApp.tsx:356`).

### F5. MEDIUM — Goal math NaN / invalid states
`GoalsApp.tsx:217-222,389`: target 0 -> `(currentValue/targetValue)*100` = NaN/Infinity -> header renders "NaN%"; negative currentValue yields negative %; clicking progress on an `abandoned` goal resurrects it to `in_progress` (:258-265); weekly/monthly goals hard-code Jan1–Dec31 period (:251-252) so they never match any month in review generation.

## Component & UX Issues

- **MEDIUM — Habits page can never show completion:** reads `(habit as any).completedCount` from an API that doesn't return log fields (`HabitsApp.tsx:124-126,227-228` vs `habits.ts:56 .select()`); checkbox stays unchecked even after successful check-in; contradicts Dashboard which joins logs.
- **MEDIUM — Irreversible check-ins:** increment-only mutation (`HabitsApp.tsx:76-81`), no undo endpoint exists; aria-label promises "Mark as incomplete" (`HabitsApp.tsx:244`, `HabitsCard.tsx:80`) but second click is a silent no-op.
- **MEDIUM — Dashboard habit toggle dead:** `onToggleHabit` never passed (`DashboardApp.tsx:49`; `HabitsCard.tsx:73` optional-call no-ops).
- **LOW — DashboardContent re-renders all 9 cards on any query change** (`DashboardApp.tsx:22-58`, no memo) — acceptable today, revisit after per-card split.

## State & Data Layer

- **LOW/MEDIUM — Per-island QueryClients fragment the cache:** each mount creates its own client (`lib/query-provider.tsx:30-47`; ReminderBell/CommandPalette/page apps each own one) -> no cache sharing on same page, duplicate in-flight fetches for identical keys. Sane defaults otherwise (`staleTime: 60s`, `refetchOnWindowFocus: false`).
- **MEDIUM — Service worker freezes app data:** `sw.js:45-96` caches cross-origin GET `/api/*` responses cache-first forever despite comment claiming API requests are skipped -> installed PWAs serve stale diary/finance/health data indefinitely; mutations appear to vanish. Verified directly.
- Deploy race: tab open across a deploy keeps running old JS against changed API shapes until reload.

## Performance (frontend slice)

- ~277 KB JS baseline/page before any data (Astro client 182 KB + shared chunk 61 KB + page island).
- All 19 islands `client:load`; zero `client:idle`/`client:visible`; CommandPaletteMount (⌘K-only) and ReminderBell hydrate eagerly everywhere.
- Dashboard is one monolithic island — below-fold cards block hydration of above-fold ones.
- No prefetch config (`astro.config.mjs:5-8`), no preconnect to API origin; MPA nav = full reload + refetch.
- chart.js correctly isolated to Finance/Stats chunks only (verified via chunk graph — positive).

## Security (frontend slice)

- PASS: no XSS sinks (`dangerouslySetInnerHTML`/`innerHTML`/`eval` = zero hits); React/Astro escaping intact; no tokens stored client-side (nothing to store — see security review).

## Top 5 Frontend Issues

1. CRITICAL — fabricated data presented as real across 5 modules (F2).
2. CRITICAL — finance create broken + page crashes on real data (F1).
3. HIGH — SW cache-first freezing API data on installed PWAs.
4. HIGH — date bugs: `today + 7` concat, UTC-today, checkin window collapse (F3).
5. MEDIUM — habits page contradictions (can't complete, can't undo, dead dashboard toggle).
