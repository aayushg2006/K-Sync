# Supabase Setup

## Purpose

Supabase hosts the PostgreSQL database used by Prisma for canonical events, audit logs, conflicts, queue metadata, registry data, and seeded demo records.

## Create The Project

1. Create a Supabase project in the nearest region available to the demo team.
2. Open the project database settings.
3. Copy two connection strings:
   - pooled connection for runtime traffic
   - direct connection for Prisma migrations

## Map Into Backend Env

```env
DATABASE_URL=postgresql://<pooler-user>:<password>@<pooler-host>:5432/postgres?schema=public&sslmode=require
DIRECT_URL=postgresql://<db-user>:<password>@<direct-host>:5432/postgres?schema=public&sslmode=require
```

## Initialize Schema

- `npm --prefix backend run db:deploy`
- `npm --prefix backend run db:seed`

Use `db:seed` only when you intentionally want the deterministic demo dataset restored.
