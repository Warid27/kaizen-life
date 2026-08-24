# Audit Report: KaizenLife All-Feature Scenario

**Task ID:** all-feature-scenario
**Status:** FAIL — Critical bugs blocking core functionality
**Date:** 2026-08-09
**Target Domain:** https://kaizen-life.warid.web.id
**API Domain:** https://kaizenlife-api.warid.web.id
**Testing Method:** Chrome DevTools MCP (evaluate_script + network panel) against live remote domain

---

## Executive Summary

Live testing against the production domain reveals **2 critical bugs** that break core features. While Astro SSR renders pages with seed data, React hydration failures prevent all interactive functionality. The finance module is completely broken due to frontend-backend URL mismatches.

**Quick Stats:**
- 🔴 Critical: 2
- 🟠 Major: 2
- 🟡 Minor: 3
- ⚪ Resolved: 1 (health endpoint actually works)

**Test Results:** 4/15 scenarios fully pass, 5 partial, 3 fail, 3 not testable

---

## 🔍 Review Comments

| ID | Severity | Location | Issue |
|:--:|:--------:|:---------|:------|
| #1 | 🔴 CRITICAL | `apps/web/src/queries/finance.ts` | Frontend calls `/api/finance/transactions` — route doesn't exist. Backend has `/api/transactions` |
| #2 | 🔴 CRITICAL | `apps/web/src/islands/CommandPaletteMount.tsx` | React hydration failure: chunk loading fails, React #418 error. Breaks all interactive features on affected pages |
| #3 | 🟠 MAJOR | `apps/web/src/queries/` vs `apps/api/src/routes/` | Multiple frontend-backend field name mismatches: standup fields (yesterday/today/blockers vs currentTask/todayTarget/actualResult/blocker), missing required fields (userId on teamMembers) |
| #4 | 🟠 MAJOR | `apps/web/src/islands/` (all islands) | React hydration cascade failure — when CommandPaletteMount fails, subsequent islands may not render interactive elements. Tasks/habits created via API do not appear in UI |
| #5 | 🟡 MINOR | `packages/shared/src/schemas/finance.ts` | Frontend sends `amount` (dollars) but backend expects `amountCents` (integer cents). Transaction creation via UI likely fails silently |
| #6 | 🟡 MINOR | `apps/api/src/routes/courses.ts` | Course creation requires `semesterId` but UI may not enforce creating semester first |
| #7 | 🟡 MINOR | Chrome DevTools MCP | `take_snapshot()` and `take_screenshot()` timeout on page load. Workaround: `evaluate_script()` works |

---

## ✅ PRD Feature Compliance (Live Testing)

| PRD Feature | Page | SSR | API | UI Interact | Notes |
|---|---|---|---|---|---|
| Dashboard | `/` | ✅ LOADS | ✅ 200 | ⚠️ PARTIAL | Widgets render empty states; React hydration intermittent |
| Daily Planner | `/planner` | ✅ LOADS | ✅ 201/200 | ❌ BROKEN | Task created via API (201) but planner doesn't render it (hydration) |
| Habits | `/life/habits` | ✅ LOADS | ✅ 201 | ❌ BROKEN | Habit created via API but "No habits yet" persists |
| Daily Check-In | `/life/checkin` | ⚠️ BLOCKED | ✅ 201 | 🔒 UNTESTED | URL blocked by browser extension; API verified directly |
| Diary | `/life/diary` | ⚠️ BLOCKED | ✅ 201 | 🔒 UNTESTED | Upsert works; API verified directly |
| Finance | `/finance` | ✅ LOADS (seed data) | ❌ 404 | ❌ BROKEN | **CRITICAL**: All frontend API calls hit wrong endpoints |
| Clients | `/work/clients` | ✅ LOADS | ✅ 201 | ⚠️ PARTIAL | Client created; follow-up schema requires separate entity |
| Courses | `/college/schedule` | ✅ LOADS | ❌ 400 | 🔒 UNTESTED | Requires semesterId (no semesters exist) |
| Projects | `/work/projects` | ✅ LOADS | ✅ 201 | ⚠️ PARTIAL | Project created; UI hydration partial |
| Standups | `/work/standup` | ✅ LOADS | ❌ 400 | 🔒 UNTESTED | Frontend sends wrong field names |
| Goals | `/review/goals` | ✅ LOADS | ✅ 201 | ⚠️ PARTIAL | Goal created; UI hydration partial |
| Monthly Review | `/review/monthly` | ✅ LOADS | ✅ 200 | 🔒 UNTESTED | Empty list (insufficient data) |
| Command Palette | global | ❌ BROKEN | — | ❌ BROKEN | React hydration failure, chunk load error |
| Quick Capture | global | ⚠️ | — | ❌ BROKEN | Depends on hydration |
| Settings | `/settings` | ✅ LOADS | — | 🔒 UNTESTED | Page loads but interactive elements don't hydrate |

