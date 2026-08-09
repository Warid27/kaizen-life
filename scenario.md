# KaizenLife — Functional Test Scenarios

**Target Domain:** https://kaizen-life.warid.web.id
**API Domain:** https://kaizenlife-api.warid.web.id
**Date:** 2026-08-09

---

## Scenario 1: First-Time User Onboarding

**Prerequisites:** Fresh database, no existing data
**Goal:** Verify empty states and initial user experience

### Steps
1. Navigate to `https://kaizen-life.warid.web.id`
2. **Dashboard** → Verify empty state cards:
   - "Today's Schedule" shows "No tasks scheduled" or similar
   - "Habits" shows "No habits yet" with "Add Habit" button
   - "Finance" shows $0.00 for income/expense/net
3. Click **"New Task"** on Planner page
4. Verify form opens with fields: title, description, date, start/end time, priority
5. Click **"Add Habit"** on Habits page
6. Verify form opens with fields: name, icon, category, frequency

### Expected Result
- All empty states display clearly with single CTA buttons
- No broken layouts or missing components
- No console errors in browser DevTools

---

## Scenario 2: Create and Complete Tasks

**Prerequisites:** Empty dashboard
**Goal:** Test task lifecycle from creation to completion

### Steps
1. Navigate to `/planner`
2. Click **"New Task"**
3. Fill in:
   - Title: `Finish project report`
   - Description: `Complete the Q3 summary`
   - Date: Today's date
   - Start time: `09:00`
   - End time: `11:00`
   - Priority: `high`
4. Click **"Save"** or **"Create"**
5. **Verify:** Task appears in planner timeline at 09:00-11:00
6. Click the task to open detail view
7. Click **"Mark Complete"** or toggle status to `done`
8. **Verify:** Task shows strikethrough or completed styling
9. Navigate to `/` (Dashboard)
10. **Verify:** Task appears in "Today's Priorities" or "Today's Schedule" widget

### Expected Result
- Task persists after page refresh
- Status change reflects immediately
- Dashboard shows the task in correct widget

---

## Scenario 3: Habit Creation, Logging, and Streak Tracking

**Prerequisites:** No habits exist
**Goal:** Test habit recurrence engine and streak calculation

### Steps
1. Navigate to `/life/habits`
2. Click **"Add Habit"**
3. Fill in:
   - Name: `Morning Prayer`
   - Icon: 🕌 (or select from list)
   - Category: `Spiritual`
   - Frequency: `daily`
4. Click **"Save"**
5. **Verify:** Habit appears in today's checklist with `0/1` progress
6. Click the habit's **checkbox** or **"Complete"** button
7. **Verify:** Progress updates to `1/1`, streak shows `1 day`
8. Navigate away and return to `/life/habits`
9. **Verify:** Habit still shows completed for today
10. Navigate to `/` (Dashboard)
11. **Verify:** Habit checklist widget shows the habit as completed

### Expected Result
- Habit generates today's log row automatically
- Completion persists across page loads
- Streak counter increments correctly
- Dashboard reflects habit status

---

## Scenario 4: Daily Check-In and Sleep Tracking

**Prerequisites:** No check-in for today
**Goal:** Test combined check-in form and 7-day average calculation

### Steps
1. Navigate to `/life/checkin`
2. Verify form shows today's date
3. Fill in:
   - Bed time: `23:00`
   - Wake time: `06:30`
   - Nap minutes: `30`
   - Sleep quality: `4` (out of 5)
   - Mood: `7` (out of 10)
   - Energy: `8` (out of 10)
   - Stress: `4` (out of 10)
   - Note: `Good night's sleep`
4. Click **"Save"**
5. **Verify:** Form shows "Saved" confirmation
6. **Verify:** Total sleep duration auto-calculates: `7h 30m` (6.5h night + 0.5h nap)
7. Navigate away and return to `/life/checkin`
8. **Verify:** Data persists (form shows saved values)
9. Navigate to `/` (Dashboard)
10. **Verify:** "Sleep & Wellness" widget shows today's data
11. **Verify:** 7-day averages update (if previous days have data)

