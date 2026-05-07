import { Prisma } from "@prisma/client";

import { CanonicalEvent } from "../../common/types/event.types";
import { EventStatus } from "../../common/types/system.types";
import { redisConnection } from "../../config/redis";
import prisma from "../../config/prisma";
import {
  createFallbackIdempotencyKey,
  createPrimaryIdempotencyKey,
} from "./idempotency.keys";

interface RedisIdempotencyPayload<T = unknown> {
  cachedResult?: T;
  eventId?: string;
  fallbackKey: string;
  primaryKey?: string;
  status?: EventStatus;
}

export interface CheckAndStoreResult<T = unknown> {
  cachedResult?: T;
  duplicate: boolean;
  existingEventId?: string;
  keys: {
    fallback: string;
    primary?: string;
  };
  status?: EventStatus;
}

type IdempotencyRow = {
  cachedResult: Prisma.JsonValue | null;
  eventId: string | null;
  fallbackKey: string;
  primaryKey: string | null;
  status: EventStatus | null;
};

const REDIS_IDEMPOTENCY_PREFIX = "ksync:idempotency";

function clone<T>(value: T): T {
  return structuredClone(value);
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function parseCachedResult<T>(value: Prisma.JsonValue | null): T | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }

  return clone(value as T);
}

function getRedisEntryKey(key: string) {
  return `${REDIS_IDEMPOTENCY_PREFIX}:${key}`;
}

function getEventStatusFromResponse(value: unknown): EventStatus | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const status = (value as { status?: unknown }).status;
  return typeof status === "string" ? (status as EventStatus) : undefined;
}

function buildKeys(event: Pick<CanonicalEvent, "normalizedPayloadHash" | "serviceType" | "sourceRequestId" | "sourceSystem" | "ubid">) {
  const primaryKey = event.sourceRequestId
    ? createPrimaryIdempotencyKey(event.sourceSystem, event.sourceRequestId)
    : undefined;
  const fallbackKey = createFallbackIdempotencyKey(
    event.sourceSystem,
    event.ubid,
    event.serviceType,
    event.normalizedPayloadHash,
  );

  return {
    fallback: fallbackKey,
    ...(primaryKey ? { primary: primaryKey } : {}),
  };
}

async function isRedisReady() {
  return redisConnection.status === "ready";
}

async function getRedisDuplicate<T>(keys: { fallback: string; primary?: string }) {
  if (!(await isRedisReady())) {
    return null;
  }

  try {
    const values = await redisConnection.mget(
      ...[keys.primary, keys.fallback]
        .filter((key): key is string => Boolean(key))
        .map((key) => getRedisEntryKey(key)),
    );
    const payload = values.find((value): value is string => Boolean(value));

    if (!payload) {
      return null;
    }

    return JSON.parse(payload) as RedisIdempotencyPayload<T>;
  } catch (error) {
    console.warn(`Redis idempotency check failed: ${(error as Error).message}`);
    return null;
  }
}

async function setRedisPayload<T>(
  keys: { fallback: string; primary?: string },
  payload: RedisIdempotencyPayload<T>,
) {
  if (!(await isRedisReady())) {
    return;
  }

  const serializedPayload = JSON.stringify(payload);
  const redisKeys = [keys.primary, keys.fallback].filter(
    (key): key is string => Boolean(key),
  );

  if (redisKeys.length === 0) {
    return;
  }

  try {
    const pipeline = redisConnection.pipeline();

    for (const key of redisKeys) {
      pipeline.set(getRedisEntryKey(key), serializedPayload);
    }

    await pipeline.exec();
  } catch (error) {
    console.warn(`Redis idempotency cache write failed: ${(error as Error).message}`);
  }
}

async function findIdempotencyRecord(keys: { fallback: string; primary?: string }) {
  return prisma.idempotencyKey.findFirst({
    where: {
      OR: [
        { fallbackKey: keys.fallback },
        ...(keys.primary ? [{ primaryKey: keys.primary }] : []),
      ],
    },
    select: {
      cachedResult: true,
      eventId: true,
      fallbackKey: true,
      primaryKey: true,
      status: true,
    },
  });
}

function toCheckResultFromRedis<T>(
  keys: { fallback: string; primary?: string },
  record: RedisIdempotencyPayload<T>,
): CheckAndStoreResult<T> {
  return {
    cachedResult: record.cachedResult,
    duplicate: true,
    existingEventId: record.eventId ?? undefined,
    keys,
    status: record.status ?? undefined,
  };
}

function toCheckResultFromDatabase<T>(
  keys: { fallback: string; primary?: string },
  record: IdempotencyRow,
): CheckAndStoreResult<T> {
  return {
    cachedResult: parseCachedResult<T>(record.cachedResult),
    duplicate: true,
    existingEventId: record.eventId ?? undefined,
    keys,
    status: record.status ?? undefined,
  };
}

