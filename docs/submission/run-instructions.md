# K-Sync Local Run Instructions

## Prerequisites
- Node.js and npm
- Supabase development database credentials configured in `backend/.env`
- Redis `>= 5.0.0`

## Start the stack
1. Stop any existing K-Sync frontend/backend dev processes before restarting.
   PowerShell example:
   `Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'node.exe' -and $_.CommandLine -match 'K-Sync|vite|ts-node-dev|dev-start|npm run dev' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }`
2. Start Redis with Docker:
   `npm run redis:up`
3. Start backend and frontend from the repo root:
   `npm run dev`
4. Open the app:
   - Frontend: `http://localhost:5173`
   - Backend: `http://localhost:8080`
   - Swagger: `http://localhost:8080/api/docs`
5. If `5173` or `8080` is already in use, the root dev starter picks the next available port automatically. Read the `[dev-start] backend=... frontend=...` startup line to confirm the actual URLs.

## Test the system
1. Verify health:
   `GET http://localhost:8080/health`
2. Run scenario APIs:
   - `POST /api/ksync/run-scenario/sws-to-departments`
   - `POST /api/ksync/run-scenario/department-to-sws`
   - `POST /api/ksync/run-scenario/conflict`
   - `POST /api/ksync/run-scenario/idempotency`
   - `POST /api/ksync/run-scenario/failure-retry`
   - `POST /api/ksync/reset-demo`
3. Review the frontend pages:
   - `/dashboard`
   - `/business-sync`
   - `/events`
   - `/audit`
   - `/conflicts`
   - `/demo-control`

## Run backend tests
1. Keep Redis running.
2. Execute:
   `npm --prefix backend run test -- --run`

## Redis compatibility note
If the machine has an older Windows Redis service, do not use it for K-Sync queue tests. BullMQ requires Redis `>= 5.0.0`. Use Docker Redis or another compatible Redis instance and supply `REDIS_URL` at process start if needed.