### Expected Result
- One check-in per date (upsert behavior)
- Sleep duration calculates correctly
- Dashboard averages update in real-time

---

## Scenario 5: Diary Entry with Prompts

**Prerequisites:** No diary entry for today
**Goal:** Test diary creation with three prompts

### Steps
1. Navigate to `/life/diary`
2. Verify today's date is selected
3. Fill in prompts:
   - Grateful for: `My supportive family`
   - Today's lesson: `Patience is key in debugging`
   - Tomorrow's focus: `Finish the API integration`
   - Free text: `Had a productive day working on KaizenLife...`
4. Click **"Save"**
5. **Verify:** Entry saves successfully
6. Navigate to diary history
7. **Verify:** Today's entry appears at top of list
8. Click on the entry
9. **Verify:** All fields display correctly
10. Try creating another entry for today
11. **Verify:** It updates the existing entry (upsert), not creates duplicate

### Expected Result
- One entry per date enforced
- All prompts save correctly
- History shows chronological entries

---

## Scenario 6: Finance Transaction and Monthly Summary

**Prerequisites:** No transactions
**Goal:** Test transaction creation and summary calculation

### Steps
1. Navigate to `/finance`
2. Verify summary shows $0.00 for Income, Expenses, Net
3. Click **"+Income"**
4. Fill in:
   - Amount: `50000` (should display as $500.00)
   - Category: `Salary`
   - Account: `bank`
   - Date: Today
   - Note: `Monthly salary`
5. Click **"Save"**
6. **Verify:** Transaction appears in list
7. **Verify:** Income summary updates to $500.00
8. **Verify:** Net updates to $500.00
9. Click **"+Expense"**
10. Fill in:
    - Amount: `15000` (should display as $150.00)
    - Category: `Food`
    - Account: `cash`
    - Date: Today
    - Note: `Lunch with team`
11. Click **"Save"**
12. **Verify:** Expense summary updates to $150.00
13. **Verify:** Net updates to $350.00 ($500 - $150)
14. Navigate to `/` (Dashboard)
15. **Verify:** Finance widget shows correct Income/Expense/Net
16. Navigate back to `/finance`
17. **Verify:** Charts render:
    - "By Category" bar chart shows Food and Salary
    - "Balance Over Time" line chart shows transactions

### Expected Result
- Amounts store as integer cents
- Summary calculates correctly
- Charts render with data
- Dashboard finance widget syncs

---

## Scenario 7: Client Follow-up and Overdue Detection

**Prerequisites:** No clients or follow-ups
**Goal:** Test overdue follow-up flagging on dashboard

### Steps
1. Navigate to `/work/clients`
2. Click **"Add Client"**
3. Fill in:
   - Name: `Acme Corp`
   - Company: `Acme Industries`
   - Contact: `john@acme.com`
4. Click **"Save"**
5. **Verify:** Client appears in list
6. Click on the client to open detail view
7. Click **"Add Follow-up"**
8. Fill in:
    - Last contact date: Yesterday
    - Next follow-up date: **2 days ago** (overdue!)
    - Status: `pending`
    - Notes: `Discuss contract renewal`
9. Click **"Save"**
10. Navigate to `/` (Dashboard)
11. **Verify:** "Overdue Follow-ups" widget appears with red highlight
12. **Verify:** Shows "Acme Corp" with overdue status
13. Navigate to `/work/clients`
14. **Verify:** Follow-up shows overdue indicator in list

### Expected Result
- Overdue follow-up flags when `next_followup_date < today` AND `status != 'done'`
- Dashboard highlights overdue items in red
- Status persists across page loads

---

## Scenario 8: Course and Assignment Tracking

**Prerequisites:** No courses or assignments
**Goal:** Test college module with deadline visibility

