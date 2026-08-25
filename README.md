# KaizenLife

**Tagline:** Become 1% Better Every Day.

A single local application that replaces scattered apps (calendar, todo, habit tracker, notes, spreadsheet) for working students. One login, one dashboard, one place where "what does today require of me" is answered in under 5 seconds.

## Tech Stack

- **Frontend:** Astro + TypeScript + shadcn/ui + React
- **Backend:** Bun + Hono
- **Database:** SQLite + Drizzle ORM (D1 on Cloudflare)
- **State:** Zustand + TanStack Query

## Monorepo Structure

```
.
├── apps/
│   ├── api/        # Backend API (Hono + Drizzle) - deployed to Cloudflare Workers
│   └── web/        # Frontend Web App (Astro + React) - deployed to Cloudflare Pages
├── packages/
│   └── shared/     # Shared Zod schemas + import logic (used by both apps)
└── .github/workflows/  # Path-filtered CI/CD (deploys only what changed)
```

## Getting Started

### Prerequisites
- [Bun](https://bun.sh/) runtime installed

### Installation

```bash
# Clone the repository
git clone https://github.com/Warid27/kaizen-life.git
cd kaizen-life

# Install all workspace dependencies from the root
bun install
```

### Development

> **One-time setup:** copy `apps/api/.env.example` to `apps/api/.dev.vars`. Without the
> `ENVIRONMENT=development` override, the local API runs with production CORS rules and
> every browser request fails silently.

Run the API and web app side by side (two terminals, or use the root scripts):

```bash
# Terminal 1: Backend API on http://localhost:3001
bun run dev:api

# Terminal 2: Frontend on http://localhost:4321
bun run dev:web
```

### Access the App

- **Frontend:** http://localhost:4321
- **Backend API:** http://localhost:3001

### Database & Tests

```bash
# Generate + apply migrations (from apps/api)
bun run db:generate
bun run db:migrate

# Run the workspace test suite from the root
bun run test
```

### Build

```bash
bun run build:api   # bundles the Worker
bun run build:web   # builds the static site
```

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