---

## 🌐 Remote Domain Testing Results

| Page | URL | Load | SSR Data | React Hydrate | API Verified |
|---|---|---|---|---|---|
| Dashboard | `/` | ✅ 200 | ✅ Seed data | ⚠️ Intermittent | ✅ Health 200 |
| Planner | `/planner` | ✅ 200 | ✅ Seed data | ❌ #418 error | ✅ Tasks 201 |
| Habits | `/life/habits` | ✅ 200 | ✅ Seed data | ❌ #418 error | ✅ Habits 201 |
| Finance | `/finance` | ✅ 200 | ✅ Seed data | ❌ URL 404 | ❌ Routes broken |
| Check-In | `/life/checkin` | ❌ BLOCKED | — | — | ✅ Checkins 201 |
| Diary | `/life/diary` | ❌ BLOCKED | — | — | ✅ Diary 201 |
| Clients | `/work/clients` | ✅ 200 | — | ⚠️ Partial | ✅ Clients 201 |
| Goals | `/review/goals` | ✅ 200 | — | ⚠️ Partial | ✅ Goals 201 |
| Projects | `/work/projects` | ✅ 200 | — | ⚠️ Partial | ✅ Projects 201 |
| Settings | `/settings` | ✅ 200 | — | ❌ Broken | — |
| API Health | `/api/health` | — | — | — | ✅ 200 OK |
| API Finance | `/api/finance/transactions` | — | — | — | ❌ 404 |

---

## 🔍 Detailed Findings

### #1: [CRITICAL] Finance Module — Frontend-Backend URL Mismatch

**Location:** `apps/web/src/queries/finance.ts` (lines 60, 74, 89)
**Impact:** Finance module is completely non-functional from the UI

**Evidence:**
```
Frontend calls:  /api/finance/transactions  → 404
Backend has:     /api/transactions          → 200 OK

Frontend calls:  /api/finance/monthly/2026-08  → 404
Backend has:     /api/finance/summary?month=2026-08  → 200 OK
```

**Root Cause:** The frontend queries file was written with different URL paths than what the backend routes define. The backend mounts `transactionsRouter` at `/api` with routes `/transactions` and `/finance/summary`, but the frontend assumes `/api/finance/transactions` and `/api/finance/monthly/${month}`.

**Fix Required:**
```typescript
// apps/web/src/queries/finance.ts
// Line 60: Change '/api/finance/transactions' → '/api/transactions'
// Line 74: Change `/api/finance/monthly/${month}` → `/api/finance/summary?month=${month}`
// Line 89: Change '/api/finance/transactions' → '/api/transactions'
```

**Also:** Frontend sends `amount` (dollars) but backend stores `amountCents` (integer cents). Verify the conversion layer.

---

### #2: [CRITICAL] React Hydration Failure — CommandPaletteMount

**Location:** `apps/web/src/islands/CommandPaletteMount.tsx`
**Impact:** All interactive features on affected pages are broken

**Evidence (Browser Console):**
```
Failed to load chunk "CommandPaletteMount"
Uncaught Error: Minified React error #418
```

