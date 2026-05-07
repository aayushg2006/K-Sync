import { QueueJobStatus, Prisma } from "@prisma/client";
import { Job } from "bullmq";

import { AppError } from "../../../common/errors/AppError";
import { ERROR_CODES } from "../../../common/errors/errorCodes";
import { AuditLogInput } from "../../../common/types/audit.types";
import {
  CanonicalEvent,
  CanonicalPayload,
  CanonicalPayloadField,
} from "../../../common/types/event.types";
import { EventStatus, SystemName } from "../../../common/types/system.types";
import prisma from "../../../config/prisma";
import { writeAuditLog } from "../../audit/audit.service";
import { getAdapterForTargetSystem } from "../../adapters/adapter.registry";
import {
  AdapterTarget,
  AdapterWriteResult,
  DepartmentAdapter,
} from "../../adapters/DepartmentAdapter";
import { resolveTargets } from "../../ubid-registry/ubid.service";
import {
  QueueJobPayload,
  getQueueRecordsForEvent,
  getRetryDelayForAttempt,
  markQueueJobCompleted,
  markQueueJobProcessing,
  markQueueJobRetryScheduled,
  moveQueueJobToDeadLetter,
} from "../queue.service";

type CanonicalEventProcessorRow = {
  changedFields: Prisma.JsonValue;
  correlationId: string;
  eventId: string;
  normalizedPayloadHash: string;
  operation: CanonicalEvent["operation"];
  payload: Prisma.JsonValue;
  receivedAt: Date;
  serviceType: CanonicalEvent["serviceType"];
  sourceRequestId: string | null;
  sourceSystem: CanonicalEvent["sourceSystem"];
  status: EventStatus;
  ubid: string;
};

function clone<T>(value: T): T {
  return structuredClone(value);
}

function parseJsonArray<T>(value: Prisma.JsonValue | null): T[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return clone(value as T[]);
}

function parseJsonObject<T>(value: Prisma.JsonValue): T {
  return clone(value as T);
}

function normalizeError(error: unknown) {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      stack: error.stack,
    };
  }

  return {
    message: "Unknown queue processor error.",
  };
}

function toCanonicalEvent(record: CanonicalEventProcessorRow): CanonicalEvent {
  return {
    changedFields: parseJsonArray<CanonicalPayloadField>(record.changedFields),
    correlationId: record.correlationId,
    eventId: record.eventId,
    normalizedPayloadHash: record.normalizedPayloadHash,
    operation: record.operation,
    payload: parseJsonObject<CanonicalPayload>(record.payload),
    receivedAt: record.receivedAt.toISOString(),
    serviceType: record.serviceType,
    sourceRequestId: record.sourceRequestId ?? undefined,
    sourceSystem: record.sourceSystem,
    status: record.status,
    ubid: record.ubid,
  };
}

async function loadCanonicalEventOrThrow(eventId: string) {
  const event = await prisma.canonicalEvent.findUnique({
    where: { eventId },
    select: {
      changedFields: true,
      correlationId: true,
      eventId: true,
      normalizedPayloadHash: true,
      operation: true,
      payload: true,
      receivedAt: true,
      serviceType: true,
      sourceRequestId: true,
      sourceSystem: true,
      status: true,
      ubid: true,
    },
  });

  if (!event) {
    throw new AppError({
      code: ERROR_CODES.NOT_FOUND,
      message: `Canonical event ${eventId} was not found for queue processing.`,
      statusCode: 404,
    });
  }

  return toCanonicalEvent(event);
}

async function resolveTargetOrThrow(
  event: CanonicalEvent,
  targetSystem: SystemName,
): Promise<AdapterTarget> {
  const resolvedTargets = await resolveTargets(
    event.ubid,
    event.sourceSystem,
    event.serviceType,
  );
  const target = resolvedTargets.find(
    (candidate) =>
      candidate.targetSystem === targetSystem &&
      candidate.status === "ROUTABLE" &&
      Boolean(candidate.localIdentifier) &&
      Boolean(candidate.localIdentifierType),
  );

  if (!target?.localIdentifier || !target.localIdentifierType) {
    throw new AppError({
      code: ERROR_CODES.NOT_FOUND,
      message: `No active target mapping found for ${targetSystem} on event ${event.eventId}.`,
      statusCode: 404,
    });
  }

  return {
    ...target,
    localIdentifier: target.localIdentifier,
    localIdentifierType: target.localIdentifierType,
  };
}