export async function checkAndStore<T = unknown>(
  event: CanonicalEvent,
): Promise<CheckAndStoreResult<T>> {
  const keys = buildKeys(event);
  const redisRecord = await getRedisDuplicate<T>(keys);

  if (redisRecord) {
    return toCheckResultFromRedis<T>(keys, redisRecord);
  }

  const existingRecord = await findIdempotencyRecord(keys);

  if (existingRecord) {
    await setRedisPayload<T>(keys, {
      cachedResult: parseCachedResult<T>(existingRecord.cachedResult),
      eventId: existingRecord.eventId ?? undefined,
      fallbackKey: existingRecord.fallbackKey,
      primaryKey: existingRecord.primaryKey ?? undefined,
      status: existingRecord.status ?? undefined,
    });

    return toCheckResultFromDatabase<T>(keys, existingRecord);
  }

  try {
    await prisma.idempotencyKey.create({
      data: {
        eventId: event.eventId,
        fallbackKey: keys.fallback,
        normalizedPayloadHash: event.normalizedPayloadHash,
        primaryKey: keys.primary ?? null,
        sourceRequestId: event.sourceRequestId ?? null,
        sourceSystem: event.sourceSystem,
        status: event.status,
        serviceType: event.serviceType,
        ubid: event.ubid,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const duplicateRecord = await findIdempotencyRecord(keys);

      if (duplicateRecord) {
        await setRedisPayload<T>(keys, {
          cachedResult: parseCachedResult<T>(duplicateRecord.cachedResult),
          eventId: duplicateRecord.eventId ?? undefined,
          fallbackKey: duplicateRecord.fallbackKey,
          primaryKey: duplicateRecord.primaryKey ?? undefined,
          status: duplicateRecord.status ?? undefined,
        });

        return toCheckResultFromDatabase<T>(keys, duplicateRecord);
      }
    }

    throw error;
  }

  await setRedisPayload<T>(keys, {
    eventId: event.eventId,
    fallbackKey: keys.fallback,
    primaryKey: keys.primary,
    status: event.status,
  });

  return {
    duplicate: false,
    existingEventId: event.eventId,
    keys,
    status: event.status,
  };
}

export async function saveResponse<T = unknown>(
  idempotencyKey: string,
  response: T,
): Promise<T> {
  const matchedRecord = await prisma.idempotencyKey.findFirst({
    where: {
      OR: [{ fallbackKey: idempotencyKey }, { primaryKey: idempotencyKey }],
    },
    select: {
      eventId: true,
      fallbackKey: true,
      primaryKey: true,
    },
  });

  if (!matchedRecord) {
    return response;
  }

  const status = getEventStatusFromResponse(response);

  await prisma.idempotencyKey.updateMany({
    where: {
      OR: [
        { fallbackKey: matchedRecord.fallbackKey },
        ...(matchedRecord.primaryKey
          ? [{ primaryKey: matchedRecord.primaryKey }]
          : []),
      ],
    },
    data: {
      cachedResult: toJsonValue(response),
      status: status ?? undefined,
    },
  });

  await setRedisPayload<T>(
    {
      fallback: matchedRecord.fallbackKey,
      ...(matchedRecord.primaryKey ? { primary: matchedRecord.primaryKey } : {}),
    },
    {
      cachedResult: response,
      eventId: matchedRecord.eventId ?? undefined,
      fallbackKey: matchedRecord.fallbackKey,
      primaryKey: matchedRecord.primaryKey ?? undefined,
      status,
    },
  );

  return response;
}

export async function getCachedResponse<T = unknown>(
  idempotencyKey: string,
): Promise<T | undefined> {
  const redisRecord = await getRedisDuplicate<T>({ fallback: idempotencyKey });

  if (redisRecord?.cachedResult !== undefined) {
    return clone(redisRecord.cachedResult);
  }

  const databaseRecord = await prisma.idempotencyKey.findFirst({
    where: {
      OR: [{ fallbackKey: idempotencyKey }, { primaryKey: idempotencyKey }],
    },
    select: {
      cachedResult: true,
      eventId: true,
      fallbackKey: true,
      primaryKey: true,
      status: true,
    },
  });

  if (!databaseRecord) {
    return undefined;
  }

  const cachedResponse = parseCachedResult<T>(databaseRecord.cachedResult);

  await setRedisPayload<T>(
    {
      fallback: databaseRecord.fallbackKey,
      ...(databaseRecord.primaryKey ? { primary: databaseRecord.primaryKey } : {}),
    },
    {
      cachedResult: cachedResponse,
      eventId: databaseRecord.eventId ?? undefined,
      fallbackKey: databaseRecord.fallbackKey,
      primaryKey: databaseRecord.primaryKey ?? undefined,
      status: databaseRecord.status ?? undefined,
    },
  );

  return cachedResponse;
}
