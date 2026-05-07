# Supabase Connection Notes

## Connection Split

- `DATABASE_URL` should point to the Supabase pooler because it is better suited for runtime app traffic.
- `DIRECT_URL` should point to the direct database host because Prisma migrations need a direct connection path.

## SSL

- Keep `sslmode=require` in both URLs.

## Prisma Notes

- Runtime Prisma reads `DATABASE_URL`.
- Prisma migration commands use `DIRECT_URL`.
- `prisma migrate deploy` is safe for startup automation.
- `prisma db seed` is intentionally destructive in this prototype because it restores a deterministic demo baseline.

## Cloud Run Note

Supabase remains publicly reachable from Cloud Run, so it does not require a VPC connector in the current architecture. Only private Redis connectivity would require that path when using Memorystore.
