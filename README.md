# K-Sync

K-Sync is a zero-touch interoperability hub for deterministic two-way synchronization between a mock Karnataka Single Window System and mock department systems. It demonstrates how business updates can move safely in both directions without modifying the source systems themselves.

The project is built as a small monorepo with:

- a React operations console
- an Express + TypeScript backend
- Prisma-backed PostgreSQL persistence
- BullMQ + Redis queue processing
- deterministic demo scenarios for evaluation and submission

## What The Project Solves

K-Sync models the split-brain problem between:

- `SWS`: Karnataka Single Window System
- `EKARMIKA`: labour department system
- `ESURAKSHATE`: factory safety department system

In the real problem, the same business can exist in multiple systems with different identifiers, schemas, and update timelines. K-Sync acts as the anti-corruption layer between them by:

- using `UBID` as the common join key
- translating data through deterministic mappings
- detecting duplicates through idempotency checks
- detecting conflicts through a holding-pen + authority-matrix model
- propagating validated changes through queue-backed workers
- recording a complete audit trail for every significant stage

## Core Capabilities

- Two-way synchronization:
  - `SWS -> K-Sync -> Department Systems`
  - `Department Systems -> K-Sync -> SWS`
- Deterministic schema translation using JSONata
- Mock adapters for SWS, e-Karmika, and e-Surakshate
- Conflict detection and resolution tracking
- Polling-based change discovery for department-side updates
- Queue-backed delivery with retry behavior
- Canonical event storage, audit logs, and dashboard metrics
- Scenario runner APIs for demo-friendly deterministic flows

## Architecture Summary

At a high level, the system works like this:

1. A source system change is ingested into K-Sync.
2. The backend normalizes the payload into a canonical event model.
3. Idempotency checks prevent duplicate processing.
4. Conflict rules determine whether the event can continue safely.
5. Routing logic identifies destination systems.
6. Translation mappings produce target-specific payloads.
7. BullMQ workers deliver writes to destination systems.
8. Every major step is written to the audit trail and dashboard views.

## Repository Structure

```text
K-Sync/
|-- backend/                  Express + TypeScript backend
|   |-- prisma/               Prisma schema, migrations, seed data
|   |-- src/
|   |   |-- common/           shared errors, middleware, types, utils
|   |   |-- config/           env, Redis, Prisma, queue setup
|   |   |-- docs/             Swagger/OpenAPI definitions
|   |   |-- modules/          business modules and system adapters
|   |   |-- tests/            backend test suite
|   |   `-- validation/       Zod request validation schemas
|   |-- Dockerfile
|   `-- README.md
|-- frontend/                 React + Vite operations console
|   |-- src/
|   |   |-- components/       shared and layout UI components
|   |   |-- lib/              API client, constants, helpers
|   |   |-- pages/            dashboard, audit, conflicts, demo pages
|   |   |-- routes/           app router
|   |   |-- services/         backend-facing service wrappers
|   |   `-- types/            frontend API/domain types
|   |-- Dockerfile
|   `-- README.md
|-- docs/                     architecture, API, demo, and submission notes
|-- infra/                    deployment and infrastructure notes
|-- scripts/                  local startup and deployment helpers
|-- docker-compose.yml        local container stack
`-- README.md                 this file
```

## Backend Modules

The backend is organized by capabilities rather than by transport alone.

- `modules/ksync`: ingest pipeline and canonical event APIs
- `modules/mock-sws`: mock SWS read/write behavior
- `modules/mock-ekarmika`: mock labour department behavior
- `modules/mock-esurakshate`: mock factory safety behavior
- `modules/conflicts`: conflict detection, review, replay, authority decisions
- `modules/audit`: audit trail access
- `modules/dashboard`: dashboard metrics, queue status, business comparison
- `modules/polling`: snapshot comparison and change discovery
- `modules/translation`: schema registry and JSONata mapping execution
- `modules/queues`: BullMQ processors and workers
- `modules/scenarios`: deterministic demo scenario runners

## Frontend Pages

The frontend is a compact operations console for evaluators and demo users.

- `/dashboard`: top-level metrics and system health
- `/business-sync`: per-business cross-system comparison
- `/events`: canonical event list and event drill-down
- `/audit`: audit trail inspection
- `/conflicts`: conflict review and replay visibility
- `/demo-control`: deterministic scenario runner interface

## Tech Stack

| Area | Stack |
| --- | --- |
| Frontend | React, Vite, TypeScript, Tailwind CSS, TanStack Query, Axios |
| Backend | Node.js, Express, TypeScript |
| Database | Supabase PostgreSQL |
| ORM | Prisma |
| Queues / Cache | BullMQ, Redis |
| Validation | Zod |
| Translation | JSONata, fast-xml-parser |
| API Docs | Swagger / OpenAPI |
| Backend Hosting | Google Cloud Run |
| Frontend Hosting | Google Cloud Run |

## Demo Scenarios

The project includes deterministic scenario runners used for demo and submission flows.

1. `sws-to-departments`
   SWS registered-address change propagates to both departments.
2. `department-to-sws`
   A direct department-side change is detected by polling and synced back to SWS.
3. `conflict`
   Competing updates create a conflict that is resolved through the authority matrix.
4. `idempotency`
   Duplicate submission is rejected without generating duplicate queue work.
5. `failure-retry`
   A controlled downstream write failure is retried successfully.

More detail is in [docs/demo/scenario-flows.md](docs/demo/scenario-flows.md) and [docs/demo/demo-script.md](docs/demo/demo-script.md).

## Environment Configuration

Secrets are intentionally kept out of Git.

Use these templates:

- [backend/.env.example](backend/.env.example)
- [frontend/.env.example](frontend/.env.example)

Important backend env values:

- `DATABASE_URL`
- `DIRECT_URL`
- `REDIS_URL`
- `FRONTEND_URLS`
- `CONFLICT_WINDOW_SECONDS`
- `QUEUE_MAX_ATTEMPTS`
- `ENABLE_POLLER`
- `POLLER_INTERVAL_SECONDS`
- `RUN_MIGRATIONS_ON_STARTUP`
- `RUN_SEED_ON_STARTUP`

Important frontend env value:

- `VITE_API_BASE_URL`

## Local Development

### Prerequisites

- Node.js and npm
- Docker Desktop
- Supabase database credentials in `backend/.env`
- Redis available locally through Docker or another compatible instance

### Quick Start

1. Install dependencies from the repo root:
   `npm install`
2. Create or update:
   - `backend/.env`
   - `frontend/.env`
3. Start Redis:
   `npm run redis:up`
4. Start frontend and backend together:
   `npm run dev`
5. Open:
   - Frontend: `http://localhost:5173`
   - Backend: `http://localhost:8080`
   - Swagger: `http://localhost:8080/api/docs`

