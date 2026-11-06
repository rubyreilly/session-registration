# Session Registration

A small full-stack app for registering participants into time-boxed sessions with capacity limits and registration windows.

- **API:** NestJS + TypeScript (`/api`)
- **UI:** Vue 3 + Vite (`/web`)
- **Persistence:** in-memory (see "Decisions")

## Install and run

Requires **Node 24.12+** (`nvm use` reads `.nvmrc`). The Nest 12 scaffold ships ESM-only packages, and Jest needs Node's native `require(esm)` support to load them.

```bash
# API (http://localhost:3000)
cd api
npm install
npm run start:dev

# Optional: seed one session per UI state (API must be running)
npm run seed

# UI (http://localhost:5173), in another terminal
cd web
npm install
npm run dev
```

The Vite dev server proxies `/api` to the Nest server, so no CORS setup is needed.

## Tests

```bash
cd api
npm test
```

Unit tests on `SessionsService` with a controllable clock. They cover:

- **Capacity:** the limit holds, unregistering frees a seat, and many attempts never exceed capacity.
- **Registration window:** both boundaries are tested at the exact millisecond.
- **Duplicates:** email normalization, and a rejected attempt never consumes a seat.
- **Unregister:** rules before and after the session starts.
- **Create and list:** window validation, and the list is upcoming-only and sorted.

## API

| Method | Path                                     | Description                                  |
| ------ | ---------------------------------------- | -------------------------------------------- |
| GET    | `/api/sessions`                          | List upcoming sessions with `seatsRemaining` |
| POST   | `/api/sessions`                          | Create a session                             |
| POST   | `/api/sessions/:id/registrations`        | Register `{ "email": "..." }`                |
| DELETE | `/api/sessions/:id/registrations/:email` | Unregister (204)                             |

Errors look like `{ statusCode, code, message }`, where `code` is one of `SESSION_NOT_FOUND` (404), `SESSION_FULL` (409), `ALREADY_REGISTERED` (409), `NOT_REGISTERED` (404), `REGISTRATION_NOT_OPEN` (403), `REGISTRATION_CLOSED` (403), `SESSION_STARTED` (409), or `INVALID_WINDOW` (400). Input validation failures (400) come from Nest's `ValidationPipe` and have a `message` array but no `code`.

## Decisions

- **In-memory storage.** The brief allows it, and it keeps the focus on the business rules. Node is single-threaded and the check-then-insert in `register` is synchronous, so concurrent requests can't exceed capacity. Docker isn't needed because there is no database. A real database would need a transaction or a unique constraint to keep this guarantee.
- **One service, one module.** All rules live in `SessionsService`. No repository layer, since there is only one store.
- **Injectable `Clock`.** "Now" is passed in, so window tests are deterministic without fake timers.
- **Server is the source of truth in the UI.** The UI doesn't pre-disable buttons based on seats or the window. It shows the error the server returns, which also avoids client/server clock skew.

## Assumptions

- The registration window is `[opens, closes)`: opens is inclusive, closes is exclusive.
- A session must satisfy `opens < closes <= start`, so nobody can register after it starts.
- "Upcoming" means `startsAt > now`. Started sessions disappear from the list.
- Unregistering is allowed any time before the session starts, even after registration closes.
- Emails are trimmed and lowercased, so `A@x.com` and `a@x.com` are the same participant.
- All times are UTC ISO strings. The UI displays them in the browser's local time.
- The API never returns participant emails, only `seatsRemaining`.
- There is no authentication. The email is the participant's identity, as the brief specifies, so anyone can unregister anyone who knows their email. Acceptable for this scope, not for production.

## What I cut, and why

- **UI for creating and unregistering sessions.** The API supports both, but the brief asks for list and register in the UI. A seed script covers dev data.
- **Controller/e2e tests.** The service holds the rules and the controller only maps HTTP to it.
- **Frontend tests.** The brief weights the capacity and window rules.
- **Concurrency tests.** The in-memory check-then-insert is synchronous, so a unit test can't meaningfully race it.
- **Persistence, auth, pagination, styling.** Out of scope for the timebox.

## What I'd do next with another day

- Persist to Postgres or SQLite with a `UNIQUE (session_id, email)` constraint and a transactional capacity check (or `SELECT ... FOR UPDATE`), plus a concurrency test against it.
- Add a UI for creating sessions, unregistering, and status badges ("Full", "Closed", "Opens soon").
- Add e2e tests for the HTTP layer (status codes and error bodies) and a few component tests.
- Add a waitlist for full sessions.
- Add email verification or auth so registrations can't be made or cancelled on someone else's behalf.
- Add Docker Compose for the API, the UI, and a database.

## How I used AI

I used Claude as a pair-programming assistant throughout. We planned the work as five commits (scaffold, domain, UI, tests, README), and Claude generated code snippets while I ran, reviewed, iterated, and committed it. I pushed back against some of Claude's attempts to make this more production-ready, emphasizing my preference to keep it a single-component UI with no router, store, or UI library, and the choice of a seed script over a create-session form, considering the time constraints and focus of the assignment.
