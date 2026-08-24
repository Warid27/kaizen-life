# Review — Performance & Scalability

> **Reviewed:** 2026-08-23 · Method: subagent audit of API hot paths, bundle output (dist/_astro measured), cache layers, render behavior. Hono/Workers + D1 backend, Astro islands frontend.

## API Hot Paths

### P1. CRITICAL — SW cache-first serves frozen API GETs
`sw.js:84-96`: cross-origin `/api/*` GET responses cached forever (no `/api` guard despite comment claiming one). App data freezes after first load on installed PWAs; masks ALL other caching logic and breaks mutation UX. (Full detail in security review S9.) CONFIRMED.

### P2. HIGH — Zero secondary indexes + zero pagination (multiplier)
- Zero non-unique indexes in the whole DB; zero `.limit(`/`.offset(` matches across apps/api (grep = 0 hits over 20 route files) — every list endpoint returns the entire filtered table (`transactions.ts:46-53` example). Payloads grow linearly forever; D1 caps ~100k rows/~1MB practical before Workers memory/serialization bite.
- Fix: cursor pagination (date-keyed fits this schema) + index migration (see database review DB2).

### P3. HIGH — `GET /reminders`: N+1 + 4 full-table scans, polled every 60s from every tab
Per-habit lookups loop (:77-88), full tasks/meetings/followups/action-items scans filtered in JS (:104-223). Example scale: ~6k rows/poll -> millions of D1 rows_read/day for a badge. Multiplied per open tab.
Fix: single indexed WHERE clauses + event-driven invalidation instead of interval polling.

### P4. HIGH — `ensureTodayLogs` N+1 on hot path
~21 serial D1 round trips @ 13 habits on every `GET /habits` (also hit by dashboard flows). Writes inside a GET. Fix: one batched existence check or scheduled materialization.

### P5. HIGH — Dashboard = ~10 serial round trips on most-hit endpoint
8+ sequential inline queries in one handler (`dashboard.ts:64-254`). Fix: `Promise.all` independent sections + SQL aggregates (SUM/COUNT/GROUP BY) replacing fetch-all-then-reduce (:120-172).

### P6. MEDIUM — Stats page fabricates data per render
`/api/stats/overview` doesn't exist -> 404 -> `Math.random()` arrays built during render, re-randomized on every range switch (`StatsApp.tsx:185-189`). Broken feature + GC churn + chart re-animation. Fix: implement SQL GROUP BY aggregation endpoint; memoize until then.

### P7. MEDIUM — Import isolate profile
5MB xlsx expands 10–100x as JS objects inside 128MB isolates; concurrent uploads multiply; SheetJS parse CPU-heavy (risky on Free plan 10ms CPU p50 — NEEDS-INVESTIGATION against actual plan). Module-scope session Map also means cross-isolate 404s. Fix: KV/D1 sessions, row caps, streaming/CSV path.

### P8. LOW — No Cache-Control headers on any API response
No `Cache-Control`/ETag anywhere (`index.ts:30-49` only CORS+db middleware). Add explicit `private, no-store` for user data to prevent future proxy caching surprises once S1 is fixed.

## Frontend Bundle

### P9. MEDIUM — ~277 KB baseline JS tax per page (measured from committed dist)
`client.NXU-5Pd6.js` 182.2 KB (Astro runtime + React/ReactDOM) + `utils.BLMKRfMC.js` 61.3 KB (TanStack Query/zustand shared chunk, imported by every island) + page island + palette/bell mounts. Dominant load cost on a mobile-first PWA. chart.js correctly isolated to Finance/Stats chunks only (verified via chunk graph — positive). Next wins: Preact compat alias (~30 KB), idle hydration below.

### P10. MEDIUM — All 19 islands `client:load`
CommandPaletteMount (⌘K-only UI) and ReminderBell hydrate eagerly on every page; DashboardApp is one monolithic island — below-fold cards block above-fold hydration (`DashboardApp.tsx:46-56`); React.lazy absent everywhere. Fix: `client:idle` for palette/bell; per-card islands with `client:visible`; lazy chart components in StatsApp.

### P11. LOW/MEDIUM — Per-island QueryClients fragment cache
Each mount owns a QueryClient (`query-provider.tsx:30-47`) -> duplicate in-flight fetches for identical keys on the same page; N poll timers where applicable. Sane defaults otherwise. Fix: module-singleton client or accept duplication + kill reminder polling.

### P12. LOW/MEDIUM — No prefetch/preload
Astro prefetch disabled (`astro.config.mjs:5-8`); nav = full document load + JS re-parse + refetch. Deploy race: tab open across deploys runs old JS vs changed API shapes until reload (interacts with P1). Fix: `prefetch: { prefetchAll: true }`, preconnect to API origin.

## Render Performance

- DateDisplay renders once, no timer — clean non-issue (hypothesis disproved). CONFIRMED non-issue.
- HabitsCard lists keyed by id, bounded — fine. Virtualization unnecessary at personal scale today; revisit after pagination lands. NEEDS-INVESTIGATION for other cards.
- DashboardContent re-renders all 9 cards on any query change — acceptable while cards are cheap presentational components.
- Random-in-render demo data (P6) causes wasted GC churn + restarting chart animations. CONFIRMED.

## Quick-Win Sequence

1. Two-line SW guard -> version bump (P1).
2. Promise.all + SQL aggregates in dashboard/reminders (P3/P5).
3. Batch `ensureTodayLogs` (P4).
4. Migration adding ~6 indexes (P2a).
5. Implement stats endpoint (P6).
6. Pagination on transaction/task lists (P2b).

## Top 5 Performance Issues

1. CRITICAL — SW freezes API data cache-first (P1).
2. HIGH — no indexes + no pagination anywhere = scalability ceiling (P2).
3. HIGH — reminders N+1/scan storm polled per tab (P3).
4. HIGH — ensureTodayLogs serial write-N+1 on hot path (P4).
5. HIGH — stats endpoint missing -> random-data charts rebuilt per render (P6).
