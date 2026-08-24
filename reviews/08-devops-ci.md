# Review — DevOps & Production Readiness

> **Reviewed:** 2026-08-23 · Method: full read of both workflows + wrangler.toml + _routes.json + astro.config; git status/ls-files/log verification of hygiene and secrets.

## CI/CD Pipelines

### D1. CRITICAL — Blind deploy, zero quality gates — CONFIRMED
`.github/workflows/deploy-api.yml:15-29`, `deploy-apps.yml:20-78`: neither runs typecheck, lint, or tests. API job = checkout -> install -> `bunx wrangler deploy`. Web at least builds (build-failure = deploy-failure); API doesn't even build. The 66 existing tests have NEVER run in CI.
**Fix:** `tsc --noEmit` + `bun run test` (+lint when it exists) as `needs:` prerequisites.

### D2. HIGH — No rollback strategy — CONFIRMED
No `wrangler rollback`, no version pinning/tagging. Rollback = manual dashboard action under pressure.
### D3. HIGH — No environment promotion — CONFIRMED
Single job deploys straight to production on push to main; no staging worker, no PR preview deploys (Pages always `--branch=main`).
### D4. MEDIUM — Over-scoped shared token — CONFIRMED
One `CLOUDFLARE_API_TOKEN` used 6x in deploy-apps.yml creates projects, PATCHes config/env vars/domains, deploys Workers+Pages; used by both workflows. Split into scoped tokens; move project-management curl steps to one-time setup.
### D5. LOW — Fragile/unpinned toolchain — CONFIRMED
`bunx wrangler` unpinned vs local devDep wrangler@^3.99.0; `--commit-dirty=true` masks dirty worktrees; CHANGELOG.md path trigger redeploys frontend on docs-only commits (intentional per commit 10e5821, still couples docs->deploys).

## Configuration

### D6. MEDIUM — Observability not enabled — CONFIRMED
No `[observability]` block in wrangler.toml; `[build] command = "bun install"` redundant in CI.
### D7. LOW — IDs committed; stale compatibility_date — CONFIRMED
`account_id` (wrangler.toml:5) + D1 `database_id` (:13) committed (identifiers, not secrets; map infra for attackers); duplicated as GH secret. `compatibility_date = "2024-12-01"` ~20 months behind. Repo publicness NEEDS-INVESTIGATION.
### D8. CONFIRMED gap — Worker custom domain hand-configured
Web build bakes `PUBLIC_API_URL=https://kaizenlife-api.warid.web.id` but wrangler.toml defines no routes/custom_domains -> repo alone can't reproduce deployment.
### D9. OK — `_routes.json` correct for static Astro
`{"include": [], "exclude": ["/*"]}` — all static assets, zero Pages Function invocations; matches static output. NOTE: no `_headers` file exists -> no security-header/cache-control control at edge; commit history (f1b2777/e6ce3f3) shows stale cached HTML already caused real hydration bugs.

## Repo Hygiene & Secrets — CLEAN

- `git status --short` empty; `.wrangler/`, `.omo/`, `screenshots/`, DBs correctly ignored and UNTRACKED (verified via --ignored). Nothing wrongly committed.
- Grep for hardcoded tokens/keys/passwords across tracked files: no hits. Workflows use `${{ secrets.* }}` only; .env.example placeholders only; seed.ts strings benign sample data (plus owner name/email noted in security review).
- Commit history conventional and clean; no secret-removal red flags.

## Production Readiness Gaps

### D10. CRITICAL — Publicly writable API, no auth, no rate limiting (cross-ref security S1) — CONFIRMED
CORS restricts browsers only; anyone with curl can POST/PATCH/DELETE all data at the public API URL.
### D11. HIGH — Health endpoints don't check health — CONFIRMED
`/status` hardcodes Database "ok" without touching D1 (`health.ts:53-58`); memoryUsage/uptime are isolate-local noise. Fix: `SELECT 1`.
### D12. HIGH — No error tracking / alerting / monitoring anywhere — CONFIRMED
No Sentry/logpush/uptime checks/alerts + observability off -> you learn about outages from users.
### D13. MEDIUM — No deliberate backup story beyond default — CONFIRMED
No export cron/script; D1 Time Travel (~30d PIT) is the only net.
### D14. HIGH — Remote migrations not automated — CONFIRMED
drizzle migrations tracked but nothing ever applies them remotely (`db:push` targets a local file); remote schema maintained by manual ritual -> guaranteed drift eventually.

## Local/Parity

### D15. MEDIUM — Bindings typed `any`; hand-rolled partial D1 types — CONFIRMED
`client.ts:5-7` `DB: any` despite @cloudflare/workers-types installed; env.d.ts reimplements partial interface manually. Fix: `wrangler types` -> typed Env. Otherwise env parity fine: consumed vars (PUBLIC_API_URL, ENVIRONMENT, DB binding) all covered by examples/config; no orphaned vars.

## Top 5 DevOps Issues

1. No CI gates before deploy — tests/typecheck exist but never run; every push blind-deploys both tiers (D1).
2. Unauthenticated, rate-limit-free write API exposed publicly (D10/S1).
3. Schema migration drift: remote D1 updated by hand, no pipeline applies drizzle/ (D14).
4. Zero observability: no error tracking, alerts, retained logs; health check lies about DB (D11/D12/D6).
5. No staging/promotion or rollback story; single over-scoped CF token across both pipelines (D2/D3/D4).

**Gut call:** Not production-ready — a well-hygiened hobby deployment (clean git, no leaked secrets) held together by manual rituals. One bad merge or one curious bot writing to the open API takes it down silently, discovered only when a user reports it.
