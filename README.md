# Restaurant Scheduling Assistant

An AI-powered scheduling app for managing restaurant staff. Define staffing requirements, auto-fill schedules based on employee availability, and manage everything through a natural language chat interface.

Built as a response to the [AllieHealth Engineering Challenge](https://github.com/nicholasgasior/alliehealth-interview).

## Features

- **Define staffing requirements** — set how many cooks, waiters, managers, and dishwashers are needed per shift period (morning, afternoon, evening) and day of the week
- **Auto-fill schedules** — a greedy algorithm assigns employees respecting availability, role, and weekly hour limits, balancing workload by prioritizing workers with fewer hours
- **Swap & backfill** — replace any assigned employee and the system finds the best available substitute, individually or in batch
- **AI chat interface** — instead of buttons, talk to the app: _"Set up weekend requirements: 4 cooks in the evening"_ or _"Replace Camila on all Friday shifts"_

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 16, React 19, Tailwind CSS 4, shadcn/ui, TanStack React Query |
| Backend | Express 4, TypeORM, SQL.js (SQLite) |
| AI | OpenAI API (gpt-4o-mini) |
| Testing | Playwright (E2E) |
| Monorepo | npm workspaces |

## Getting Started

### Prerequisites

- Node.js 18+
- An [OpenAI API key](https://platform.openai.com/api-keys)

### Setup

```bash
# Install dependencies
npm install

# Configure your OpenAI key
cp apps/api/.env.example apps/api/.env
# Edit apps/api/.env and add your OPENAI_API_KEY

# Seed the database with sample data (22 employees, 4 schedules)
npm run seed

# Start the app (API on :3001, Web on :3000)
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

### Seed Data

The seed script creates a realistic restaurant scenario with **22 employees** across 4 roles (3 managers, 6 cooks, 8 waiters, 5 dishwashers), each with individual availability and weekly hour limits (20-40h).

It also creates **4 schedules** of increasing complexity:

| Schedule | Span | Staffing | State | Purpose |
|----------|------|----------|-------|---------|
| **Quiet Midweek** | 3 days | Low (1-2 per role) | Fully filled | Simple baseline — everything fits |
| **Full Week** | 7 days | Moderate + weekend bump | Mostly filled, some gaps | Realistic week with minor conflicts |
| **To Plan Week** | 7 days | Same as Full Week | No shifts generated | Ready to fill entirely via AI chat |
| **Holiday Rush** | 14 days | High demand all periods | Many unfilled shifts | Stress test — staff can't cover everything |

## How It Works

### The Scheduling Algorithm

When generating a schedule, the system:

1. Iterates over each day and period in the schedule's date range
2. Checks staffing requirements for that day-of-week and period
3. For each required slot, finds eligible employees (correct role, available that day, not already booked, under weekly hour limit)
4. Picks the employee with the fewest hours that week (load balancing)
5. Tracks unfilled shifts when no eligible employee exists

### The AI Chat

The chat uses OpenAI's native **tool calling** (function calling) API. Instead of embedding JSON actions in its text, the model receives a set of tools and decides when to call them:

| Tool | What it does |
|------|-------------|
| `set_requirements` | Set staffing needs for a day/period/role |
| `generate_schedule` | Fill all shifts from requirements |
| `replace_employee` | Swap one employee on a single shift |
| `replace_employee_batch` | Swap an employee across multiple shifts |
| `assign_employee` | Manually assign an employee to a shift |
| `unassign_employee` | Remove an employee from a shift |
| `delete_shifts` | Clear shifts (by date, period, or all) |

The backend runs a **tool loop**: send messages → receive tool calls → execute → feed results back → repeat until the model produces a final text reply. After each action round, `fillNewShifts()` auto-fills any newly created gaps.

### Example Prompts

> "We need 2 cooks and 3 waiters every weekday morning"

> "Generate the schedule"

> "Replace Camila on all her Friday shifts"

> "What does next Monday look like?"

## Project Structure

```
scheduling-app/
├── apps/
│   ├── api/                  # Express backend
│   │   ├── src/
│   │   │   ├── controllers/  # Route handlers
│   │   │   ├── entities/     # TypeORM models (Employee, Schedule, Shift, ScheduleRequirement)
│   │   │   ├── services/     # Business logic (scheduler, AI chat)
│   │   │   └── routes/       # API route definitions
│   │   └── data/             # SQLite database (gitignored)
│   │
│   └── web/                  # Next.js frontend
│       ├── app/              # Pages (schedule list, schedule detail)
│       ├── components/       # UI components (chat panel, schedule grid, shift dialog)
│       └── services/         # API client wrappers
│
├── tests/                    # Playwright E2E tests
└── package.json              # Workspace root
```

## Design Decisions

- **SQL.js over better-sqlite3** — zero native dependencies, no build step issues across platforms
- **Greedy scheduler with load balancing** — simple, predictable, and good enough for the problem size. Picks the least-worked eligible employee each time
- **AI tool calling** — uses OpenAI's native function calling API instead of parsing embedded JSON from the LLM's text. The model decides which tools to invoke (`set_requirements`, `generate_schedule`, `replace_employee`, etc.), the backend executes them in a loop, and feeds results back until the model produces a final conversational reply
- **Monorepo with npm workspaces** — single `npm install`, single `npm run dev`, no extra tooling