function buildAuditEntry(
  event: CanonicalEvent,
  targetSystem: SystemName,
  status: EventStatus,
  message: string,
  input: {
    metadata?: Record<string, unknown>;
    stage: AuditLogInput["stage"];
  },
): AuditLogInput {
  return {
    correlationId: event.correlationId,
    eventId: event.eventId,
    message,
    metadata: input.metadata,
    operation: event.operation,
    recordedAt: new Date().toISOString(),
    serviceType: event.serviceType,
    sourceRequestId: event.sourceRequestId,
    sourceSystem: event.sourceSystem,
    stage: input.stage,
    status,
    targetSystem,
    ubid: event.ubid,
  };
}

async function updateCanonicalEventStatus(
  eventId: string,
  status: EventStatus,
  options?: {
    completed?: boolean;
  },
) {
  await prisma.canonicalEvent.update({
    where: { eventId },
    data: {
      completedAt: options?.completed ? new Date() : undefined,
      status,
    },
  });
}

async function getPostSuccessEventStatus(eventId: string): Promise<EventStatus> {
  const queueJobs = await getQueueRecordsForEvent(eventId);

  if (queueJobs.length === 0) {
    return "WRITE_SUCCEEDED";
  }

  if (
    queueJobs.some(
      (queueJob) =>
        queueJob.status === QueueJobStatus.DLQ_MOVED ||
        queueJob.status === QueueJobStatus.FAILED,
    )
  ) {
    return "FAILED";
  }

  if (
    queueJobs.every((queueJob) => queueJob.status === QueueJobStatus.COMPLETED)
  ) {
    return "COMPLETED";
  }

  return "WRITE_SUCCEEDED";
}

