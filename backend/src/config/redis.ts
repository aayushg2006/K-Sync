import IORedis from "ioredis";

import env from "./env";

export const redisConnection = new IORedis(env.REDIS_URL, {
  enableReadyCheck: false,
  lazyConnect: true,
  maxRetriesPerRequest: null,
  retryStrategy: (attempts) => Math.min(attempts * 1000, 5000),
});

let hasLoggedUnavailable = false;

redisConnection.on("ready", () => {
  hasLoggedUnavailable = false;
  console.info(`Redis connection ready at ${env.REDIS_URL}`);
});

redisConnection.on("error", (error) => {
  if (!hasLoggedUnavailable) {
    console.warn(`Redis is currently unavailable at ${env.REDIS_URL}. The app will continue running and queue operations will retry when Redis is reachable.`);
    hasLoggedUnavailable = true;
  }

  console.warn(`Redis connection error: ${error.message}`);
});

void redisConnection.connect().catch(() => {
  console.warn(`Initial Redis connection could not be established at ${env.REDIS_URL}. Continuing startup without failing the app.`);
});
