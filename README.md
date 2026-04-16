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
| Testing | Vitest (unit), Playwright (E2E) |
| Monorepo | npm workspaces |

## Getting Started

### Prerequisites

- Node.js 18+
- An [OpenAI API key](https://platform.openai.com/api-keys)

### Quick Start (one command)

```bash
npm run setup
```

This installs dependencies, creates the `.env` file (from `.env.example`), ensures the database directory exists, seeds sample data, and starts both servers. Works on Windows, macOS, and Linux. Edit `apps/api/.env` to add your `OPENAI_API_KEY` for the full AI chat experience.

> **No API key?** The app still works! The chat runs in **mock mode** with basic pattern matching — you can generate schedules, set requirements, replace employees, and swap shifts using simple commands. Add your key anytime to unlock full natural-language understanding.

### Manual Setup

```bash
# Install dependencies
npm install

# Configure your OpenAI key
cp apps/api/.env.example apps/api/.env
# Edit apps/api/.env and add your OPENAI_API_KEY

# Seed the database with sample data (36 employees, 3 schedules)
npm run seed

# Start the app (API on :3001, Web on :3000)
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

### Seed Data

The seed script creates a realistic restaurant scenario with **36 employees** across 4 roles (4 managers, 10 cooks, 14 waiters, 8 dishwashers), each with individual availability and weekly hour limits (16-40h). The roster is intentionally diverse — full-timers with broad availability alongside weekend-only staff, weekday-only cooks, part-time students, and mid-week specialists — so the greedy scheduler has meaningful decisions to make and there's real depth for swaps and replacements.

It also creates **3 schedules**, each showcasing a different starting point:

| Schedule | Span | State | Purpose |
|----------|------|-------|---------|
| **Full Week** | 7 days (Mon–Sun), next week | Requirements set, shifts generated (all filled) | Explore an existing schedule — replace employees, tweak requirements, regenerate |
| **Empty Week** | 7 days (Mon–Sun), 2 weeks out | Completely blank | Build a schedule from scratch entirely via AI chat |
| **Peak Weekend** | 4 days (Thu–Sun), 3 weeks out | Elevated staffing, ~1 shift unfilled | Stress scenario — use the chat to resolve gaps, swap people, or trim requirements |

The **Peak Weekend** schedule is tuned just past what the roster can fully cover, so the reviewer sees a realistic staffing problem on first open and can solve it via chat (_"who can cover the unfilled Saturday evening shift?"_ / _"reduce Sunday waiter staffing by one"_ / _"swap someone from Thursday"_).

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
| `swap_employees` | Exchange two employees between their shifts |

The backend runs a **tool loop**: send messages → receive tool calls → execute → feed results back → repeat until the model produces a final text reply. After each action round, `fillNewShifts()` auto-fills any newly created gaps.

### Mock Mode (no API key)

When no `OPENAI_API_KEY` is configured, the chat falls back to a **mock mode** that uses keyword-based pattern matching instead of an LLM. It supports a subset of commands:

- **Generate/regenerate** — `"Generate the schedule"`, `"Regenerate"`
- **Set requirements** — `"3 cooks on monday morning"`, `"2 waiters on weekday evening"`
- **Replace employee** — `"Replace [name]"` (single or batch, depending on how many shifts match)
- **Swap employees** — `"Swap [name] and [name]"`

Mock mode also **auto-seeds empty schedules**: when you open a blank schedule and send any message, it creates default staffing requirements (realistic weekday/weekend coverage) and generates all shifts automatically — so you can start experimenting immediately.

Both modes share the same **action executor** (`action-executor.ts`), which handles the actual database mutations. This means mock mode produces the same real results (shifts created, employees replaced, etc.) — it just skips the LLM for intent detection.

### Example Prompts

All prompts below have been tested end-to-end against the seeded data. Try them on the **Full Week** schedule or build from scratch on the **Empty Week**.

**Getting information**

> "Give me an overview of this schedule. How many shifts are filled vs unfilled?"

> "What does Monday look like? List who is working each shift period."

> "Are there any unfilled shifts? Which roles are hardest to fill?"

> "Do we have enough coverage for the weekend? Summarize Saturday and Sunday staffing."

**Setting requirements**

> "I need 3 cooks, 4 waiters, 1 manager, and 2 dishwashers for every weekday morning shift"

> "For Saturday and Sunday, set 2 cooks, 5 waiters, 1 manager, and 1 dishwasher for both morning and evening"

> "Add 5 waiters on weekend evenings"

> "Remove all dishwasher requirements from Sunday"

> "Change Monday morning to 3 cooks and 2 waiters"

**Generating and managing shifts**

> "Now generate the full schedule based on these requirements"

> "Regenerate the entire schedule"

> "Delete all Thursday evening shifts"

> "Delete all cook shifts from Wednesday"

**Employee assignment**

> "Replace the first cook on Wednesday morning with someone else"

> "Replace Brandon on all their shifts"

> "Unassign whoever is working the first Tuesday morning cook shift"

> "Assign the first available cook to an unfilled shift"

**Multi-step requests**

> "Set Friday evening to 2 managers, 4 cooks, 6 waiters, 3 dishwashers, then regenerate just Friday's schedule"

> "Set requirements: 1 cook for Monday morning, then generate the schedule"

**Edge cases** — the AI asks for clarification instead of guessing:

> "We need more staff on the busiest day"

## Project Structure

```
scheduling-app/
├── apps/
│   ├── api/                  # Express backend
│   │   ├── src/
│   │   │   ├── controllers/  # Route handlers
│   │   │   ├── entities/     # TypeORM models (Employee, Schedule, Shift, ScheduleRequirement)
│   │   │   ├── services/     # Business logic (scheduler, AI chat, action executor)
│   │   │   │   └── mock/     # Mock chat fallback (no API key needed)
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
