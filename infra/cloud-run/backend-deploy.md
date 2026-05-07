# Cloud Run Backend Deploy

## Target Shape

- Backend service: Google Cloud Run
- Database: Supabase PostgreSQL
- Queue backend: Redis
- Runtime model: one always-on Cloud Run instance so BullMQ workers keep processing

## Required Project Prerequisites

- Billing must be linked to the GCP project before enabling Cloud Run, Cloud Build, Artifact Registry, Secret Manager, VPC Access, or Memorystore APIs.
- `gcloud auth list` should show the intended account as `ACTIVE`.
- Default project should be `ksync-prototype`.
- Default region should be `asia-south1`.

## Required Runtime Env

- `NODE_ENV=production`
- `PORT=8080`
- `FRONTEND_URLS=<comma-separated allowed origins>`
- `DATABASE_URL=<Supabase pooler URL>`
- `DIRECT_URL=<Supabase direct connection URL>`
- `REDIS_URL=<hosted redis URL>`
- `CONFLICT_WINDOW_SECONDS=10`
- `QUEUE_MAX_ATTEMPTS=3`
- `ENABLE_POLLER=false`
- `POLLER_INTERVAL_SECONDS=300`
- `RUN_MIGRATIONS_ON_STARTUP=true`
- `RUN_SEED_ON_STARTUP=false`

## Deployment Outline

1. Enable APIs:
   `gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com vpcaccess.googleapis.com redis.googleapis.com compute.googleapis.com`
2. Create Artifact Registry repo:
   `gcloud artifacts repositories create k-sync --repository-format=docker --location=asia-south1`
3. Build and push the backend image:
   `gcloud builds submit backend --tag asia-south1-docker.pkg.dev/ksync-prototype/k-sync/k-sync-backend:latest`
4. Store sensitive DB URLs in Secret Manager:
   - `ksync-database-url`
   - `ksync-direct-url`
5. Provision Redis:
   - Preferred simple public option from the tech stack: Upstash
   - Fully-in-GCP option: Memorystore plus Serverless VPC Access
6. Deploy Cloud Run with:
   - `--min-instances=1`
   - `--max-instances=1`
   - `--no-cpu-throttling`
   - `--allow-unauthenticated`
   - secret-backed DB env vars
   - env-backed Redis and frontend-origin config

## Why Min Instances Matters

This backend starts BullMQ workers inside the same service process. Cloud Run must keep one instance warm and CPU-allocated or queued work can stall after requests complete.

## Verification

- `GET /health`
- `GET /api/dashboard/metrics`
- `GET /api/dashboard/queue-status`
- `POST /api/ksync/reset-demo`
- `POST /api/ksync/run-scenario/sws-to-departments`

## Frontend Follow-Up

After deployment, set `frontend/.env`:

```env
VITE_API_BASE_URL=https://<cloud-run-service-url>
```

Then restart the local frontend or rebuild the hosted frontend.
