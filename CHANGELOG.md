# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Realistic Indonesian seed data seeder (`apps/api/src/db/seed.ts`) covering all 22 tables — coherent working-student life (college, freelance work, habits, finance in Rupiah, goals hierarchy) with dates relative to today
- Seed CLI runner with `--local` / `--remote` targets via `wrangler d1 execute` (`bun run db:seed[:local|:remote]`) — idempotent, deletes existing data for `default-user` before re-inserting
- Multi-currency support: `transactions.currency` column (ISO 4217: idr, usd, eur, sgd, myr, jpy) with `idr` default
- Currency selector in finance transaction form, per-transaction currency badge in list, and locale-aware formatting via `Intl.NumberFormat` (Rp / $ / € / ¥ …) replacing the hardcoded dollar sign
- Initial D1 migration (`drizzle/0000`) generated from schema; applied to local and remote databases
- Six bodyweight workout habits in seed data (push up, pull up, dead hang, plank, body squat, wall sit)

### Changed
- `/api/finance/summary` now aggregates per currency (`byCurrency` + `primaryCurrency`); flat fields mirror the primary currency (`idr`) for backwards compatibility
- `byCategory` in finance summary is now an array of `{ category, amountCents, type }` matching the web client's expected shape (previously a mismatched object)
- Create/Update transaction schemas accept `currency` (defaults to `idr` when omitted)
- `apps/api/wrangler.toml` now pins `account_id` for deterministic non-interactive deploy/remote commands

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