If `5173` or `8080` is already taken, the root dev script automatically picks the next free port and prints the actual URLs.

### Helpful Commands

- Start frontend only: `npm run dev:frontend`
- Start backend only: `npm run dev:backend`
- Stop Redis: `npm run redis:down`
- Build backend: `npm --prefix backend run build`
- Build frontend: `npm --prefix frontend run build`
- Run backend tests: `npm --prefix backend run test -- --run`
- Apply migrations: `npm --prefix backend run db:deploy`
- Seed deterministic demo data: `npm --prefix backend run db:seed`

## Docker Workflow

The root compose file provides a fuller local stack.

- Start full stack: `npm run docker:up`
- Stop full stack: `npm run docker:down`
- Stream logs: `npm run docker:logs`

The compose stack includes:

- PostgreSQL
- Redis
- backend container
- frontend container

## API And Documentation

- Swagger UI: `GET /api/docs`
- Health check: `GET /health`
- API notes: [docs/api/openapi-notes.md](docs/api/openapi-notes.md)
- Run instructions: [docs/submission/run-instructions.md](docs/submission/run-instructions.md)

Key API groups:

- `K-Sync`
- `Mock SWS`
- `Mock e-Karmika`
- `Mock e-Surakshate`
- `Audit`
- `Conflicts`
- `Dashboard`
- `Polling`
- `Scenarios`

## Deployment

The current production-style deployment uses:

- Backend on Google Cloud Run
- Frontend on Google Cloud Run
- PostgreSQL on Supabase
- Redis on GCP Memorystore

Current live URLs:

- Frontend: `https://k-sync-frontend-729436216540.asia-south1.run.app`
- Backend: `https://k-sync-backend-729436216540.asia-south1.run.app`

Deployment notes and templates:

- [infra/cloud-run/backend-deploy.md](infra/cloud-run/backend-deploy.md)
- [infra/cloud-run/service.yaml](infra/cloud-run/service.yaml)
- [infra/vercel/frontend-deploy.md](infra/vercel/frontend-deploy.md)
- [infra/supabase/setup.md](infra/supabase/setup.md)
- [infra/upstash/setup.md](infra/upstash/setup.md)

## Documentation Map

- Architecture: [docs/architecture/K-Sync Architecture Doc.docx](<docs/architecture/K-Sync Architecture Doc.docx>)
- Tech stack: [docs/tech-stack/K-Sync Tech Stack Doc.docx](<docs/tech-stack/K-Sync Tech Stack Doc.docx>)
- OpenAPI notes: [docs/api/openapi-notes.md](docs/api/openapi-notes.md)
- Demo script: [docs/demo/demo-script.md](docs/demo/demo-script.md)
- Scenario flows: [docs/demo/scenario-flows.md](docs/demo/scenario-flows.md)
- Screenshot plan: [docs/demo/screenshots-plan.md](docs/demo/screenshots-plan.md)
- Submission checklist: [docs/submission/submission-checklist.md](docs/submission/submission-checklist.md)
- Run instructions: [docs/submission/run-instructions.md](docs/submission/run-instructions.md)

## Notes

- The backend seed flow restores a deterministic demo baseline and is intentionally destructive.
- BullMQ requires Redis `>= 5.0.0`.
- Runtime configuration is env-driven so credentials do not need to be committed.
- The local frontend env can point either to local backend development or the deployed backend.
