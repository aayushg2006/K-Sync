# K-Sync

K-Sync is a zero-touch interoperability hub for deterministic two-way synchronization between a mock Karnataka Single Window System and mock department systems. The repo is organized as a small monorepo with a React frontend, an Express backend, local infrastructure helpers, and project documentation.

## Repo Structure

- `frontend/` React + Vite + TypeScript console UI
- `backend/` Express + TypeScript + Prisma + BullMQ services
- `docs/` architecture, tech-stack, API, demo, and submission notes
- `infra/` deployment and integration setup notes
- `scripts/` local development entrypoints

## Environment Files

- `frontend/.env` sets `VITE_API_BASE_URL`
- `backend/.env` contains backend runtime settings plus database and Redis configuration
- `frontend/.env.example` and `backend/.env.example` are safe templates for fresh setup

## Local Development

1. Install dependencies from the repo root:
   `npm install`
2. Review or update:
   - `frontend/.env`
   - `backend/.env`
3. Start Redis:
   `npm run redis:up`
4. Start the app:
   `npm run dev`
5. Open:
   - Frontend: `http://localhost:5173`
   - Backend: `http://localhost:8080`
   - Swagger: `http://localhost:8080/api/docs`

If `5173` or `8080` is already occupied, the root dev starter chooses the next available port and prints the actual URLs in the `[dev-start]` log line.

## Docker Stack

- Full local stack: `npm run docker:up`
- Stop the stack: `npm run docker:down`
- Stream container logs: `npm run docker:logs`

The compose stack now includes PostgreSQL, Redis, the backend container, and a static frontend container. Runtime settings remain env-driven so secrets stay outside committed files.

## Cloud Run Backend

- Deployment notes: `infra/cloud-run/backend-deploy.md`
- Service manifest template: `infra/cloud-run/service.yaml`
- The intended production shape follows the architecture docs: Cloud Run for the backend, PostgreSQL via Supabase, and Redis-backed queue processing.

## Useful Commands

- Start frontend only: `npm run dev:frontend`
- Start backend only: `npm run dev:backend`
- Stop Redis container: `npm run redis:down`
- Build frontend: `npm --prefix frontend run build`
- Build backend: `npm --prefix backend run build`
- Run backend tests: `npm --prefix backend run test -- --run`

## Notes

- Redis is exposed through Docker on `localhost:6380`
- Keep real credentials only in local `.env` files, never in committed examples
- Additional run and demo details are in `docs/submission/run-instructions.md`
