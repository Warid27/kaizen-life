# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Toast notification system (`components/ui/toast.tsx`): dependency-free success/error toasts with `aria-live` feedback, mounted once inside `QueryProvider` so every island inherits it; a global mutation `onError` surfaces every failed API write as a toast, so failed saves are never silent
- `ConfirmDialog` (`components/ui/confirm-dialog.tsx`): themed, keyboard-accessible destructive-action confirmation (focuses Cancel first, Enter confirms, Escape cancels, loading state); replaced all 9 native `confirm()` call sites across Planner, Habits, College, and Work
- Search hardening: `/api/search` now scopes per table with `LIMIT 20`, escapes LIKE wildcards, and filters by `userId`

### Security (auth groundwork)
- **Real multi-account auth, end-to-end** (opt-in via `AUTH_SECRET`): `POST /api/auth/register` (PBKDF2-SHA256 hashing, per-user salt, iterations stored in the hash), `POST /api/auth/login` (generic invalid-credentials message — no user enumeration; case-insensitive email), `POST /api/auth/logout`, and `GET /api/auth/me`; sessions are stateless HMAC-SHA256 tokens in an HttpOnly/SameSite=Lax cookie (30-day TTL), verified by `userIdMiddleware` — when `AUTH_SECRET` is set every guarded route requires a session, when unset local dev stays frictionless with the shared `default-user` identity
- First registration **claims the pre-auth `default-user` row** (sets name/email/password on it) so all existing data carries over seamlessly; later registrations create fresh users (true multi-account)
- CORS now allows credentials (exact origins only) and the web API client sends `credentials: 'include'` + redirects to a new `/login` page (login/register tabs, per-field validation errors, rate-limit messaging) on any 401 from a guarded route; Settings gains a Sign out button
- Rate limiting on register/login: 10 req/min per IP (fixed-window, per-isolate — documented limitation), 429 + `Retry-After`
- Every UPDATE/DELETE now re-checks `userId` on the write itself (defense-in-depth): the last unguarded writes — monthly-review upsert/auto-summary regeneration (`reviews.ts`) and the habit-log upsert (`habits.ts`) — previously trusted an upstream SELECT for scoping; a future edit to that SELECT would have silently opened a cross-user write path
- `users.email` now has a partial unique index (`uniq_users_email_live`, live rows only — migration 0004) and `users.password_hash` column (migration 0005); prerequisite for real login
- 19 new auth tests (register/login/logout/me, session enforcement, tampered cookies, default-user claim, multi-account, rate limiting, dev-mode fallback) — suite now 143 passing

### Changed
- Dialog primitive hardened for all forms: Escape-to-close, Tab focus trap with focus restoration on close, `role="dialog"` + `aria-modal` + `aria-labelledby`, background scroll lock, and nested-dialog stacking (only the topmost dialog responds to Escape/Tab)
- Quick Capture fixed end-to-end: the command palette now always offers "Add task: …" for any typed query (previously showed "No results found" with no way to capture), creates tasks via the previously-unused `POST /api/capture` endpoint defaulting to today, closes with a success toast; dead `/planner?capture=…` navigation removed
- Row actions (edit/delete) are now visible on touch devices via `@media(hover:hover)` instead of hover-only opacity — planner, habits, courses, assignments, standups, projects, clients, meetings
- Dashboard shows an error banner with Retry on API failure instead of rendering "No tasks today" (indistinguishable from a genuinely empty day)
- Team Performance page added to sidebar and command palette (the route existed but was unreachable)
- Reminder bell items are actionable: each row links to its destination page (habits → Habits, deadlines → Planner, follow-ups → Clients, meetings → Meetings) and closes the dropdown on click
- Mobile bottom nav: honest "Settings" label (was "More"), 44px+ touch targets, `aria-current="page"`
- Success toasts across flows: tasks, habits, courses/assignments/semesters, standups, clients, follow-ups, meetings, action items, goals, check-in, diary, finance
- Dark-mode contrast fixes: planner priority chips, finance transaction/summary icon chips, goals stat chips, habit/check-in hover flashes, review/settings success texts
- Empty-state CTA on Habits ("Create your first habit")

### Fixed
- Command palette dead end: Enter on "No results found" silently discarded typed input; Quick Capture is the headline feature and now always works
- Dialogs were keyboard-inaccessible: no Escape handling, no focus management, background scrollable behind modal (WCAG failure across 10+ forms)
- Finance "Net" card icon invisible in dark mode (white-on-white)
- A11y: accessible names added to date navigation arrows, rating-scale buttons (`aria-label` + `aria-pressed`), and all row action buttons
- Local dev CORS trap: `wrangler.toml` ships `ENVIRONMENT=production`, so `wrangler dev` blocked `http://localhost:4321` and every browser API call failed silently; `.dev.vars` now overrides it for local dev, documented in new `apps/api/.env.example` and the README

