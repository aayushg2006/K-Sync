# OpenAPI Notes

## Location

- Swagger UI is served at `/api/docs`
- Health check is served at `/health`

## Main API Groups

- `Health`: runtime health endpoint
- `Mock SWS`, `Mock e-Karmika`, `Mock e-Surakshate`: mock source and target systems
- `K-Sync`: ingest APIs plus canonical event reads
- `Scenarios`: deterministic demo runners
- `Audit`: traceability and correlation lookups
- `Conflicts`: review, replay, and resolution inspection
- `Dashboard`: metrics, queue state, health, business comparison, events, audit, and conflicts

## Demo-Critical Endpoints

- `POST /api/ksync/reset-demo`
- `POST /api/ksync/run-scenario/sws-to-departments`
- `POST /api/ksync/run-scenario/department-to-sws`
- `POST /api/ksync/run-scenario/conflict`
- `POST /api/ksync/run-scenario/idempotency`
- `POST /api/ksync/run-scenario/failure-retry`

## Operational Endpoints

- `GET /api/dashboard/metrics`
- `GET /api/dashboard/system-health`
- `GET /api/dashboard/queue-status`
- `GET /api/dashboard/business-comparison/:ubid`
- `GET /api/dashboard/events`
- `GET /api/dashboard/audit`
- `GET /api/dashboard/conflicts`
- `GET /api/conflicts`
- `GET /api/audit/logs`

## Notes

- Swagger examples match the deterministic demo data model in the backend.
- For live demos, start with `reset-demo` so screenshots and traces stay predictable.
