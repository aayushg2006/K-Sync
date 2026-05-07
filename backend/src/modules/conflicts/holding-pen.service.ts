import { CanonicalEvent } from "../../common/types/event.types";
import { redisConnection } from "../../config/redis";
import env from "../../config/env";
import {
  CanonicalFieldPath,
  getCanonicalFieldPathsForEvent,
} from "./canonical-field-paths";

export interface HoldingPenConflictCandidate {
  eventId: string;
  fieldPath: CanonicalFieldPath;
  ubid: string;
}

const HOLDING_PEN_KEY_PREFIX = "ksync:holding-pen";
const HOLDING_PEN_TTL_SECONDS = env.CONFLICT_WINDOW_SECONDS + 30;

function buildHoldingPenKey(ubid: string, fieldPath: CanonicalFieldPath) {
  return `${HOLDING_PEN_KEY_PREFIX}:${ubid}:${fieldPath}`;
}

function getConflictWindowStartMs(referenceTime: string) {
  return new Date(referenceTime).getTime() - env.CONFLICT_WINDOW_SECONDS * 1000;
}

async function runRedisOperation<T>(operation: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    console.warn(
      `[holding-pen] Redis operation failed: ${(error as Error).message}. Continuing without blocking ingest.`,
    );
    return fallback;
  }
}

async function removeExpiredEntries(
  ubid: string,
  fieldPath: CanonicalFieldPath,
  minScoreExclusive: number,
) {
  await runRedisOperation(
    () =>
      redisConnection.zremrangebyscore(
        buildHoldingPenKey(ubid, fieldPath),
        "-inf",
        `(${minScoreExclusive}`,
      ),
    0,
  );
}

export async function checkForConflicts(
  event: CanonicalEvent,
): Promise<HoldingPenConflictCandidate[]> {
  const fieldPaths = getCanonicalFieldPathsForEvent(event);
  const conflictWindowStart = getConflictWindowStartMs(event.receivedAt);

  const candidatesByField = await Promise.all(
    fieldPaths.map(async (fieldPath) => {
      await removeExpiredEntries(event.ubid, fieldPath, conflictWindowStart);

      const eventIds = await runRedisOperation(
        () =>
          redisConnection.zrangebyscore(
            buildHoldingPenKey(event.ubid, fieldPath),
            conflictWindowStart,
            "+inf",
          ),
        [] as string[],
      );

      return eventIds
        .filter((eventId) => eventId !== event.eventId)
        .map((eventId) => ({
          eventId,
          fieldPath,
          ubid: event.ubid,
        }));
    }),
  );

  const uniqueCandidates = new Map<string, HoldingPenConflictCandidate>();

  for (const candidate of candidatesByField.flat()) {
    uniqueCandidates.set(`${candidate.fieldPath}:${candidate.eventId}`, candidate);
  }

  return Array.from(uniqueCandidates.values());
}

export async function addToHoldingPen(event: CanonicalEvent) {
  const fieldPaths = getCanonicalFieldPathsForEvent(event);
  const receivedAtMs = new Date(event.receivedAt).getTime();

  await Promise.all(
    fieldPaths.map((fieldPath) =>
      runRedisOperation(async () => {
        const key = buildHoldingPenKey(event.ubid, fieldPath);
        const pipeline = redisConnection.pipeline();

        pipeline.zadd(key, receivedAtMs, event.eventId);
        pipeline.expire(key, HOLDING_PEN_TTL_SECONDS);

        await pipeline.exec();
      }, undefined),
    ),
  );
}

export async function clearExpired() {
  const scanPattern = `${HOLDING_PEN_KEY_PREFIX}:*`;
  let cursor = "0";
  const cutoff = Date.now() - env.CONFLICT_WINDOW_SECONDS * 1000;

  do {
    const [nextCursor, keys] = await runRedisOperation(
      () => redisConnection.scan(cursor, "MATCH", scanPattern, "COUNT", 100),
      ["0", [] as string[]],
    );
    cursor = nextCursor;

    if (keys.length > 0) {
      await Promise.all(
        keys.map((key) =>
          runRedisOperation(
            () => redisConnection.zremrangebyscore(key, "-inf", `(${cutoff}`),
            0,
          ),
        ),
      );
    }
  } while (cursor !== "0");
}

