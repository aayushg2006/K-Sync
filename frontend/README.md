# Frontend

The frontend is a React + Vite operations console for K-Sync. It reads backend data through `VITE_API_BASE_URL` and renders the dashboard, events, audit, conflicts, business sync, and demo control pages.

## Local Setup

1. Ensure `frontend/.env` exists.
2. Install dependencies:
   `npm install`
3. Start the frontend only:
   `npm --prefix frontend run dev`

## Environment

- `VITE_API_BASE_URL`: backend base URL, default local value is `http://localhost:8080`
- For local verification against the deployed Cloud Run backend, set `frontend/.env` to the deployed service URL and restart Vite.

## Build

`npm --prefix frontend run build`
