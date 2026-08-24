# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
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