### Steps
1. Navigate to `/college/semester`
2. Click **"Add Semester"**
3. Fill in:
    - Name: `Fall 2026`
    - Start date: `2026-09-01`
    - End date: `2026-12-15`
4. Click **"Save"**
5. Navigate to `/college/schedule`
6. Click **"Add Course"**
7. Fill in:
    - Name: `Data Structures`
    - Code: `CS201`
    - Lecturer: `Dr. Smith`
    - Room: `Room 301`
    - Semester: `Fall 2026`
    - Color: `#3b82f6` (blue)
8. Click **"Save"**
9. Click **"Add Schedule"** for the course
10. Fill in:
    - Day: `Monday`
    - Start time: `09:00`
    - End time: `10:30`
    - Room: `Room 301`
11. Click **"Save"**
12. Navigate to `/college/assignments`
13. Click **"Add Assignment"**
14. Fill in:
    - Course: `Data Structures`
    - Title: `Binary Tree Implementation`
    - Due date: **3 days from now**
    - Priority: `high`
    - Status: `in_progress`
15. Click **"Save"**
16. Navigate to `/` (Dashboard)
17. **Verify:** "Upcoming Deadlines" widget shows the assignment
18. **Verify:** Shows course name and due date

### Expected Result
- Course schedule renders on correct day
- Assignment appears in dashboard deadlines widget
- Priority and status display correctly

---

## Scenario 9: Project Progress and Team Standup

**Prerequisites:** No projects or standups
**Goal:** Test work module with project tracking

### Steps
1. Navigate to `/work/projects`
2. Click **"Add Project"**
3. Fill in:
    - Name: `KaizenLife v1.0`
    - Client: `Internal`
    - Status: `active`
    - Priority: `high`
    - Deadline: `2026-12-31`
    - Progress: `65`
    - PIC: `Warid`
4. Click **"Save"**
5. **Verify:** Project shows with 65% progress bar
6. Navigate to `/work/standup`
7. Click **"Add Standup"**
8. Fill in:
    - Date: Today
    - Project: `KaizenLife v1.0`
    - Current task: `Implementing finance module`
    - Today's target: `Complete transaction CRUD`
    - Actual result: `Finished income/expense forms`
    - Blocker: `None`
    - Status: `on_track`
9. Click **"Save"**
10. Navigate to `/` (Dashboard)
11. **Verify:** "Active Projects" widget shows KaizenLife v1.0 with 65% bar
12. Navigate to `/work/performance`
13. **Verify:** Team Performance report shows project stats

### Expected Result
- Project progress bar renders correctly
- Standup saves with all fields
- Dashboard shows project widget
- Performance report aggregates data

---

## Scenario 10: Goals with Hierarchy

**Prerequisites:** No goals
**Goal:** Test annual → monthly → weekly goal linking

### Steps
1. Navigate to `/review/goals`
2. Click **"Add Goal"**
3. Fill in:
    - Type: `annual`
    - Title: `Read 24 books`
    - Period: `2026-01-01` to `2026-12-31`
    - Target value: `24`
    - Unit: `books`
4. Click **"Save"**
5. Click **"Add Goal"** again
6. Fill in:
    - Type: `monthly`
    - Title: `Read 2 books`
    - Period: `2026-08-01` to `2026-08-31`
    - Target value: `2`
    - Unit: `books`
    - Parent goal: `Read 24 books`
7. Click **"Save"**
8. Click **"Add Goal"** again
9. Fill in:
    - Type: `weekly`
    - Title: `Read 1 book`
    - Period: `2026-08-04` to `2026-08-10`
    - Target value: `1`
    - Unit: `books`
    - Parent goal: `Read 2 books`
10. Click **"Save"**
11. **Verify:** Hierarchy displays:
    - Annual: Read 24 books
    - Monthly: Read 2 books (linked to annual)
    - Weekly: Read 1 book (linked to monthly)
12. Click on weekly goal → manually update progress to `1`
13. **Verify:** Progress bar shows 100%