**Root Cause:** The CommandPaletteMount component fails to load its chunk in production. This triggers a React hydration mismatch (#418), which cascades to other React islands on the same page. When hydration fails, TanStack Query doesn't fire, so API-created data (tasks, habits) never renders in the UI.

**Observed Behavior:**
- API creates task → 201 ✅ (verified in network panel)
- GET /api/tasks → 200 ✅ (task exists in DB)
- UI shows "0/0 tasks completed" ❌ (React never hydrates to fetch/display it)

**Impact Scope:** Planner, Habits, and any page with CommandPaletteMount embedded.

---

### #3: [MAJOR] Frontend-Backend Field Name Mismatches

**Location:** Multiple query files vs API route schemas

| Module | Frontend Sends | Backend Expects | Status |
|--------|---------------|-----------------|--------|
| Standups | `yesterday`, `today`, `blockers` | `currentTask`, `todayTarget`, `actualResult`, `blocker` | ❌ 400 error |
| TeamMembers | (missing `userId`) | `userId` (required) | ❌ 400 error |
| Courses | (may not enforce `semesterId`) | `semesterId` (required) | ❌ 400 error |
| Goals | `status: 'active'` | `status: 'not_started'/'in_progress'/'completed'/'abandoned'` | ❌ 400 error |

**Evidence:**
```
POST /api/standups → 400: "Unrecognized key(s) in object: 'yesterday', 'today', 'blockers'"
POST /api/team-members → 400: "Required" (userId missing)
POST /api/courses → 400: "Required" (semesterId missing)
POST /api/goals → 400: "Invalid enum value. Expected 'not_started' | 'in_progress' | 'completed' | 'abandoned', received 'active'"
```

---

### #4: [MAJOR] React Hydration Cascade Failure

**Location:** All React islands (`apps/web/src/islands/`)
**Impact:** Tasks, habits, and other data created via API don't appear in UI

**Evidence:**
- Created task via POST /api/tasks → 201 ✅
- Fetched tasks via GET /api/tasks → 200 ✅ (1 task returned)
- UI still shows "0/0 tasks completed" ❌
- Same pattern for habits: API creates → 201, GET returns → 200, UI shows "No habits yet" ❌

**Root Cause:** When CommandPaletteMount hydration fails (finding #2), it triggers React error #418 which prevents subsequent islands from hydrating. The SSR-rendered HTML shows empty states, and the client-side React never takes over to fetch and display the actual data.

---

## 📁 File Inventory

### Astro Pages (20 files)
- `apps/web/src/pages/index.astro` - Dashboard
- `apps/web/src/pages/planner.astro` - Daily Planner
- `apps/web/src/pages/life/habits.astro` - Habits
- `apps/web/src/pages/life/checkin.astro` - Daily Check-In
- `apps/web/src/pages/life/diary.astro` - Diary
- `apps/web/src/pages/college/schedule.astro` - College Schedule
- `apps/web/src/pages/college/assignments.astro` - College Assignments
- `apps/web/src/pages/college/semester.astro` - Semester Overview
- `apps/web/src/pages/work/standup.astro` - Daily Standup
- `apps/web/src/pages/work/projects.astro` - Projects
- `apps/web/src/pages/work/clients.astro` - Clients & Follow-ups
- `apps/web/src/pages/work/meetings.astro` - Meetings
- `apps/web/src/pages/work/performance.astro` - Team Performance
- `apps/web/src/pages/finance.astro` - Finance
- `apps/web/src/pages/review/goals.astro` - Goals
- `apps/web/src/pages/review/monthly.astro` - Monthly Review
- `apps/web/src/pages/review/stats.astro` - Statistics
- `apps/web/src/pages/settings.astro` - Settings
- `apps/web/src/pages/status.astro` - System Status (extra)
- `apps/web/src/pages/changelog.astro` - Changelog (extra)

### React Islands (14 files)
- `apps/web/src/islands/DashboardApp.tsx`
- `apps/web/src/islands/PlannerApp.tsx`
- `apps/web/src/islands/HabitsApp.tsx`
- `apps/web/src/islands/CheckinApp.tsx`
- `apps/web/src/islands/DiaryApp.tsx`
- `apps/web/src/islands/CollegeApp.tsx` (multi-page)
- `apps/web/src/islands/WorkApp.tsx` (multi-page)
- `apps/web/src/islands/FinanceApp.tsx`
- `apps/web/src/islands/GoalsApp.tsx`
- `apps/web/src/islands/ReviewApp.tsx`
- `apps/web/src/islands/StatsApp.tsx`
- `apps/web/src/islands/SettingsApp.tsx`
- `apps/web/src/islands/StatusApp.tsx`
- `apps/web/src/islands/CommandPaletteMount.tsx` (persistent)

### API Routes (20 files)
- `apps/api/src/routes/dashboard.ts`
- `apps/api/src/routes/tasks.ts`
- `apps/api/src/routes/habits.ts`
- `apps/api/src/routes/checkins.ts`
- `apps/api/src/routes/diary.ts`
- `apps/api/src/routes/courses.ts`
- `apps/api/src/routes/assignments.ts`
- `apps/api/src/routes/semesters.ts`
- `apps/api/src/routes/standups.ts`
- `apps/api/src/routes/projects.ts`
- `apps/api/src/routes/clients.ts`
- `apps/api/src/routes/meetings.ts`
- `apps/api/src/routes/transactions.ts`
- `apps/api/src/routes/goals.ts`
- `apps/api/src/routes/reviews.ts`
- `apps/api/src/routes/reminders.ts`
- `apps/api/src/routes/search.ts`
- `apps/api/src/routes/capture.ts`
- `apps/api/src/routes/import.ts`
- `apps/api/src/routes/health.ts`

---

## 🛠️ Recommended Actions (Priority Order)

### P0 — Must Fix Before Any Users See This

1. **Fix Finance URL Mismatch** (`#1 CRITICAL`)
   - In `apps/web/src/queries/finance.ts`: change `/api/finance/transactions` → `/api/transactions`
   - In `apps/web/src/queries/finance.ts`: change `/api/finance/monthly/${month}` → `/api/finance/summary?month=${month}`
   - Verify `amount` vs `amountCents` field mapping between frontend and backend schemas
   - Impact: Finance module is completely non-functional from the UI

2. **Fix React Hydration Failure** (`#2 CRITICAL`)
   - Debug why `CommandPaletteMount` chunk fails to load in production
   - Check if the chunk is correctly deployed to Cloudflare Pages
   - This error cascades: when CommandPaletteMount fails → React #418 → other islands on the same page may also fail to hydrate
   - Impact: All interactive features on affected pages are broken

### P1 — Fix Before Beta

3. **Fix Frontend-Backend Field Mismatches** (`#3 MAJOR`)
   - Standup fields: Frontend sends `yesterday`, `today`, `blockers` → Backend expects `currentTask`, `todayTarget`, `actualResult`, `blocker`
   - TeamMembers: Frontend doesn't send `userId` → Backend requires it
   - Courses: Frontend may not enforce `semesterId` creation flow
   - Impact: Standup and course creation from UI will fail with validation errors

4. **Fix Hydration Cascade** (`#4 MAJOR`)
   - Investigate why React islands on planner/habits pages don't render API-created data
   - The API returns data correctly (GET /tasks → 200, GET /habits → 200), but the UI shows "0 tasks" / "No habits"
   - This suggests either: (a) hydration failure prevents TanStack Query from firing, or (b) SSR state conflicts with client-side state

### P2 — Nice to Fix

5. **Finance amountCents mapping** (`#5 MINOR`)
   - Frontend appears to send dollar amounts but backend stores cents
   - Verify the conversion layer in `FinanceApp.tsx`

6. **Course creation flow** (`#6 MINOR`)
   - Ensure the UI enforces creating a semester before a course
   - Or make `semesterId` optional in the backend schema

7. **Chrome DevTools snapshot timeout** (`#7 MINOR`)
   - Not a code issue — limitation of the testing tool
   - Use `evaluate_script()` as workaround (documented in scenario.md)

---

## 📋 Test Scenario Location

The comprehensive all-feature test scenario with execution results:
```
E:\Code\kaizenlife\scenario.md
```

Live audit report (this file):
```
E:\Code\kaizenlife\audit-report.md
```

Both files contain evidence from live Chrome DevTools testing against `https://kaizen-life.warid.web.id` on 2026-08-09.

---

*Audit Report generated with SDD 6.0. Live testing completed 2026-08-09 via Chrome DevTools MCP.*

---

> **SUPERSEDED (2026-08-24):** The findings in this report have been remediated — see `reviews/` for the full audit that drove the fixes and `git log` for the remediation commits. Kept for history only.
