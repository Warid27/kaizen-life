# Review — Security

> **Reviewed:** 2026-08-23 · Method: full read of `index.ts`, all 20 route files, `sw.js`, import pipeline; greps for auth/injection/XSS/secrets patterns. All top findings verified against source.

## Authentication & Authorization

### S1. CRITICAL — Zero authentication or authorization on the entire API — CONFIRMED
- **Location:** `apps/api/src/index.ts:27-73`; every `apps/api/src/routes/*.ts`.
- Only two middlewares exist globally: CORS (:30-43) + db injection (:46-49). Grep for `basicAuth|bearerAuth|hono/*auth|Authorization|x-api-key|apiKey|rateLimit|secureHeaders` across `apps/api/src` = **zero matches**.
- Identity is a compile-time constant: `const USER_ID = "default-user"` duplicated in 18 route files (`capture.ts:27` carries `// TODO: replace with auth session user`). The `eq(tasks.userId, USER_ID)` filters are cosmetic — attacker knows the constant too.
- **Why it matters:** API is deployed publicly (`kaizenlife-api.warid.web.id` per `.env.example`/wrangler config). Anyone with curl can read, modify, delete diary, health/sleep check-ins, finance transactions; DELETE endpoints wipe data. No rate limiting anywhere.
- **Fix:** Cloudflare Access in front of the Worker (fastest real fix), or JWT/session middleware (Lucia/Hono); per-request identity from verified token; rate limiting at edge.

## Injection

### S2. PASS — No SQL injection — CONFIRMED
All queries use parameterized Drizzle builders. Raw `` sql`` usages (`habits.ts:46`, `habit-recurrence.ts:74`, `dashboard.ts:131`, `reviews.ts:347`) interpolate column objects, not user input. Path params flow into bound parameters (`tasks.ts:94`).

### S3. LOW-MEDIUM — Search LIKE-wildcard DoS — CONFIRMED
`search.ts:22-58`: `%${q}%` not escaped (parameterized, so not SQLi — but `%`/`_` wildcards unescaped), three full-table scans per request, **no LIMIT**, no userId scope. `q=%` = cheap CPU/D1 exhaustion on a public endpoint.
**Fix:** escape wildcards or FTS5; add limit + userId condition.

### S4. N/A — Spreadsheet formula injection — CONFIRMED N/A today
Only XLSX *write* is the static template download (`import.ts:508-523`); no export-of-user-data endpoint exists yet. If added later, sanitize cells starting with `=+-@`.

## CORS & Headers

### S5. MEDIUM — Prod allowlist includes localhost; no security headers — CONFIRMED
`index.ts:33-38`: `"http://localhost:4321"` and `"http://localhost:3001"` alongside production origins. CORS is browser-only anyway (irrelevant against curl — see S1). No `X-Content-Type-Options`, `frame-ancestors`, `Referrer-Policy`, CSP anywhere in the Worker. Credentials correctly NOT allowed.
**Fix:** env-gate localhost origins; Hono `secureHeaders()`.

## Input Validation

**PASS — CONFIRMED:** all 20 route files validate bodies/queries. Pattern A manual `safeParse` (capture, tasks, habits, clients, projects, meetings, standups, search); Pattern B `zValidator` (semesters, transactions, reviews, diary, courses, checkins, assignments, goals, import). No handler writes unvalidated JSON to DB; explicit field mapping everywhere (`tasks.ts:69-85`, `capture.ts:25-41`). Residual gaps are semantic (task date strings, custom_days JSON) — see backend review.

## File Upload / Import

### S6. HIGH — Unauthenticated memory-DoS + fragile sessions — CONFIRMED
- Module-scope `sessions Map` (`import.ts:52`): parsed spreadsheets held in isolate memory (5MB xlsx expands 10–100x through `XLSX.read` + `sheet_to_json`, :139,:147); no cap on session count/bytes; 1h lazy TTL purged only on access (:56-65). Concurrent uploads -> OOM within 128MB isolate.
- File type checked by **filename extension only** (`file.name.split(".").pop()`, :99-119) + size; content parsed by SheetJS 0.18.5 (known CVE history) on untrusted input.
- Per-isolate state means upload and execute may hit different isolates -> intermittent "Session not found" (:548) — feature unreliable in prod by design.
- `DELETE /import/:sessionId` (:697) lets anyone delete any session.
- **Fix:** sessions to D1/KV/DO with quotas; magic-byte sniffing; row/cell budget caps; dense-mode parse or CSV-only path.

### S7. MEDIUM — Public write path into `users` table — CONFIRMED
`TABLE_MAP` includes `users` (`import.ts:92`; schema `shared/import.ts:1079`) -> POST /api/import/execute accepts `entityType:"users"` inserting attacker-chosen rows. Cosmetic today (no password column), account-injection primitive the moment real auth lands.
**Fix:** remove `users` from importable entities.

## Secrets Exposure

### S8. LOW — Mostly clean — CONFIRMED
No tokens/passwords in tracked source; workflows use `${{ secrets.CLOUDFLARE_API_TOKEN }}`; `.env.example`s placeholders only. `wrangler.toml:5,13` commits `account_id` + D1 `database_id` (identifiers, not secrets — map infra for attackers). `seed.ts:30-31` embeds owner name/email ("Warid", warid@warid.web.id) — PII, low. Git history shows no secret-removal red flags.

## Client-Side

### S9. MEDIUM-HIGH — Service worker persists sensitive API responses — CONFIRMED (verified directly)
`sw.js:45-96`: comment says "Skip non-GET and API requests" (:49) but **only non-GET is skipped — no API-path check**. Cross-origin `GET /api/*` responses fall into generic cache-first branch (:84-96) -> diary/finance/health JSON written to Cache Storage, served forever (only invalidated by manual `CACHE_VERSION` bump), even while online.
**Why it matters:** personal data persisted on disk on shared devices; stale reads with no TTL; survives logout-equivalents.
**Fix:** `if (url.pathname.startsWith('/api/') || url.hostname !== location.hostname) return;` before line 54; bump version.

- **PASS — XSS:** grep `dangerouslySetInnerHTML|innerHTML|insertAdjacentHTML|document.write|eval(` over `apps/web/src` = zero hits. No tokens stored client-side (nothing to store — consequence of S1).

## Mass Assignment

Largely mitigated: handlers never spread raw bodies; Zod default strip-mode drops unknown keys. **LOW inconsistency:** mixed `.strict()` vs non-strict schemas — non-strict ones silently ignore typos (`titel` accepted -> confusing downstream required-field error). Hardening nit.

## Top 5 Security Issues

| # | Sev | Issue | Location |
|---|-----|-------|----------|
| 1 | Critical | No auth/authz/rate-limiting; entire personal dataset publicly readable/writable/deletable | `index.ts`, all routes (`capture.ts:27`) |
| 2 | High | Unauthenticated memory-DoS import; extension-only validation; per-isolate sessions breaking feature | `import.ts:52,99-170` |
| 3 | High | SW caches `GET /api/*` cache-first indefinitely despite claiming to skip API | `sw.js:45-96` |
| 4 | Medium | Public import path into `users` table (future privilege-escalation landmine) | `import.ts:92` |
| 5 | Low-Med | Search wildcard/unbounded/unscoped DoS; localhost origins in prod CORS; no security headers | `search.ts:22-58`, `index.ts:33-38` |

**Positives worth stating:** consistent parameterized queries (zero SQLi), universal Zod validation, no XSS sinks, no secrets in source, workflows using GH secrets properly.