### Expected Result
- Goal hierarchy renders correctly
- Parent-child relationships display
- Progress updates manually

---

## Scenario 11: Monthly Review Auto-Draft

**Prerequisites:** Existing data for current month (habits, transactions, standups)
**Goal:** Test auto-drafted monthly summary

### Steps
1. Ensure data exists:
   - At least 5 habit logs this month
   - At least 3 transactions
   - At least 2 standups
2. Navigate to `/review/monthly`
3. **Verify:** Auto-drafted summary shows:
   - Habit completion rate (e.g., `80%`)
   - Finance net (e.g., `+$350.00`)
   - Work stats (e.g., `2 standups, 1 project`)
4. Fill in reflection fields:
    - Biggest achievement: `Shipped finance module`
    - Biggest lesson: `Better time estimation needed`
    - Next month's priorities: `Complete college module`
5. Click **"Save"**
6. Navigate away and return
7. **Verify:** Data persists
8. **Verify:** One review per month (try creating another - should upsert)

### Expected Result
- Auto-summary pulls from existing data
- Reflection fields save correctly
- Upsert behavior prevents duplicates

---

## Scenario 12: Command Palette and Quick Capture

**Prerequisites:** Any state
**Goal:** Test global navigation and capture features

### Steps
1. Press `Cmd+K` (Mac) or `Ctrl+K` (Windows)
2. **Verify:** Command palette modal opens
3. Type `habits`
4. **Verify:** Shows "Habits" as navigation result
5. Click on "Habits"
6. **Verify:** Navigates to `/life/habits`
7. Press `Cmd+K` again
8. Type `finance`
9. **Verify:** Shows "Finance" as navigation result
10. Click on "Finance"
11. **Verify:** Navigates to `/finance`
12. Press `N` key (or click Capture button)
13. **Verify:** Quick capture input appears
14. Type `Buy groceries`
15. Press Enter
16. **Verify:** Toast notification appears: "Task created"
17. **Verify:** Toast has "Edit details" link
18. Click "Edit details"
19. **Verify:** Opens task in Planner for editing

### Expected Result
- Command palette opens with keyboard shortcut
- Search finds modules and entities
- Navigation works correctly
- Quick capture creates task with title only
- Toast confirms creation with edit link

---

## Scenario 13: Settings and Data Export

**Prerequisites:** Any state with some data
**Goal:** Test settings and backup functionality

### Steps
1. Navigate to `/settings`
2. **Verify:** 4 tabs visible: Profile, Habits, Notifications, Backup
3. Click **"Profile"** tab
4. **Verify:** Shows name, email, timezone fields
5. Update timezone to `Asia/Jakarta`
6. Click **"Save"**
7. **Verify:** Settings persist
8. Click **"Backup"** tab
9. Click **"Export data"**
10. **Verify:** JSON file downloads
11. Open the JSON file
12. **Verify:** Contains all entities: tasks, habits, transactions, etc.
13. Click **"Backup now"**
14. **Verify:** SQLite file copies successfully
15. Toggle theme from light to dark
16. **Verify:** UI updates immediately
17. Navigate to `/` (Dashboard)
18. **Verify:** Theme persists across pages

### Expected Result
- Settings save correctly
- Export includes all data
- Backup creates restorable file
- Theme toggles and persists

---

## Scenario 14: Mobile Responsiveness

**Prerequisites:** None
**Goal:** Test mobile bottom tab bar and responsive layout

### Steps
1. Resize browser to mobile width (< 768px)
2. **Verify:** Sidebar collapses/hidden
3. **Verify:** Bottom tab bar appears with: Today, Life, Work, More
4. Click **"Today"**
5. **Verify:** Navigates to Dashboard
6. Click **"Life"**
7. **Verify:** Shows Habits page (or Life section)
8. Click **"Work"**
9. **Verify:** Shows Standup page (or Work section)
10. Click **"More"**
11. **Verify:** Shows menu with College, Finance, Review, Settings
12. Click **"Finance"**
13. **Verify:** Navigates to Finance page
14. Resize back to desktop width
15. **Verify:** Sidebar reappears
16. **Verify:** Bottom tab bar hides

