# Submission Checklist

## Core Deliverables

- Backend is reachable through `GET /health`
- Swagger is reachable through `/api/docs`
- Frontend is configured with `VITE_API_BASE_URL`
- Repository includes safe `.env.example` files only
- README explains local run, Docker run, and deployment notes

## Demo Readiness

- Run `POST /api/ksync/reset-demo` before recording
- Verify dashboard metrics load
- Verify queue status loads
- Verify authority matrix loads
- Verify the five demo scenarios run cleanly from the Demo Control page

## Scenario Coverage

- Scenario 1: `POST /api/ksync/run-scenario/sws-to-departments`
- Scenario 2: `POST /api/ksync/run-scenario/department-to-sws`
- Scenario 3: `POST /api/ksync/run-scenario/conflict`
- Scenario 4: `POST /api/ksync/run-scenario/idempotency`
- Scenario 5: `POST /api/ksync/run-scenario/failure-retry`

## Evidence To Capture

- App landing/dashboard screenshot
- System health and queue status screenshot
- At least one event trace screenshot
- At least one audit trail screenshot
- Conflict resolution screenshot
- Demo Control page screenshot showing scenario results

## Final Pre-Push Checks

- `npm --prefix backend run build`
- `npm --prefix frontend run build`
- `backend/.env` is ignored
- `frontend/.env` is ignored
- No passwords, tokens, or connection strings appear in tracked markdown or source files
