# KaizenLife

**Tagline:** Become 1% Better Every Day.

A single local application that replaces scattered apps (calendar, todo, habit tracker, notes, spreadsheet) for working students. One login, one dashboard, one place where "what does today require of me" is answered in under 5 seconds.

## Tech Stack

- **Frontend:** Astro + TypeScript + shadcn/ui + React
- **Backend:** Bun + Hono
- **Database:** SQLite + Drizzle ORM
- **State:** Zustand + TanStack Query

## Branches

- `main` - This README
- `api` - Backend API (Hono + Drizzle)
- `apps` - Frontend Web App (Astro + React)

## Getting Started

### Prerequisites
- [Bun](https://bun.sh/) runtime installed

### Installation

```bash
# Clone the repository
git clone https://github.com/Warid27/kaizen-life.git

# Switch to the api branch for backend
git checkout api

# Install dependencies
bun install

# Run database migrations
bun run db:migrate

# Seed the database
bun run db:seed

# Start the development server
bun run dev
```

### Access the App

- **Frontend:** http://localhost:4321
- **Backend API:** http://localhost:3001

## Features

- **Dashboard** - Single view of today's schedule, priorities, habits, and more
- **Daily Planner** - Time-blocked calendar view
- **Habits** - Recurrence engine with streak tracking
- **Daily Check-In** - Sleep, mood, energy, and stress logging
- **Diary** - Daily journaling with prompts
- **College** - Courses, assignments, and semester tracking
- **Work** - Standups, projects, clients, and meetings
- **Finance** - Transaction logging and monthly summaries
- **Goals** - Annual/monthly/weekly goal hierarchy
- **Monthly Review** - Auto-drafted from your data
- **Statistics** - Charts for all modules
- **Quick Capture** - Add tasks from anywhere
- **Command Palette** - Navigate instantly with Cmd/Ctrl+K
- **PWA** - Installable as a Progressive Web App

## License

MIT