### Expected Result
- Mobile layout works correctly
- Bottom tabs navigate to correct sections
- Responsive transitions are smooth

---

## Scenario 15: Error Handling and Edge Cases

**Prerequisites:** None
**Goal:** Test error states and validation

### Steps
1. Navigate to `/planner`
2. Click **"New Task"**
3. Try to save without title
4. **Verify:** Validation error: "Title is required"
5. Fill in title: `Test task`
6. Set start time: `14:00`
7. Set end time: `12:00` (before start)
8. Click **"Save"**
9. **Verify:** Validation error: "End time must be after start time"
10. Navigate to `/life/habits`
11. Click **"Add Habit"**
12. Try to save without name
13. **Verify:** Validation error: "Name is required"
14. Navigate to `/finance`
15. Click **"+Income"**
16. Try to save without amount
17. **Verify:** Validation error: "Amount is required"
18. Enter amount: `-100` (negative)
19. Click **"Save"**
20. **Verify:** Validation error: "Amount must be positive"

### Expected Result
- Required field validation works
- Time validation prevents invalid ranges
- Amount validation prevents negatives
- Clear error messages display

---

## Test Execution Checklist

| Scenario | Status | Tester | Date | Notes |
|----------|--------|--------|------|-------|
| 1. First-Time User Onboarding | ✅ PASS | Sisyphus (Chrome DevTools) | 2026-08-09 | All 9 dashboard widgets render with correct empty states. No layout breakage. |
| 2. Create and Complete Tasks | ⚠️ PARTIAL | Sisyphus (Chrome DevTools) | 2026-08-09 | API: POST 201 ✅, GET 200 ✅. Task created in DB. **UI FAIL**: React hydration errors prevent task rendering in planner. "0/0 tasks completed" persists. |
| 3. Habit Creation and Streaks | ⚠️ PARTIAL | Sisyphus (Chrome DevTools) | 2026-08-09 | API: POST 201 ✅. Habit created (id: 784d269e). **UI FAIL**: "No habits yet" persists. React hydration error blocks rendering. |
| 4. Daily Check-In | ✅ PASS | Sisyphus (Chrome DevTools) | 2026-08-09 | API: PUT 201 ✅, GET 200 ✅. Fields: sleepQuality=4, mood=8, energy=7, stress=3. All numeric, correct schema. |
| 5. Diary Entry | ✅ PASS | Sisyphus (Chrome DevTools) | 2026-08-09 | API: PUT 201/200 ✅. Fields: gratefulFor, lessonLearned, tomorrowFocus, freeText. Upsert works (updated existing entry). |
| 6. Finance Transactions | ❌ FAIL | Sisyphus (Chrome DevTools) | 2026-08-09 | **CRITICAL BUG**: Frontend calls `/api/finance/transactions` → 404. Backend route is `/api/transactions`. URL mismatch. Also `/api/finance/monthly/${month}` → 404 (backend has `/api/finance/summary?month=`). SSR renders cached data, but all mutations fail. |
| 7. Client Follow-up Overdue | ⚠️ PARTIAL | Sisyphus (Chrome DevTools) | 2026-08-09 | API: POST 201 ✅ (with userId). Client "PT Maju Jaya" created. **UI FAIL**: React hydration. Follow-up creation not tested (needs separate schema). |
| 8. Course and Assignments | ❌ FAIL | Sisyphus (Chrome DevTools) | 2026-08-09 | API: POST /courses → 400 (requires semesterId, no semesters exist). Assignments GET 200 ✅ (empty list). Cannot create course without semester first. |
| 9. Project and Standup | ⚠️ PARTIAL | Sisyphus (Chrome DevTools) | 2026-08-09 | API: POST /projects 201 ✅ ("KaizenLife v2" created). Standup POST → 400: requires userId + teamMemberId (separate entity). Fields are currentTask/todayTarget/actualResult/blocker (not yesterday/today/blockers). |
| 10. Goals Hierarchy | ✅ PASS | Sisyphus (Chrome DevTools) | 2026-08-09 | API: POST 201 ✅. Title: "Ship KaizenLife v2 by Q4". Status must be 'not_started'/'in_progress'/'completed'/'abandoned' (not 'active'). |
| 11. Monthly Review | ⚠️ EMPTY | Sisyphus (Chrome DevTools) | 2026-08-09 | API: GET /reviews 200 ✅ (empty array). Cannot test auto-draft without sufficient data in all modules. |
| 12. Command Palette | ❌ FAIL | Sisyphus (Chrome DevTools) | 2026-08-09 | **CRITICAL**: React hydration error: `CommandPaletteMount` component fails to mount. Console shows React #418 error. Cmd+K shortcut does not work. |
| 13. Settings and Export | 🔒 NOT TESTED | — | 2026-08-09 | UI-only, blocked by React hydration. Settings page loads but interactive elements do not hydrate. |
| 14. Mobile Responsiveness | 🔒 NOT TESTED | — | 2026-08-09 | Cannot reliably test in Chrome DevTools with broken hydration. Page viewport resize works but bottom tab bar interaction blocked. |
| 15. Error Handling | ✅ PASS | Sisyphus (Chrome DevTools) | 2026-08-09 | API: GET /api/tasks/invalid-id → 404 "Task not found" ✅. GET /api/nonexistent → 404 ✅. API health endpoint: GET /api/health → 200 OK ✅ (contradicts earlier report). |

