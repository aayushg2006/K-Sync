# Frontend Deploy

## Target

The frontend can be hosted on Vercel while the backend runs on Cloud Run.

## Required Env

```env
VITE_API_BASE_URL=https://<cloud-run-service-url>
```

## Deploy Steps

1. Import the `frontend/` directory into Vercel.
2. Add `VITE_API_BASE_URL` in the Vercel project settings.
3. Trigger a production deploy.
4. Add the deployed Vercel origin to the backend `FRONTEND_URLS` value and redeploy the backend if needed.

## CORS Note

The backend now supports multiple allowed origins through `FRONTEND_URLS`, so local Vite and hosted frontend origins can coexist without code changes.