### Web Push (previously unreleased notes merged here)
- Web Push notifications end-to-end (no Firebase dependency): dependency-free VAPID (RFC 8292) + `aes128gcm` (RFC 8291/8188) encryption over WebCrypto in `apps/api/src/lib/webpush.ts`, subscription endpoints (`GET /api/push/vapid-public-key`, upsert `POST /api/push/subscriptions`, scoped `DELETE /api/push/subscriptions`), `push_subscriptions` table (migration 0003), service-worker `push` / `notificationclick` handlers, and a Settings → Notifications enable/disable card
- Cron dispatcher (`*/15 * * * *`) on the API worker: delivers due rows from the polymorphic `reminders` table and a once-daily ~08:00 local-time digest per user (scheduled habits not done + open tasks), pruning dead push endpoints automatically
- Server-backed settings: `GET/PATCH /api/settings` (name/email/timezone with IANA validation) and `GET /api/export/json` full-data export
- Real stats endpoint `GET /api/stats/overview?days=N` aggregating tasks/habits/sleep/finance/diary
- Monthly reviews dual-path routes (`/api/reviews/YYYY-MM` and `/api/reviews/:year/:month`) with PUT upsert
- Habit check-in undo (`DELETE /api/habits/:id/logs/:date`) and ±increment logging
- CI quality gates: blocking typecheck (api/shared/web) + tests in all three workflows, remote D1 migration step on deploy, wrangler pinned to ^3.99.0
- Test suite grown from 66 (mostly shadowed) to **124 passing**: habit-recurrence engine (UTC-safe dates, weekly_n quota scoring, batched materialization), route-level suites (reviews/checkins/transactions/push/import), RFC 8291 crypto round-trip proof, React Testing Library smoke test

### Changed
- Every API route now derives identity from the request (`userId` middleware) instead of a hardcoded `"default-user"`, and enforces ownership guards on reads/writes
- Unified error envelope `{ error: { code, message, details? } }` across the API via global `onError`
- "Today" is timezone-aware: server resolves it from `users.timezone`, client uses browser locale via shared `todayStr()`; all hand-rolled date helpers replaced by `@kaizenlife/shared` utilities
- Finance summary returns per-currency buckets including `dailyBalance` cumulative series; transactions support `from/to/type/category/account/limit` filters
- Dashboard aggregates concurrently, adds overdue tasks, respects habit scheduling/quota state, and buckets finance by currency
- Import hardened: users entity removed, session caps (50 sessions / 5000 rows / 64 columns), atomic batched commits, natural-key upserts for logs/checkins/diary/reviews
- Seed data uses epoch seconds and true cents (Rupiah ×100)

### Fixed
- Dark/light mode never applied: theme preference was saved but no code toggled the class. Now Tailwind runs `darkMode: 'class'`, an inline pre-paint script applies the stored/system theme before first paint (no FOUC), the OS scheme is followed live in "system" mode, and the Settings selector takes effect immediately
- Service worker cached `/api/` responses (stale personal data); now bypasses API and cross-origin requests entirely (v4)
- Finance create dialog sent wrong fields (`description`, no account); now sends `account` + `note` with inline errors
- College "due soon" used UTC-today and string-concatenated dates; check-in history window could invert when browsing past dates; goal progress could render NaN/negative percentages
- Soft-deleted rows no longer collide with unique constraints: partial unique indexes (`WHERE deleted_at IS NULL`) in migration 0002 plus resurrection-upserts in habits/checkins/diary/reviews
- Removed all Math.random demo-data fallbacks from Stats/Review/Finance/Goals/Habits islands — honest loading/error/empty states instead

### Infrastructure
- D1 migrations applied to both local dev database and production (`kaizenlife-db`)
- API worker and frontend Pages redeployed with currency support

## [0.0.1] - 2026-08-06

### Added
- Initial project setup with Astro + TypeScript + shadcn/ui frontend
- Bun + Hono backend API
- SQLite + Drizzle ORM database
- Cloudflare D1 and Workers deployment support
- GitHub Actions CI/CD workflows
- Excel/CSV import system for data migration (22 entity types)
- Template download for all entity types
- Vitest testing setup with import schema tests (102 tests)
- Health check endpoint with version and uptime info
- Backend status endpoint (`/api/status`)

### Features
- **Dashboard** - Single view of today's schedule, priorities, habits
- **Daily Planner** - Time-blocked calendar view
- **Habits** - Recurrence engine with streak tracking
- **Daily Check-In** - Sleep, mood, energy, and stress logging
- **Diary** - Daily journaling
- **College** - Courses, assignments, and semester tracking
- **Work** - Standups, projects, clients, and meetings
- **Finance** - Transaction logging and monthly summaries
- **Goals** - Annual/monthly/weekly goal hierarchy
- **Monthly Review** - Auto-drafted from data
- **Statistics** - Charts for all modules
- **Quick Capture** - Add tasks from anywhere
- **Command Palette** - Navigate with Cmd/Ctrl+K
- **PWA** - Installable as a Progressive Web App

### Infrastructure
- Cloudflare Pages deployment for frontend
- Cloudflare Workers deployment for API
- Custom domain setup
- D1 database integration

---

## Version History

| Version | Date | Description |
|---------|------|-------------|
| 0.0.1 | 2026-08-06 | Initial release - Core features and infrastructure |

---

## How to Update This File

When making changes, add entries under `[Unreleased]` section.
When releasing a new version:
1. Move `[Unreleased]` items to the new version section
2. Update the version in `apps/api/package.json`, `apps/web/package.json`, and `package.json`
3. Create a git tag: `git tag v0.X.0`
4. Update this file with the new version and date
