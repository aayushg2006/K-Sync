# Backend

The backend is an Express + TypeScript service that provides K-Sync APIs, Prisma database access, BullMQ queue workflows, mock department adapters, and demo scenario endpoints.

## Local Setup

1. Ensure `backend/.env` exists and contains valid database credentials.
2. Start Redis on `localhost:6380` with:
   `npm run redis:up`
3. Start the backend only:
   `npm --prefix backend run dev`

## Required Environment

- `NODE_ENV`
- `PORT`
- `FRONTEND_URL`
- `FRONTEND_URLS`
- `REDIS_URL`
- `DATABASE_URL`
- `DIRECT_URL`
- `CONFLICT_WINDOW_SECONDS`
- `QUEUE_MAX_ATTEMPTS`
- `ENABLE_POLLER`
- `POLLER_INTERVAL_SECONDS`
- `RUN_MIGRATIONS_ON_STARTUP`
- `RUN_SEED_ON_STARTUP`

## Useful Commands

- Build: `npm --prefix backend run build`
- Test: `npm --prefix backend run test -- --run`
- Prisma generate: `npm --prefix backend run db:generate`
- Prisma migrate: `npm --prefix backend run db:migrate`
- Production entrypoint: `npm --prefix backend run start:prod`
- One-time bootstrap against a configured database: `npm --prefix backend run bootstrap:demo`
