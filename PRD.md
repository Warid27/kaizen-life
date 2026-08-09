# KaizenLife — Product Requirements Document

**Tagline:** Become 1% Better Every Day.
**Version:** 1.0
**Status:** Ready for build
**Stack:** Astro + TypeScript + shadcn/ui (frontend) · Bun + Hono (backend) · SQLite + Drizzle ORM (data) · Zustand + TanStack Query (state) · Chart.js · Day.js · vite-plugin-pwa

---

## Table of Contents

1. [Vision](#1-vision)
2. [Design Decisions & Deviations from Original Brief](#2-design-decisions--deviations-from-original-brief)
3. [Product Goals](#3-product-goals)
4. [Success Metrics](#4-success-metrics)
5. [User Personas](#5-user-personas)
6. [Information Architecture](#6-information-architecture)
7. [Navigation Flow](#7-navigation-flow)
8. [Functional Requirements](#8-functional-requirements)
9. [Non-Functional Requirements](#9-non-functional-requirements)
10. [User Stories](#10-user-stories)
11. [Feature Specifications](#11-feature-specifications)
12. [Data Model (High Level)](#12-data-model-high-level)
13. [Edge Cases](#13-edge-cases)
14. [Validation Rules](#14-validation-rules)
15. [UX Principles](#15-ux-principles)
16. [Technical Constraints](#16-technical-constraints)
17. [Future Roadmap](#17-future-roadmap)
18. [Out of Scope (v1)](#18-out-of-scope-v1)
19. [Risks](#19-risks)
20. [Open Questions](#20-open-questions)
21. [Implementation Plan for AI Build Agents](#21-implementation-plan-for-ai-build-agents)
22. [Appendix A — Folder Structure](#appendix-a--folder-structure)
23. [Appendix B — Database Schema (Drizzle)](#appendix-b--database-schema-drizzle)
24. [Appendix C — API Architecture](#appendix-c--api-architecture)
25. [Appendix D — State Management Strategy](#appendix-d--state-management-strategy)
26. [Appendix E — Component Architecture](#appendix-e--component-architecture)
27. [Appendix F — Coding Standards](#appendix-f--coding-standards)
28. [Appendix G — Plugin Architecture (Future)](#appendix-g--plugin-architecture-future)
29. [Appendix H — Modular Architecture Principles](#appendix-h--modular-architecture-principles)

---

## 1. Vision

KaizenLife is a single local application that replaces the scattered set of apps (calendar, to-do app, habit tracker, notion doc, spreadsheet, standup channel, CRM notes) a working student currently needs to open every day. One login, one dashboard, one place where "what does today require of me" is answered in under 5 seconds.

The product is judged by one question, applied to every feature before it's built: **does this reduce mental load, or does it add a screen the user now has to remember to check?** Features that only exist because they sound complete for a portfolio ("Notion-clone") are cut. Features that remove a sticky note, a second app, or a "did I forget to..." moment are kept.

---

## 2. Design Decisions & Deviations from Original Brief

This is the critique pass, applied directly to the product rather than left as commentary. Each item below changes something in the original brief and states why.

| # | Original Brief | Change | Reason |
|---|---|---|---|
| 1 | Sleep, Mood, Energy, Habits as separate tracking surfaces | Merged into a single **Daily Check-In** flow, done once per day in under 30 seconds | Four separate logging screens is the opposite of "reduce mental load." A user who has to remember to visit four screens will visit zero. One combined check-in (sleep + mood + energy + stress + habits) shown once on the dashboard is the actual daily-driver behavior. |
| 2 | No mention of a universal quick-add / inbox | Added a **global Quick Capture** (keyboard shortcut + command palette), writing into a single `tasks` table used by Planner, Work, and College | Without a friction-free capture point, a "life OS" fails on day one: the user reaches for their phone's default notes app instead. This is the single highest-leverage feature in the entire product. |
| 3 | No backup/export mentioned, but architecture is local-only SQLite | Added mandatory **local backup/export** (manual + scheduled `.sqlite` copy, and JSON export) | Local-only storage with no sync means one disk failure = years of habit/diary/finance history gone. This is not optional for a daily-driver personal system. |
| 4 | Habits described as a flat list with no generation logic | Added a **recurrence engine**: habits define a schedule, the system generates today's expected log rows, not the user | Otherwise "did I do vitamins today" silently has no row to check off, which breaks streak tracking the first day it's not manually visited. |
| 5 | 13 flat top-level modules implied in navigation | Grouped into 6 nav sections: **Today, Life, College, Work, Finance, Review & Goals** (+ Settings) | A 13-item flat sidebar is a second job. Grouping by "when do I use this" (every day vs. weekly vs. monthly) matches actual usage rhythm and halves visual navigation load. |
| 6 | "Notifications" listed as a single generic module | Split into **in-app reminders** (v1, reliable, works fully offline) and **OS push notifications** (v1.1, requires the local server + a running browser tab, flagged as a real constraint — see §16) | Promising "notifications" without stating the delivery mechanism sets up a feature that quietly doesn't work when the laptop is closed. Being explicit about the constraint now prevents a rebuild later. |
| 7 | "Offline first" stated without defining what "offline" means when there's still a Bun backend | Defined as **local-first**, not zero-server offline: the app requires the local Bun+Hono process running, but never calls the internet. True server-less offline (client-side SQLite via WASM) is roadmap, not v1 | This is an architecture-defining decision an AI build agent cannot guess correctly on its own — stated explicitly to prevent scope drift mid-build. |
| 8 | Finance: "simple cashflow only" | Kept simple, but added a required `category` field on every transaction | A monthly summary that only shows one income number and one expense number is not useful even at "simple." Category is the one field that makes the summary meaningful without becoming a budgeting app. |
| 9 | No mention of soft deletes / multi-user readiness beyond "architecture should support it" | Every table gets `user_id`, UUID primary keys, `created_at`/`updated_at`, and soft delete (`deleted_at`) from day one | This is the cheapest possible insurance for future multi-user and sync. Retrofitting UUIDs and soft deletes onto an autoincrement-int, hard-delete schema later is a full migration; adding it now costs nothing. |
| 10 | Command palette not mentioned | Added — global `Cmd/Ctrl+K` palette (via `cmdk`, which shadcn/ui ships natively) for navigation, quick capture, and search across tasks/assignments/clients | Given 6 nav sections and dozens of entities, keyboard-first jump-to-anything is a bigger daily-load reducer than most of the modules in the original list combined, and it's nearly free to build with the chosen stack. |
| 11 | "Daily quote" listed as a dashboard widget | Kept, but demoted to lowest build priority (Phase 5, optional) | Doesn't reduce mental load or add function. Harmless, but not worth agent build time before core modules exist. |
| 12 | Grade tracking on assignments implied full GPA logic | Kept scope to storing a grade per assignment only. No GPA calculation, no weighting engine | GPA calculation rules vary by institution and are out of scope for a personal OS; storing the number is enough. |
| 13 | Team Performance as its own module | Folded into the **Work** section as a computed view over `standups` + `projects`, not a separate table set | It's a report, not new data. Treating it as a first-class module was going to produce a duplicate of data already captured by daily standups and project status. |

---

## 3. Product Goals

- **G1** — One app, opened once each morning, answers "what matters today" without the user assembling it from memory.
- **G2** — Capturing a task, idea, or log entry never takes more than two actions from anywhere in the app.
- **G3** — No data is ever silently lost; the user can always recover to yesterday.
- **G4** — The system works completely with no internet connection.
- **G5** — The data model does not need to be rebuilt when a second user (family member, teammate) is eventually added.
- **G6** — Every module follows the same interaction pattern (list → detail → quick edit) so learning one module teaches all of them.

---

## 4. Success Metrics

Single-user product — metrics are personal usage signals, not growth metrics.

| Metric | Target |
|---|---|
| Days per week the dashboard is opened before 9am | 6–7 |
| Median time from "I need to log/add something" to done | < 10 seconds |
| Habit logging completion rate (30-day rolling) | ≥ 80% |
| Overdue client follow-ups at any given time | 0 |
| Missed assignment deadlines per semester | 0 |
| Data loss incidents | 0 |
| Monthly review completed on time | 12/12 months |

---

## 5. User Personas

**Primary — "The Operator-Student" (the only user in v1)**
Full-time production manager and college student running multiple software projects simultaneously. Needs one surface for: today's schedule, team status, client follow-ups, coursework deadlines, personal habits, and finances. Opens the app once in the morning and periodically through the day for quick capture. Values speed and low friction over configurability. Comfortable with keyboard shortcuts.

**Future — "Team Member" (post-v1, not built now)**
A collaborator who would only see the Work module (standups, their assigned tasks, project status) — not the personal Life/College/Finance data. This persona exists only to validate that the schema's `user_id` + module boundaries don't have to be re-architected later; no UI is built for them in v1.

---

## 6. Information Architecture

```
KaizenLife
├── Today (default landing)
│   ├── Dashboard
│   └── Daily Planner
├── Life
│   ├── Habits
│   ├── Daily Check-In (sleep + mood + energy + stress)
│   └── Diary
├── College
│   ├── Schedule
│   ├── Assignments
│   └── Semester Overview
├── Work
│   ├── Daily Standup
│   ├── Projects
│   ├── Clients & Follow-ups
│   ├── Meetings
│   └── Team Performance (report view)
├── Finance
│   └── Transactions & Monthly Summary
├── Review & Goals
│   ├── Goals (Annual / Monthly / Weekly)
│   ├── Monthly Review
│   └── Statistics
└── Settings
    ├── Profile & Preferences
    ├── Habit Configuration
    ├── Notification Settings
    └── Backup & Export
```

Cross-cutting, available from every screen: **Quick Capture** (floating action + keyboard shortcut) and **Command Palette** (`Cmd/Ctrl+K`).

---

## 7. Navigation Flow

- **Persistent left sidebar** (desktop) with the 6 grouped sections + Settings; collapses to icon-only.
- **Persistent top bar**: current date, quick capture button, command palette trigger, notification bell.
- **Mobile**: bottom tab bar with Today / Life / Work / More (College, Finance, Review, Settings collapse into "More").
- Every module follows the same three-level pattern:
  1. **List/Timeline view** — scannable, filterable.
  2. **Detail view** — full record, edit in place.
  3. **Quick-edit** — inline or slide-over panel for single-field changes (status, priority) without leaving the list.
- Command palette actions: jump to any module, create any entity type, search across tasks/assignments/clients/projects by title.

---

## 8. Functional Requirements

Format: `FR-<MODULE>-<n>`. This list is the build checklist — every ID must be implemented and demonstrable before a module is considered done.

### Dashboard
- **FR-DASH-1**: Show today's time-blocked schedule (from Planner) in chronological order.
- **FR-DASH-2**: Show today's top 3–5 priorities (tasks flagged high/urgent, due today).
- **FR-DASH-3**: Show today's habit checklist with one-tap complete/increment.
- **FR-DASH-4**: Show yesterday's sleep summary and 7-day sleep average.
- **FR-DASH-5**: Show current month's income/expense/net so far.
- **FR-DASH-6**: Show active projects with progress bars, sorted by nearest deadline.
- **FR-DASH-7**: Show upcoming deadlines (assignments + project deadlines) within the next 7 days.
- **FR-DASH-8**: Show overdue client follow-ups, highlighted (red).
- **FR-DASH-9**: Show a daily quote (static local list, no external call). Lowest priority.
- **FR-DASH-10**: Every widget on the dashboard is a link into its full module.

### Daily Planner
- **FR-PLAN-1**: Time-block calendar view (day view default, week view optional).
- **FR-PLAN-2**: Create/edit/delete a task with: title (required), description, date, start/end time, estimated duration, priority, status, notes.
- **FR-PLAN-3**: Drag to reschedule a time block.
- **FR-PLAN-4**: Mark complete without opening the detail view.
- **FR-PLAN-5**: Tasks may optionally link to a `project_id` (Work) or `course_id` (College) to appear in both contexts.
- **FR-PLAN-6**: Overlapping time blocks are visually flagged, not blocked.

### Habits
- **FR-HAB-1**: Define a habit: name, icon, category, frequency (daily / N times per week / custom days), active/archived.
- **FR-HAB-2**: System auto-generates today's expected habit rows on first app open of the day.
- **FR-HAB-3**: Log completion (boolean or count toward target) per habit per day.
- **FR-HAB-4**: Backdate a missed log entry (yesterday and earlier, bounded — see §14).
- **FR-HAB-5**: Compute current streak and longest streak per habit.
- **FR-HAB-6**: Monthly completion-rate view per habit and overall.
- **FR-HAB-7**: Archiving a habit preserves historical logs; it stops generating new rows.

### Daily Check-In (Sleep + Mood + Energy + Stress)
- **FR-CHK-1**: One combined form per day: bed time, wake time, nap minutes, sleep quality (1–5), mood (1–10), energy (1–10), stress (1–10), optional note.
- **FR-CHK-2**: Auto-calculate total sleep duration from bed/wake time, editable override.
- **FR-CHK-3**: One check-in per calendar date (upsert, not duplicate).
- **FR-CHK-4**: Dashboard shows 7-day rolling averages for sleep, mood, energy, stress.

### Diary
- **FR-DIARY-1**: Daily entry with three prompts (grateful for / today's lesson / tomorrow's focus) + free text.
- **FR-DIARY-2**: One entry per date (upsert).
- **FR-DIARY-3**: Chronological browsable history, searchable by text.

### College
- **FR-COL-1**: Manage courses: name, code, lecturer, room, semester, color tag.
- **FR-COL-2**: Weekly recurring class schedule per course (day, start/end time, room).
- **FR-COL-3**: Assignment tracker: course, title, due date, priority, status, grade (optional).
- **FR-COL-4**: Semester timeline showing assignments, midterms, finals, and custom important dates on one view.
- **FR-COL-5**: Assignments due within 7 days surface on the Dashboard.

### Work
- **FR-WORK-1**: Daily standup entry per team member: project, current task, today's target, actual result, blocker, status.
- **FR-WORK-2**: Team member registry (name, role, active flag) — lightweight, not a full HR module.
- **FR-WORK-3**: Project tracker: name, client, progress %, deadline, priority, status, PIC.
- **FR-WORK-4**: Client registry with contact info and notes.
- **FR-WORK-5**: Follow-up tracker per client: last contact date, next follow-up date, status, notes.
- **FR-WORK-6**: System auto-flags a follow-up as overdue when `next_followup_date < today` and status isn't done.
- **FR-WORK-7**: Meeting notes: date, agenda, decisions, linked project (optional).
- **FR-WORK-8**: Action items per meeting: description, PIC, deadline, status.
- **FR-WORK-9**: Team Performance is a computed report (completed/pending/blocked/overdue counts) — no separate data entry.

### Finance
- **FR-FIN-1**: Log a transaction: date, type (income/expense), amount, category, account (cash/bank), note.
- **FR-FIN-2**: Running cash-on-hand and bank balance computed from transaction history (not manually entered).
- **FR-FIN-3**: Monthly summary: total income, total expense, net, breakdown by category.
- **FR-FIN-4**: Amounts stored as integer minor units (cents), never floats.
- **FR-FIN-5**: No budgets, no double-entry, no multi-currency in v1.

### Goals
- **FR-GOAL-1**: Create a goal with type (annual/monthly/weekly), period, optional target value + unit, optional link to a habit.
- **FR-GOAL-2**: Weekly goals may link to a parent monthly goal; monthly to a parent annual goal (optional hierarchy).
- **FR-GOAL-3**: Progress auto-computed when linked to a habit or numeric target; manually updatable otherwise.

### Monthly Review
- **FR-REV-1**: Auto-drafted monthly summary (habit completion %, finance net, work stats, college stats) generated from existing data.
- **FR-REV-2**: User adds: biggest achievement, biggest lesson, next month's priorities.
- **FR-REV-3**: One review per calendar month (upsert).

### Statistics
- **FR-STAT-1**: Charts (line/bar) for habits, sleep, mood/energy/stress, finance, and project progress, filterable by date range (7/30/90/365 days).

### Notifications (v1 scope — see §16 for delivery constraints)
- **FR-NOTIF-1**: In-app reminder center listing upcoming/overdue: habits not yet done today, deadlines within 24h, overdue follow-ups, upcoming meetings.
- **FR-NOTIF-2**: OS-level browser push notifications are v1.1 (Notification API, requires the app tab or an installed PWA process running).

### Quick Capture & Command Palette
- **FR-QC-1**: A single global input (keyboard shortcut + floating button) creates a task from anywhere with just a title; all other fields optional/deferred.
- **FR-CP-1**: `Cmd/Ctrl+K` opens a palette to navigate to any module, create any entity, or search existing records by title.

### Settings & Data
- **FR-SET-1**: Configure the default habit list, timezone, and theme (light/dark).
- **FR-SET-2**: Manual "Export data" (JSON) and "Backup now" (copies the SQLite file) actions.
- **FR-SET-3**: Scheduled automatic local backup (daily, keeping last N copies).

---

## 9. Non-Functional Requirements

- **NFR-1 (Performance)**: Dashboard renders from local data in under 300ms on the target machine; no request should block the UI thread.
- **NFR-2 (Offline/local-first)**: No feature depends on internet access. All network calls are to `localhost` only.
- **NFR-3 (Data durability)**: Every write is committed to SQLite synchronously before the API returns success; automatic daily backup retained for at least 14 days.
- **NFR-4 (Installability)**: The web app is installable as a PWA (manifest + service worker caching the app shell).
- **NFR-5 (Accessibility)**: All interactive elements reachable by keyboard; command palette is a first-class input method, not a bonus.
- **NFR-6 (Type safety)**: End-to-end TypeScript, request/response shapes validated with Zod on the API boundary and shared with the frontend via a shared types package.
- **NFR-7 (Portability)**: Single Bun process, single SQLite file — the entire app/data can be copied to another machine by copying one folder.
- **NFR-8 (Extensibility)**: Adding a new module must not require changes to existing modules' code (see Appendix H).

---

## 10. User Stories

- As the user, I want to open the app in the morning and see everything I need for today in one screen, so I don't have to check five apps.
- As the user, I want to capture a task in under 5 seconds from any screen, so a stray thought doesn't get lost while I'm mid-task.
- As the user, I want to log yesterday's sleep and habits if I forgot last night, so a missed evening doesn't break my streak unfairly.
- As the user, I want overdue client follow-ups to visually scream at me, so I never lose a client from forgetfulness.
- As the user, I want my assignment deadlines and work deadlines in the same "upcoming" view, so I stop double-booking myself across school and work.
- As the user, I want a monthly review that's mostly pre-filled from my own data, so reflection doesn't become another data-entry chore.
- As the user, I want to export or back up my data with one click, so I'm never one hard-drive failure away from losing years of logs.
- As the user, I want the app fully usable without internet, so a bad connection never blocks my planning.

---

## 11. Feature Specifications

Each spec below expands the corresponding FR set with UI-level detail sufficient to build without further clarification.

### Dashboard
Single scrollable page, card grid (responsive: 1 col mobile, 2 col tablet, 3 col desktop). Card order (top to bottom / left to right, fixed — not user-configurable in v1): Today's Schedule → Today's Priorities → Habit Checklist → Overdue Follow-ups (only rendered if non-empty) → Upcoming Deadlines (7 days) → Active Projects → Finance Summary (this month) → Sleep/Mood/Energy 7-day summary → Daily Quote (bottom, collapsible). Overdue items always render above their non-overdue equivalents within a card.

### Quick Capture
Floating action button bottom-right on all screens + `N` keyboard shortcut. Opens a single-line input with a type selector defaulting to "Task." Pressing Enter creates the record with only the title set; a toast confirms creation with an "Edit details" link. This is the only creation flow that must work in under 2 actions.

### Habits — Recurrence Engine
On first API call of a new local date, the backend checks each active habit's frequency rule against today; if no `habit_log` row exists for (habit_id, today) and the habit is scheduled for today, a row is created with `completed_count = 0`. This runs server-side on the `/api/v1/dashboard/today` and `/api/v1/habits` endpoints (idempotent, safe to run repeatedly).

### Client Follow-ups
`next_followup_date` is required when a follow-up status is set to "pending." A background computed field (`is_overdue`) is `true` when `next_followup_date < today AND status != 'done'`. Dashboard and Work module both query this computed flag, not a stored one, so it's always correct without a cron job.

### Finance
Two entry points: quick "+Income"/"+Expense" buttons (amount + category only, date defaults to today) and a full form (all fields). Monthly summary view groups by category with a horizontal bar chart, plus a running balance line chart for the month.

### Monthly Review
Triggered manually or auto-prompted on the 1st of a new month for the prior month. Pre-fills: habit completion % (from habit_logs), finance net (from transactions), work stats (completed/overdue tasks, projects closed), college stats (assignments completed on time). User fills the three reflection fields and submits.

---

## 12. Data Model (High Level)

Core entity relationships (full schema in Appendix B):

- `users` (1) → (many) everything else, via `user_id` on every table.
- `tasks` is the universal work-item table: used standalone (Planner), linked to `projects` (Work), or linked to `courses`/`assignments` (College) via nullable foreign keys — avoids three duplicate "to-do" tables.
- `habits` (1) → (many) `habit_logs` (one row per active day).
- `checkins` — one row per user per date, holds sleep + mood + energy + stress together.
- `courses` (1) → (many) `course_schedule`, `assignments`.
- `semesters` (1) → (many) `courses`, `semester_events`.
- `projects` (1) → (many) `standups`, and optionally linked to a `client`.
- `clients` (1) → (many) `client_followups`.
- `meetings` (1) → (many) `meeting_action_items`.
- `goals` — self-referential `parent_goal_id` for annual → monthly → weekly rollup; optional `linked_habit_id`.
- `transactions` — flat, no relations beyond `user_id`.
- `monthly_reviews` — one per (user, year, month).
- `reminders` — polymorphic `reference_type` + `reference_id` pointing at any of the above.

All primary keys are UUID text. All tables have `created_at`, `updated_at`, `deleted_at` (soft delete). See Appendix B for full Drizzle definitions.

---

## 13. Edge Cases

- **Midnight-crossing sleep**: a sleep session from 23:30 to 06:30 is logged against the *wake date*, not the bed date — this is the date the check-in "belongs to" for streak/dashboard purposes.
- **Backdating**: habit logs, check-ins, and diary entries can be created/edited for any date up to 90 days in the past; beyond that, edit is blocked in the UI (data integrity, not a hard DB constraint).
- **Duplicate daily singleton records**: `checkins`, `diary_entries`, and `monthly_reviews` are upserts keyed on `(user_id, date)` / `(user_id, year, month)` — the UI never allows creating a second row for the same date.
- **Deleting a habit with history**: soft delete only (`deleted_at` set); historical `habit_logs` remain queryable in Statistics but the habit disappears from today's checklist.
- **Deleting a project/client with linked records**: soft delete only; linked tasks/follow-ups show a "linked project archived" badge rather than breaking.
- **Overlapping time blocks**: allowed (real life overlaps), UI renders them side-by-side with a visual warning icon, no hard block.
- **Recurring task regeneration re-run**: the habit-log generation check (§11) is idempotent — re-running it for a date that already has rows is a no-op, preventing duplicate rows.
- **Currency rounding**: all amounts stored as integer cents; UI formats for display only, never computes on floats.
- **Weekly-target habit streak**: "streak" for an N-times-per-week habit counts consecutive *weeks* meeting the target, not consecutive days.
- **Server not reachable**: since v1 requires the local Bun server, the frontend shows a clear "Can't reach KaizenLife server — is it running?" state rather than a blank screen or silent failure.
- **Large historical datasets**: date-range indexes on every `date`/`created_at` column; Statistics queries are always bounded by an explicit date range, never "select all."

---

## 14. Validation Rules

- `title` required, 1–200 chars, on tasks/assignments/projects/goals/habits/clients.
- `date` fields: valid ISO date, not more than 1 year in the future (planner/assignments), not more than 90 days in the past for edits (see Edge Cases).
- Time blocks: `end_time` must be after `start_time`.
- `priority`: enum `low | medium | high | urgent`, default `medium`.
- `status` enums are fixed per entity (see Appendix B) — no free text status fields.
- Mood / Energy / Stress: integer 1–10 inclusive.
- Sleep quality: integer 1–5 inclusive.
- Finance `amount`: positive integer (cents); sign is derived from `type`, never stored as negative.
- `category` required on every transaction (free text, but autocompletes from prior entries).
- Habit `target_count_per_period`: positive integer, required when frequency is not `daily`.
- One `checkins` / `diary_entries` row per `(user_id, date)` — enforced by a unique DB constraint, not just UI logic.
- One `monthly_reviews` row per `(user_id, year, month)` — enforced by a unique DB constraint.

---

## 15. UX Principles

1. **One glance, not one scroll.** The dashboard's critical info fits above the fold on a laptop screen.
2. **Capture beats organize.** Getting something out of the user's head is always faster than filing it correctly; filing can happen later.
3. **Sensible defaults everywhere.** Only a title is ever required to create something; every other field has a default or is optional.
4. **One interaction pattern, everywhere.** List → detail → quick-edit, the same three levels in every module.
5. **Progressive disclosure.** Advanced fields live behind "More options," never in the primary form.
6. **No dead ends.** Every empty state has one clear, single-button next action.
7. **Reversible by default.** Destructive actions (delete) show an "Undo" toast for 5 seconds before committing; there is no "are you sure?" modal for anything reversible.
8. **Keyboard-first.** Every primary action has a shortcut; the command palette is treated as a top-level input method, not a hidden power-user feature.

---

## 16. Technical Constraints

- **Local-first, not zero-server offline.** The app requires the local Bun+Hono process running on `localhost`. "Offline" means "no internet dependency," not "works with the server closed." A true server-less offline mode (client-side SQLite via WASM) is roadmap (§17), not v1 — this is a deliberate scope cut, not an oversight.
- **OS push notifications require an open tab/installed PWA process.** Browser Notification API cannot fire if the app isn't running at all; this is a platform limitation, not a bug. In-app reminders (rendered on load) are the v1 reliability baseline.
- **Astro is used as a multi-page app (MPA), not a client-side SPA shell.** Each module is its own Astro route with a static, non-hydrated Sidebar/Topbar layout and exactly one React island (`client:load`) for that module's interactive content. This keeps per-page JS minimal and matches Astro's intended usage — a single giant SPA island would fight the framework. The Command Palette is a small persistent island loaded in the base layout on every page.
- **shadcn/ui is React-based**; it is installed via Astro's `@astrojs/react` integration. Components are copied into `components/ui` per shadcn's standard CLI workflow, not installed as an npm dependency.
- **Server-state caching** uses TanStack Query (added — not in the original stack list, see Design Decisions) inside each React island; **Zustand** is reserved for pure client/UI state (modal open/closed, selected date, active filters) that doesn't need server sync.
- **All money values** are integers (cents) end-to-end, including in the Zod schemas shared between frontend and backend.
- **Single deployment artifact**: `bun run build` produces the Astro static output; the Hono server serves that static output and the `/api/*` routes from one process on one port.

---

## 17. Future Roadmap

- **v1.1** — OS-level push notifications; daily quote rotation; PWA install prompt polish.
- **v1.2** — Prayer time calculation (local astronomical calculation, e.g. via an offline-capable library, configurable calculation method + location — no internet call required).
- **v2.0** — Multi-device sync (schema already supports it via UUIDs + `updated_at`; needs a conflict-resolution/sync layer, e.g. last-write-wins or a change-log table).
- **v2.1** — True zero-server offline mode via client-side SQLite (WASM) with background sync to the Bun server when reachable.
- **v3.0** — Multi-user support: team members get scoped accounts seeing only the Work module (§5, "Team Member" persona); plugin architecture (Appendix G) opens to third-party modules.

---

## 18. Out of Scope (v1)

- Cloud sync / multi-device access.
- Multi-user accounts, auth, and permissions (schema-ready, UI not built).
- Multi-currency finance, budgeting, or double-entry accounting.
- GPA/weighted grade calculation.
- Native mobile app (PWA install only).
- Prayer time calculation (deferred to v1.2).
- OS push notifications (deferred to v1.1).
- Third-party integrations of any kind (calendar sync, bank sync, Slack, etc.).
- AI-generated content/suggestions within the app itself.

---

## 19. Risks

- **Scope creep.** Six sections and ~20 entities is already substantial for a solo-maintained tool; any addition must pass the "reduce mental load" test in §2 or be rejected.
- **Logging fatigue.** Even after consolidation, daily check-in + habits + planner is real daily input. If completion rate drops, the fix is cutting fields, not adding gamification.
- **Single point of failure.** One local machine, one SQLite file. Mitigated by NFR-3 (automatic backups) but not eliminated until v2.0 sync.
- **Astro + shadcn/React island seams.** Persistent UI (command palette, toasts, reminder bell) must be deliberately built as islands that survive MPA navigation; getting this wrong produces flickering/reset state between pages.
- **Notification promises exceeding platform capability.** Already scoped down in §16; must be communicated clearly in the UI so the user doesn't rely on a push notification that can't fire.

---

## 20. Open Questions

- Should the eventual prayer-time feature use a fixed location/calculation method, or should it be configurable per travel?
- Is a desktop tray/background process (to keep the Bun server always running, enabling real push notifications) wanted before v2.0, or is "open the app to start the server" acceptable indefinitely?
- When multi-device sync eventually arrives, is last-write-wins acceptable, or does conflict data (e.g., two devices logging different sleep times for the same night) need manual merge UI?
- Should Team Members (v3.0) ever get write access, or read-only visibility into their own standups only?

---

## 21. Implementation Plan for AI Build Agents

Build in this exact order. Each phase has a **Definition of Done (DoD)** — do not start the next phase until the current one's DoD is met. This ordering exists so a single agent session can complete a phase and leave the repo in a runnable state at every checkpoint.

### Phase 0 — Scaffolding
- Bun workspace monorepo per Appendix A.
- Astro project (`apps/web`) with `@astrojs/react`, Tailwind, shadcn/ui initialized (`components.json`).
- Hono project (`apps/api`) with a health-check route.
- Shared types package (`packages/shared`) with Zod schemas, empty to start.
- **DoD**: `bun run dev` starts both processes; Astro page loads; `/api/health` returns 200.

### Phase 1 — Data Layer
- Implement full Drizzle schema (Appendix B).
- Migrations run against a local SQLite file.
- Seed script: one default user, the user's original default habit list (five daily prayers, Quran reading, exercise, shower ×2, journal, drink water, stretching, vitamins).
- **DoD**: `bun run db:migrate && bun run db:seed` produces a working local DB; all tables queryable.

### Phase 2 — Core Daily Loop (MVP)
- API + UI for: Dashboard, Daily Planner, Habits (with recurrence engine), Daily Check-In, Diary, Quick Capture, Command Palette.
- **DoD**: a full day can be lived in the app — plan the day, check off habits, log check-in, capture a stray task via the palette, write a diary entry — using only local data, no other module needed.

### Phase 3 — College & Work
- API + UI for: Courses, Course Schedule, Assignments, Semesters; Standups, Team Members, Projects, Clients, Follow-ups (with overdue computation), Meetings, Action Items, Team Performance report.
- **DoD**: a course + assignment can be created and appears on the Dashboard's upcoming-deadlines widget; a client follow-up set in the past correctly shows as overdue everywhere it's surfaced.

### Phase 4 — Finance, Goals, Review, Statistics
- API + UI for: Transactions + Monthly Summary, Goals (with hierarchy), Monthly Review (auto-draft), Statistics charts.
- **DoD**: a month's worth of seeded data produces a correct auto-drafted monthly review and correct charts across all five chart types.

### Phase 5 — Reliability & Polish
- Backup/export (manual + scheduled).
- In-app reminder center.
- PWA manifest + service worker (app shell caching).
- Daily quote widget.
- **DoD**: app is installable as a PWA; a manual backup produces a restorable `.sqlite` copy; reminder center correctly lists all overdue/upcoming items across modules.

At the end of Phase 5, every FR in §8 must be checked off and demonstrable.

---

## Appendix A — Folder Structure

```
kaizenlife/
├── apps/
│   ├── web/                          # Astro frontend (MPA + React islands)
│   │   ├── src/
│   │   │   ├── pages/
│   │   │   │   ├── index.astro               # Today/Dashboard
│   │   │   │   ├── planner.astro
│   │   │   │   ├── life/
│   │   │   │   │   ├── habits.astro
│   │   │   │   │   ├── checkin.astro
│   │   │   │   │   └── diary.astro
│   │   │   │   ├── college/
│   │   │   │   │   ├── schedule.astro
│   │   │   │   │   ├── assignments.astro
│   │   │   │   │   └── semester.astro
│   │   │   │   ├── work/
│   │   │   │   │   ├── standup.astro
│   │   │   │   │   ├── projects.astro
│   │   │   │   │   ├── clients.astro
│   │   │   │   │   ├── meetings.astro
│   │   │   │   │   └── performance.astro
│   │   │   │   ├── finance.astro
│   │   │   │   ├── review/
│   │   │   │   │   ├── goals.astro
│   │   │   │   │   ├── monthly.astro
│   │   │   │   │   └── stats.astro
│   │   │   │   └── settings.astro
│   │   │   ├── layouts/
│   │   │   │   └── BaseLayout.astro          # Sidebar/Topbar, static + CommandPalette island
│   │   │   ├── islands/                      # one root React component per Astro page
│   │   │   │   ├── DashboardApp.tsx
│   │   │   │   ├── PlannerApp.tsx
│   │   │   │   ├── HabitsApp.tsx
│   │   │   │   ├── ... (one per page)
│   │   │   │   └── CommandPaletteApp.tsx      # persistent, loaded in BaseLayout
│   │   │   ├── components/
│   │   │   │   ├── ui/                        # shadcn-generated primitives
│   │   │   │   └── shared/                    # cross-module composed components
│   │   │   ├── stores/                        # zustand: one store per module (UI state only)
│   │   │   ├── queries/                       # TanStack Query hooks per module
│   │   │   ├── lib/
│   │   │   │   ├── api-client.ts
│   │   │   │   ├── date.ts                    # day.js helpers
│   │   │   │   └── format.ts
│   │   │   └── styles/global.css
│   │   ├── public/manifest.json
│   │   ├── astro.config.ts
│   │   ├── tailwind.config.ts
│   │   └── components.json
│   └── api/                          # Bun + Hono backend
│       ├── src/
│       │   ├── index.ts                       # entrypoint: serves web dist + mounts /api
│       │   ├── db/
│       │   │   ├── schema.ts
│       │   │   ├── client.ts
│       │   │   ├── seed.ts
│       │   │   └── migrations/
│       │   ├── routes/                        # one file per resource, see Appendix C
│       │   ├── services/                      # business logic (recurrence engine, overdue calc, review auto-draft)
│       │   ├── lib/
│       │   └── middleware/
│       └── package.json
├── packages/
│   └── shared/
│       └── src/
│           ├── schemas/                       # zod schemas, one per entity
│           └── types/
├── package.json                      # bun workspaces root
└── README.md
```

---

## Appendix B — Database Schema (Drizzle)

SQLite dialect. All tables share this pattern (omitted below for brevity, apply to every table): `id: text (uuid, pk)`, `user_id: text (fk -> users.id)`, `created_at: integer (unix ms)`, `updated_at: integer (unix ms)`, `deleted_at: integer nullable`.

```ts
// db/schema.ts (excerpt — representative tables; apply the shared columns above to all)

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email"),
  timezone: text("timezone").notNull().default("Asia/Jakarta"),
  createdAt: integer("created_at").notNull(),
});

export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  date: text("date"),                          // YYYY-MM-DD
  startTime: text("start_time"),                // HH:mm
  endTime: text("end_time"),
  estimatedDurationMin: integer("estimated_duration_min"),
  priority: text("priority", { enum: ["low", "medium", "high", "urgent"] }).notNull().default("medium"),
  status: text("status", { enum: ["todo", "in_progress", "done", "cancelled"] }).notNull().default("todo"),
  projectId: text("project_id"),                // nullable FK -> projects.id
  courseId: text("course_id"),                  // nullable FK -> courses.id
  tags: text("tags"),                           // JSON array as text
  completedAt: integer("completed_at"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
  deletedAt: integer("deleted_at"),
});

export const habits = sqliteTable("habits", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  icon: text("icon"),
  category: text("category"),
  frequency: text("frequency", { enum: ["daily", "weekly_n", "custom_days"] }).notNull().default("daily"),
  targetCountPerPeriod: integer("target_count_per_period").notNull().default(1),
  customDays: text("custom_days"),              // JSON array of weekday ints, if custom_days
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: integer("created_at").notNull(),
  archivedAt: integer("archived_at"),
});

export const habitLogs = sqliteTable("habit_logs", {
  id: text("id").primaryKey(),
  habitId: text("habit_id").notNull(),
  date: text("date").notNull(),                 // YYYY-MM-DD
  completedCount: integer("completed_count").notNull().default(0),
  targetCount: integer("target_count").notNull(),
  note: text("note"),
  createdAt: integer("created_at").notNull(),
}, (t) => ({
  uniqHabitDate: unique().on(t.habitId, t.date),
}));

export const checkins = sqliteTable("checkins", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  date: text("date").notNull(),
  bedTime: text("bed_time"),
  wakeTime: text("wake_time"),
  napMinutes: integer("nap_minutes").default(0),
  totalSleepMinutes: integer("total_sleep_minutes"),
  sleepQuality: integer("sleep_quality"),        // 1-5
  mood: integer("mood"),                         // 1-10
  energy: integer("energy"),                     // 1-10
  stress: integer("stress"),                     // 1-10
  note: text("note"),
  createdAt: integer("created_at").notNull(),
}, (t) => ({
  uniqUserDate: unique().on(t.userId, t.date),
}));

export const diaryEntries = sqliteTable("diary_entries", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  date: text("date").notNull(),
  gratefulFor: text("grateful_for"),
  lessonLearned: text("lesson_learned"),
  tomorrowFocus: text("tomorrow_focus"),
  freeText: text("free_text"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (t) => ({ uniqUserDate: unique().on(t.userId, t.date) }));

export const semesters = sqliteTable("semesters", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
});

export const courses = sqliteTable("courses", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  semesterId: text("semester_id").notNull(),
  name: text("name").notNull(),
  code: text("code"),
  lecturer: text("lecturer"),
  room: text("room"),
  color: text("color"),
});

export const courseSchedule = sqliteTable("course_schedule", {
  id: text("id").primaryKey(),
  courseId: text("course_id").notNull(),
  dayOfWeek: integer("day_of_week").notNull(),   // 0-6
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  room: text("room"),
});

export const assignments = sqliteTable("assignments", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  courseId: text("course_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  dueDate: text("due_date").notNull(),
  priority: text("priority", { enum: ["low", "medium", "high", "urgent"] }).notNull().default("medium"),
  status: text("status", { enum: ["not_started", "in_progress", "submitted", "graded"] }).notNull().default("not_started"),
  grade: text("grade"),
  createdAt: integer("created_at").notNull(),
});

export const semesterEvents = sqliteTable("semester_events", {
  id: text("id").primaryKey(),
  semesterId: text("semester_id").notNull(),
  title: text("title").notNull(),
  date: text("date").notNull(),
  type: text("type", { enum: ["midterm", "final", "deadline", "other"] }).notNull(),
});

export const teamMembers = sqliteTable("team_members", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  role: text("role"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
});

export const clients = sqliteTable("clients", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  company: text("company"),
  contactInfo: text("contact_info"),
  notes: text("notes"),
});

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  clientId: text("client_id"),
  status: text("status", { enum: ["planning", "active", "on_hold", "completed", "cancelled"] }).notNull().default("planning"),
  priority: text("priority", { enum: ["low", "medium", "high", "urgent"] }).notNull().default("medium"),
  deadline: text("deadline"),
  progressPct: integer("progress_pct").notNull().default(0),
  pic: text("pic"),
  description: text("description"),
  createdAt: integer("created_at").notNull(),
});

export const clientFollowups = sqliteTable("client_followups", {
  id: text("id").primaryKey(),
  clientId: text("client_id").notNull(),
  lastContactDate: text("last_contact_date"),
  nextFollowupDate: text("next_followup_date"),
  status: text("status", { enum: ["pending", "done"] }).notNull().default("pending"),
  notes: text("notes"),
  createdAt: integer("created_at").notNull(),
  // is_overdue is computed at query time: next_followup_date < today AND status = 'pending'
});

export const standups = sqliteTable("standups", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  teamMemberId: text("team_member_id").notNull(),
  projectId: text("project_id"),
  date: text("date").notNull(),
  currentTask: text("current_task"),
  todayTarget: text("today_target"),
  actualResult: text("actual_result"),
  blocker: text("blocker"),
  status: text("status", { enum: ["on_track", "at_risk", "blocked"] }).notNull().default("on_track"),
  createdAt: integer("created_at").notNull(),
});

export const meetings = sqliteTable("meetings", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  projectId: text("project_id"),
  date: text("date").notNull(),
  agenda: text("agenda"),
  decisions: text("decisions"),
  createdAt: integer("created_at").notNull(),
});

export const meetingActionItems = sqliteTable("meeting_action_items", {
  id: text("id").primaryKey(),
  meetingId: text("meeting_id").notNull(),
  description: text("description").notNull(),
  pic: text("pic"),
  deadline: text("deadline"),
  status: text("status", { enum: ["open", "done"] }).notNull().default("open"),
});

export const transactions = sqliteTable("transactions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  date: text("date").notNull(),
  type: text("type", { enum: ["income", "expense"] }).notNull(),
  amountCents: integer("amount_cents").notNull(),
  category: text("category").notNull(),
  account: text("account", { enum: ["cash", "bank"] }).notNull(),
  note: text("note"),
  createdAt: integer("created_at").notNull(),
});

export const goals = sqliteTable("goals", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  type: text("type", { enum: ["annual", "monthly", "weekly"] }).notNull(),
  periodStart: text("period_start").notNull(),
  periodEnd: text("period_end").notNull(),
  targetValue: real("target_value"),
  currentValue: real("current_value").default(0),
  unit: text("unit"),
  status: text("status", { enum: ["not_started", "in_progress", "completed", "abandoned"] }).notNull().default("not_started"),
  parentGoalId: text("parent_goal_id"),
  linkedHabitId: text("linked_habit_id"),
});

export const monthlyReviews = sqliteTable("monthly_reviews", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  year: integer("year").notNull(),
  month: integer("month").notNull(),
  biggestAchievement: text("biggest_achievement"),
  biggestLesson: text("biggest_lesson"),
  nextMonthPriorities: text("next_month_priorities"),
  autoSummaryJson: text("auto_summary_json"),
  createdAt: integer("created_at").notNull(),
}, (t) => ({ uniqUserMonth: unique().on(t.userId, t.year, t.month) }));

export const reminders = sqliteTable("reminders", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  type: text("type", { enum: ["habit", "deadline", "followup", "meeting"] }).notNull(),
  referenceType: text("reference_type").notNull(),
  referenceId: text("reference_id").notNull(),
  triggerAt: integer("trigger_at").notNull(),
  status: text("status", { enum: ["pending", "sent", "dismissed"] }).notNull().default("pending"),
});
```

Indexes: add a `(user_id, date)` index on every table with a `date` column, and a `(reference_type, reference_id)` index on `reminders`.

---

## Appendix C — API Architecture

REST, versioned under `/api/v1`, resource-based. Zod schemas in `packages/shared` validate every request body and are reused by the frontend for form validation.

| Resource | Endpoints |
|---|---|
| Dashboard | `GET /dashboard/today` (aggregates schedule, priorities, habits, finance, projects, deadlines, overdue follow-ups in one call) |
| Tasks | `GET/POST /tasks`, `GET/PATCH/DELETE /tasks/:id` |
| Habits | `GET/POST /habits`, `PATCH/DELETE /habits/:id`, `POST /habits/:id/log`, `GET /habits/:id/stats` |
| Check-ins | `GET /checkins?range=`, `PUT /checkins/:date` (upsert) |
| Diary | `GET /diary?range=`, `PUT /diary/:date` (upsert) |
| Courses | `GET/POST /courses`, `PATCH/DELETE /courses/:id`, `GET/POST /courses/:id/schedule` |
| Assignments | `GET/POST /assignments`, `PATCH/DELETE /assignments/:id` |
| Semesters | `GET/POST /semesters`, `GET/POST /semesters/:id/events` |
| Team Members | `GET/POST /team-members`, `PATCH/DELETE /team-members/:id` |
| Standups | `GET/POST /standups?date=` |
| Projects | `GET/POST /projects`, `PATCH/DELETE /projects/:id` |
| Clients | `GET/POST /clients`, `PATCH/DELETE /clients/:id`, `GET/POST /clients/:id/followups` |
| Meetings | `GET/POST /meetings`, `GET/POST /meetings/:id/action-items` |
| Finance | `GET/POST /transactions`, `PATCH/DELETE /transactions/:id`, `GET /finance/summary?month=` |
| Goals | `GET/POST /goals`, `PATCH/DELETE /goals/:id` |
| Monthly Review | `GET /reviews/:year/:month`, `PUT /reviews/:year/:month` (upsert, includes auto-draft on GET if not yet created) |
| Statistics | `GET /stats/:domain?range=` (domain: habits\|sleep\|mood\|finance\|projects) |
| Reminders | `GET /reminders`, `PATCH /reminders/:id` (dismiss) |
| Settings | `GET/PATCH /settings` |
| Backup | `POST /backup/export`, `POST /backup/now` |
| Search | `GET /search?q=` (cross-entity, powers command palette) |

Error shape (consistent across all endpoints): `{ error: { code: string, message: string, field?: string } }`. Success shape: `{ data: T }`.

---

## Appendix D — State Management Strategy

Two-layer split, deliberately separating server state from UI state:

- **TanStack Query** — owns all server data. One query hook per resource (`useTasks`, `useHabitsToday`, `useFinanceSummary`, etc.) in `queries/`. Handles caching, background refetch, and optimistic updates for quick actions (habit check-off, task complete).
- **Zustand** — owns only ephemeral client/UI state that has no server representation: command palette open/closed, selected planner date, active filters on a list view, quick-capture input value pre-submit. One small store per module, not one giant global store.

Rule of thumb given to the build agent: if the data would still be correct after a page refresh pulling from the API, it belongs in TanStack Query, not Zustand.

---

## Appendix E — Component Architecture

- **`components/ui/`** — unmodified shadcn/ui primitives (Button, Card, Dialog, Command, etc.), generated via the shadcn CLI, never hand-edited beyond theme tokens.
- **`components/shared/`** — composed components used across modules: `EntityList`, `EntityDetailPanel`, `QuickEditPopover`, `PriorityBadge`, `StatusBadge`, `DateRangePicker`, `EmptyState`. Every module's list/detail/quick-edit views are built from these three shared shells (§15, principle 4) rather than each module inventing its own list UI.
- **`islands/<Module>App.tsx`** — the single React root per Astro page; owns routing between that module's list/detail/quick-edit states (no cross-module state needed since each is its own page load).
- Components are function components, typed props via an explicit `interface Props`, no default exports except island roots (required for Astro's `client:load`).

---

## Appendix F — Coding Standards

- TypeScript `strict: true` across all three packages; no `any` (use `unknown` + narrowing).
- ESLint + Prettier, enforced pre-commit.
- Naming: files kebab-case, components PascalCase, hooks `useX`, Zustand stores `useXStore`, Zod schemas `xSchema`.
- All API responses validated with Zod on both sides (backend validates input, frontend validates response shape in dev mode only, stripped in production build).
- No inline business logic in route handlers — routes call `services/`, services call `db/`. Route files stay thin (parse input → call service → return response).
- Every table's soft-delete convention (`deleted_at`) is respected in every query by default (a shared `whereActive()` helper), never ad-hoc `deleted_at IS NULL` scattered through the codebase.
- Commit convention: Conventional Commits (`feat:`, `fix:`, `chore:`).

---

## Appendix G — Plugin Architecture (Future)

Not built in v1, but the module boundary is designed so it can be added without a rewrite. Each module implements a single interface:

```ts
interface KaizenModule {
  id: string;                       // "habits", "finance", ...
  navEntry: { label: string; icon: string; section: string; route: string };
  dashboardWidget?: React.ComponentType;      // optional card contributed to Dashboard
  routes: AstroPageDefinition[];
  apiRouter: Hono;                            // mounted under /api/v1/<id>
  migrations: DrizzleMigration[];
}
```

In v3.0, modules register themselves into a central registry instead of being hard-wired into the sidebar and dashboard grid, enabling third-party or optional modules (e.g., a future "Reading Tracker") to be added without touching core files.

---

## Appendix H — Modular Architecture Principles

- Every module owns its own `routes/`, `services/`, and schema tables — no module imports another module's service layer directly; cross-module data (e.g., a task linked to a project) goes through the shared `tasks` table's nullable foreign key, not a service-to-service call.
- The Dashboard is the only place allowed to aggregate across modules, and it does so by calling each module's own read-only query functions, not by duplicating their logic.
- Shared UI (Appendix E) and shared types (`packages/shared`) are the only sanctioned cross-module coupling points.
- A module can be deleted (its route file, service file, and schema tables removed) without editing any other module's code, aside from removing its entry from the nav config.

---

*End of document.*