# Upstash Setup

## When To Use It

Use Upstash when you want the simplest hosted Redis option for Cloud Run without adding a VPC connector and Memorystore.

## Create The Redis Database

1. Create a Redis database in Upstash.
2. Copy the TLS connection string from the dashboard.
3. Store it outside the repo in the runtime env.

## Backend Env Mapping

```env
REDIS_URL=rediss://default:<password>@<host>:<port>
```

## Notes For BullMQ

- BullMQ works with hosted Redis as long as the backend can reach the endpoint.
- Keep `QUEUE_MAX_ATTEMPTS` and retry timing in env so the behavior stays adjustable without code changes.
- For a fully GCP-native deployment, Memorystore is also valid; in that case use a private `redis://<ip>:6379` URL instead.
