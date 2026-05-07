import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

function parseAllowedOrigins(frontendUrl?: string, frontendUrls?: string) {
  const combined = [frontendUrl, ...(frontendUrls?.split(",") ?? [])]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));

  const uniqueOrigins = [...new Set(combined)];

  if (uniqueOrigins.length === 0) {
    return ["http://localhost:5173"];
  }

  uniqueOrigins.forEach((origin) => {
    z.string().url().parse(origin);
  });

  return uniqueOrigins;
}

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(8080),
  FRONTEND_URL: z.string().trim().optional(),
  FRONTEND_URLS: z.string().trim().optional(),
  CONFLICT_WINDOW_SECONDS: z.coerce.number().int().positive().default(10),
  QUEUE_MAX_ATTEMPTS: z.coerce.number().int().positive().default(3),
  REDIS_URL: z.string().min(1).default("redis://localhost:6379"),
  ENABLE_POLLER: z.coerce.boolean().default(false),
  POLLER_INTERVAL_SECONDS: z.coerce.number().int().positive().default(300),
  RUN_MIGRATIONS_ON_STARTUP: z.coerce.boolean().default(false),
  RUN_SEED_ON_STARTUP: z.coerce.boolean().default(false),
});

const parsedEnv = envSchema.parse({
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,
  FRONTEND_URL: process.env.FRONTEND_URL,
  FRONTEND_URLS: process.env.FRONTEND_URLS,
  CONFLICT_WINDOW_SECONDS: process.env.CONFLICT_WINDOW_SECONDS,
  QUEUE_MAX_ATTEMPTS: process.env.QUEUE_MAX_ATTEMPTS,
  REDIS_URL: process.env.REDIS_URL,
  ENABLE_POLLER: process.env.ENABLE_POLLER,
  POLLER_INTERVAL_SECONDS: process.env.POLLER_INTERVAL_SECONDS,
  RUN_MIGRATIONS_ON_STARTUP: process.env.RUN_MIGRATIONS_ON_STARTUP,
  RUN_SEED_ON_STARTUP: process.env.RUN_SEED_ON_STARTUP,
});

const env = {
  ...parsedEnv,
  allowedCorsOrigins: parseAllowedOrigins(parsedEnv.FRONTEND_URL, parsedEnv.FRONTEND_URLS),
};

export default env;