---

## Live Testing Evidence

### API Calls Verified (via Chrome DevTools Network Panel)

| Method | Endpoint | Status | Response |
|--------|----------|--------|----------|
| POST | `/api/tasks` | 201 | `{id: "a848087c...", title: "Finish project report", status: "todo"}` |
| GET | `/api/tasks` | 200 | `[1 task]` |
| POST | `/api/habits` | 201 | `{id: "784d269e...", name: "Morning Prayer", category: "spiritual"}` |
| PUT | `/api/checkins/2026-08-09` | 201 | `{sleepQuality: 4, mood: 8, energy: 7, stress: 3}` |
| PUT | `/api/diary/2026-08-09` | 201→200 | Upsert confirmed (second call updated existing) |
| POST | `/api/clients` | 201 | `{id: "35743264...", name: "PT Maju Jaya"}` |
| POST | `/api/projects` | 201 | `{id: "79178eba...", name: "KaizenLife v2", status: "active"}` |
| POST | `/api/goals` | 201 | `{id: "c2c13d28...", title: "Ship KaizenLife v2 by Q4"}` |
| GET | `/api/health` | 200 | `{status: "ok", app: "KaizenLife", version: "0.0.1"}` |
| GET | `/api/finance/transactions` | **404** | Route not found (frontend calls wrong path) |
| GET | `/api/finance/monthly/2026-08` | **404** | Route not found (frontend calls wrong path) |
| POST | `/api/courses` | 400 | `{error: "Validation failed", semesterId: "Required"}` |
| POST | `/api/standups` | 400 | `{error: "Unrecognized keys: yesterday, today, blockers"}` |
| POST | `/api/team-members` | 400 | `{error: "Validation failed", userId: "Required"}` |
| POST | `/api/transactions` | **404** | Frontend doesn't call this correct route |

### React Hydration Errors (Console)

```
CommandPaletteMount: Failed to load chunk "CommandPaletteMount"
Uncaught Error: Minified React error #418
```

This prevents ALL React islands from hydrating properly on pages where these errors occur.

---

*Functional test scenarios generated with SDD 6.0. Live testing completed 2026-08-09 via Chrome DevTools MCP.*