export async function processWriteJob(
  job: Job<QueueJobPayload>,
  adapter: DepartmentAdapter,
): Promise<AdapterWriteResult> {
  const event = await loadCanonicalEventOrThrow(job.data.eventId);

  if (event.status === "SUPERSEDED") {
    const skippedResult: AdapterWriteResult = {
      localIdentifier: "superseded-event",
      metadata: {
        eventId: event.eventId,
        skipped: true,
      },
      targetSystem: job.data.targetSystem,
      updatedFields: [],
    };

    await markQueueJobCompleted(
      job,
      {
        reason: "Event was superseded before queue processing began.",
        skipped: true,
      },
      {
        eventStatus: event.status,
        skipped: true,
      },
    );

    return skippedResult;
  }

  const target = await resolveTargetOrThrow(event, job.data.targetSystem);
  const adapterForTarget = getAdapterForTargetSystem(target.targetSystem);

  if (!adapterForTarget || adapterForTarget.targetSystem !== adapter.targetSystem) {
    throw new AppError({
      code: ERROR_CODES.BAD_REQUEST,
      details: {
        requestedTargetSystem: target.targetSystem,
      },
      message: `No adapter is registered for target system ${target.targetSystem}.`,
      statusCode: 400,
    });
  }

  await markQueueJobProcessing(job, {
    attempt: job.attemptsMade + 1,
    localIdentifier: target.localIdentifier,
    localIdentifierType: target.localIdentifierType,
  });

  try {
    await adapter.validateTarget(event, target);

    const translation = await adapter.translate(event, target);

    await updateCanonicalEventStatus(event.eventId, "TRANSLATED");
    await writeAuditLog(
      buildAuditEntry(
        event,
        target.targetSystem,
        "TRANSLATED",
        `Translated event for ${target.targetSystem}.`,
        {
          metadata: {
            localIdentifier: target.localIdentifier,
            localIdentifierType: target.localIdentifierType,
            mappingId: translation.mappingId,
            version: translation.version,
          },
          stage: "NORMALIZATION",
        },
      ),
    );

    await updateCanonicalEventStatus(event.eventId, "WRITE_ATTEMPTED");
    await writeAuditLog(
      buildAuditEntry(
        event,
        target.targetSystem,
        "WRITE_ATTEMPTED",
        `Attempting write to ${target.targetSystem}.`,
        {
          metadata: {
            localIdentifier: target.localIdentifier,
            localIdentifierType: target.localIdentifierType,
            mappingId: translation.mappingId,
            version: translation.version,
          },
          stage: "DELIVERY",
        },
      ),
    );

    const writeResult = await adapter.write(
      translation.translatedPayload,
      target,
      event,
    );
    const confirmedResult = await adapter.confirm(writeResult);

    await markQueueJobCompleted(
      job,
      {
        mappingId: translation.mappingId,
        translatedPayload: translation.translatedPayload,
        version: translation.version,
        writeResult: confirmedResult,
      },
      {
        localIdentifier: target.localIdentifier,
        localIdentifierType: target.localIdentifierType,
        mappingId: translation.mappingId,
        updatedFields: confirmedResult.updatedFields,
        version: translation.version,
      },
    );

    const postSuccessStatus = await getPostSuccessEventStatus(event.eventId);
    const nextEventStatus =
      postSuccessStatus === "COMPLETED" ? "COMPLETED" : "WRITE_SUCCEEDED";

    await updateCanonicalEventStatus(event.eventId, nextEventStatus, {
      completed: nextEventStatus === "COMPLETED",
    });
    await writeAuditLog(
      buildAuditEntry(
        event,
        target.targetSystem,
        nextEventStatus,
        `Write to ${target.targetSystem} succeeded.`,
        {
          metadata: {
            localIdentifier: target.localIdentifier,
            localIdentifierType: target.localIdentifierType,
            mappingId: translation.mappingId,
            updatedFields: confirmedResult.updatedFields,
            version: translation.version,
          },
          stage: "DELIVERY",
        },
      ),
    );

    return confirmedResult;
  } catch (error) {
    const failedAttempt = job.attemptsMade + 1;
    const maxAttempts =
      typeof job.opts.attempts === "number" ? job.opts.attempts : 1;
    const isFinalFailure = failedAttempt >= maxAttempts;
    const normalizedError = normalizeError(error);

    await updateCanonicalEventStatus(
      event.eventId,
      isFinalFailure ? "DLQ_MOVED" : "RETRY_SCHEDULED",
    );
    await writeAuditLog(
      buildAuditEntry(
        event,
        target.targetSystem,
        "WRITE_FAILED",
        `Write to ${target.targetSystem} failed.`,
        {
          metadata: {
            attempt: failedAttempt,
            error: normalizedError,
            localIdentifier: target.localIdentifier,
            localIdentifierType: target.localIdentifierType,
          },
          stage: "DELIVERY",
        },
      ),
    );

    if (isFinalFailure) {
      await moveQueueJobToDeadLetter(job, error, {
        attempt: failedAttempt,
        localIdentifier: target.localIdentifier,
        localIdentifierType: target.localIdentifierType,
      });
      await writeAuditLog(
        buildAuditEntry(
          event,
          target.targetSystem,
          "DLQ_MOVED",
          `Moved ${target.targetSystem} write job to the dead-letter queue.`,
          {
            metadata: {
              attempt: failedAttempt,
              error: normalizedError,
              localIdentifier: target.localIdentifier,
              localIdentifierType: target.localIdentifierType,
            },
            stage: "DELIVERY",
          },
        ),
      );
    } else {
      const retryDelayMs = getRetryDelayForAttempt(failedAttempt);

      await markQueueJobRetryScheduled(job, error, retryDelayMs, {
        attempt: failedAttempt,
        localIdentifier: target.localIdentifier,
        localIdentifierType: target.localIdentifierType,
        retryDelayMs,
      });
      await writeAuditLog(
        buildAuditEntry(
          event,
          target.targetSystem,
          "RETRY_SCHEDULED",
          `Scheduled retry for ${target.targetSystem} write job.`,
          {
            metadata: {
              attempt: failedAttempt,
              error: normalizedError,
              localIdentifier: target.localIdentifier,
              localIdentifierType: target.localIdentifierType,
              retryDelayMs,
            },
            stage: "DELIVERY",
          },
        ),
      );
    }

    throw error;
  }
}
