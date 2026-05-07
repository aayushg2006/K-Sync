import { Prisma } from "@prisma/client";

import { AppError } from "../../common/errors/AppError";
import { ERROR_CODES } from "../../common/errors/errorCodes";
import { AuditLogInput } from "../../common/types/audit.types";
import { CanonicalEvent, CanonicalPayloadField } from "../../common/types/event.types";
import { EventStatus } from "../../common/types/system.types";
import { MODULE_STATUS } from "../../config/constants";
import prisma from "../../config/prisma";
import { writeAuditLog } from "../audit/audit.service";
import { detectAndResolve } from "../conflicts/conflict.service";
import {
  checkAndStore,
  saveResponse,
} from "../idempotency/idempotency.service";
import {
  addDepartmentWriteJob,
  addSwsWriteJob,
} from "../queues/queue.service";
import { getRoutingOutcome } from "../routing/routing.service";
import { createCanonicalEvent } from "./canonical-event.factory";

interface KsyncIngestInput {
  changedFields: CanonicalEvent["changedFields"];
  correlationId?: string;
  operation: CanonicalEvent["operation"];
  payload: CanonicalEvent["payload"];
  serviceType: CanonicalEvent["serviceType"];
  sourceRequestId?: string;
  sourceSystem: CanonicalEvent["sourceSystem"];
  ubid: string;
}

export interface RoutedTargetSummary {
  localIdentifier: string;
  targetSystem: CanonicalEvent["sourceSystem"];
}

export interface KsyncIngestResult {
  correlationId: string;
  duplicate: boolean;
  eventId: string;
  normalizedPayloadHash: string;
  status: CanonicalEvent["status"];
  targets: RoutedTargetSummary[];
}

type CanonicalEventRow = {
  changedFields: Prisma.JsonValue;
  correlationId: string;
  eventId: string;
  normalizedPayloadHash: string;
  operation: CanonicalEvent["operation"];
  payload: Prisma.JsonValue;
  receivedAt: Date;
  routeTargets: Prisma.JsonValue | null;
  serviceType: CanonicalEvent["serviceType"];
  sourceRequestId: string | null;
  sourceSystem: CanonicalEvent["sourceSystem"];
  status: EventStatus;
  ubid: string;
};

function clone<T>(value: T): T {
  return structuredClone(value);
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
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

function toCanonicalEvent(record: CanonicalEventRow): CanonicalEvent {
  return {
    changedFields: parseJsonArray<CanonicalPayloadField>(record.changedFields),
    correlationId: record.correlationId,
    eventId: record.eventId,
    normalizedPayloadHash: record.normalizedPayloadHash,
    operation: record.operation,
    payload: parseJsonObject<CanonicalEvent["payload"]>(record.payload),
    receivedAt: record.receivedAt.toISOString(),
    serviceType: record.serviceType,
    sourceRequestId: record.sourceRequestId ?? undefined,
    sourceSystem: record.sourceSystem,
    status: record.status,
    ubid: record.ubid,
  };
}

function parseTargetSummaries(value: Prisma.JsonValue | null): RoutedTargetSummary[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return clone(value as unknown as RoutedTargetSummary[]);
}

function buildAuditEntry(
  event: CanonicalEvent,
  overrides: Partial<AuditLogInput>,
): AuditLogInput {
  return {
    correlationId: event.correlationId,
    eventId: event.eventId,
    message: "K-Sync event processed.",
    operation: event.operation,
    recordedAt: new Date().toISOString(),
    serviceType: event.serviceType,
    sourceRequestId: event.sourceRequestId,
    sourceSystem: event.sourceSystem,
    stage: "INGESTION",
    status: event.status,
    ubid: event.ubid,
    ...overrides,
  };
}

function buildResult(
  event: Pick<
    CanonicalEvent,
    "correlationId" | "eventId" | "normalizedPayloadHash" | "status"
  >,
  targets: RoutedTargetSummary[],
  duplicate: boolean,
): KsyncIngestResult {
  return {
    correlationId: event.correlationId,
    duplicate,
    eventId: event.eventId,
    normalizedPayloadHash: event.normalizedPayloadHash,
    status: event.status,
    targets: clone(targets),
  };
}

async function createCanonicalEventRecord(event: CanonicalEvent) {
  return prisma.canonicalEvent.create({
    data: {
      changedFields: toJsonValue(event.changedFields),
      correlationId: event.correlationId,
      eventId: event.eventId,
      normalizedPayloadHash: event.normalizedPayloadHash,
      operation: event.operation,
      payload: toJsonValue(event.payload),
      receivedAt: new Date(event.receivedAt),
      serviceType: event.serviceType,
      sourceRequestId: event.sourceRequestId ?? null,
      sourceSystem: event.sourceSystem,
      status: event.status,
      ubid: event.ubid,
    },
    select: {
      changedFields: true,
      correlationId: true,
      eventId: true,
      normalizedPayloadHash: true,
      operation: true,
      payload: true,
      receivedAt: true,
      routeTargets: true,
      serviceType: true,
      sourceRequestId: true,
      sourceSystem: true,
      status: true,
      ubid: true,
    },
  });
}

async function updateCanonicalEvent(
  eventId: string,
  input: {
    metadata?: Record<string, unknown>;
    routeTargets?: RoutedTargetSummary[];
    status: EventStatus;
  },
) {
  const existingRecord = await prisma.canonicalEvent.findUnique({
    where: { eventId },
    select: {
      metadata: true,
    },
  });
  const existingMetadata =
    existingRecord?.metadata &&
    typeof existingRecord.metadata === "object" &&
    !Array.isArray(existingRecord.metadata)
      ? clone(existingRecord.metadata as Record<string, unknown>)
      : {};

  await prisma.canonicalEvent.update({
    where: { eventId },
    data: {
      metadata: input.metadata
        ? toJsonValue({
            ...existingMetadata,
            ...input.metadata,
          })
        : undefined,
      routeTargets:
        input.routeTargets !== undefined
          ? toJsonValue(input.routeTargets)
          : undefined,
      status: input.status,
    },
  });
}

async function buildDuplicateResult(
  event: CanonicalEvent,
  duplicateEventId?: string,
  cachedResult?: KsyncIngestResult,
): Promise<KsyncIngestResult> {
  if (cachedResult) {
    return {
      ...clone(cachedResult),
      duplicate: true,
    };
  }

  if (!duplicateEventId) {
    return buildResult(
      {
        correlationId: event.correlationId,
        eventId: event.eventId,
        normalizedPayloadHash: event.normalizedPayloadHash,
        status: "DUPLICATE_DETECTED",
      },
      [],
      true,
    );
  }

  const existingEvent = await prisma.canonicalEvent.findUnique({
    where: { eventId: duplicateEventId },
    select: {
      correlationId: true,
      eventId: true,
      normalizedPayloadHash: true,
      routeTargets: true,
      status: true,
    },
  });

  if (!existingEvent) {
    return buildResult(
      {
        correlationId: event.correlationId,
        eventId: duplicateEventId,
        normalizedPayloadHash: event.normalizedPayloadHash,
        status: "DUPLICATE_DETECTED",
      },
      [],
      true,
    );
  }

  return buildResult(
    {
      correlationId: existingEvent.correlationId,
      eventId: existingEvent.eventId,
      normalizedPayloadHash: existingEvent.normalizedPayloadHash,
      status: existingEvent.status,
    },
    parseTargetSummaries(existingEvent.routeTargets),
    true,
  );
}

async function enqueueTargetWriteJobs(
  event: CanonicalEvent,
  targets: Awaited<ReturnType<typeof getRoutingOutcome>>["targets"],
) {
  const queueMetadata: Array<{
    jobId: string;
    localIdentifier: string;
    localIdentifierType: string;
    targetSystem: CanonicalEvent["sourceSystem"];
  }> = [];

  for (const target of targets) {
    if (!target.localIdentifier || !target.localIdentifierType) {
      continue;
    }

    const job =
      target.targetSystem === "SWS"
        ? await addSwsWriteJob(event.eventId)
        : await addDepartmentWriteJob(event.eventId, target.targetSystem);

    queueMetadata.push({
      jobId: String(job.id),
      localIdentifier: target.localIdentifier,
      localIdentifierType: target.localIdentifierType,
      targetSystem: target.targetSystem,
    });

    await writeAuditLog(
      buildAuditEntry(event, {
        message: `Write job queued for ${target.targetSystem}.`,
        metadata: {
          jobId: String(job.id),
          localIdentifier: target.localIdentifier,
          localIdentifierType: target.localIdentifierType,
        },
        stage: "DELIVERY",
        status: "QUEUED",
        targetSystem: target.targetSystem,
      }),
    );
  }

  return queueMetadata;
}

export async function getKsyncStatus() {
  const totalEvents = await prisma.canonicalEvent.count();

  return {
    message: "K-Sync core module is running with Prisma-backed storage.",
    module: "ksync",
    totalEvents,
    status: MODULE_STATUS,
  };
}

export async function ingestRequest(
  input: KsyncIngestInput,
): Promise<KsyncIngestResult> {
  const event = createCanonicalEvent(input);
  await createCanonicalEventRecord(event);

  await writeAuditLog(
    buildAuditEntry(event, {
      message: "Canonical event ingested into K-Sync.",
      recordedAt: event.receivedAt,
      stage: "INGESTION",
      status: "RECEIVED",
    }),
  );

  const idempotency = await checkAndStore<KsyncIngestResult>(event);

  if (idempotency.duplicate) {
    await updateCanonicalEvent(event.eventId, {
      metadata: {
        duplicateOfEventId: idempotency.existingEventId,
        idempotencyKeys: idempotency.keys,
      },
      status: "DUPLICATE_DETECTED",
    });

    await writeAuditLog(
      buildAuditEntry(event, {
        message: "Duplicate event detected by idempotency checks.",
        metadata: {
          duplicateOfEventId: idempotency.existingEventId,
          idempotencyKeys: idempotency.keys,
        },
        recordedAt: new Date().toISOString(),
        stage: "VALIDATION",
        status: "DUPLICATE_DETECTED",
      }),
    );

    return buildDuplicateResult(
      event,
      idempotency.existingEventId,
      idempotency.cachedResult,
    );
  }

  event.status = "IDEMPOTENCY_ACCEPTED";

  await updateCanonicalEvent(event.eventId, {
    metadata: {
      idempotencyKeys: idempotency.keys,
    },
    status: "IDEMPOTENCY_ACCEPTED",
  });

  await writeAuditLog(
    buildAuditEntry(event, {
      message: "Idempotency checks accepted the canonical event.",
      metadata: {
        idempotencyKeys: idempotency.keys,
      },
      stage: "VALIDATION",
      status: "IDEMPOTENCY_ACCEPTED",
    }),
  );

  const conflictOutcome = await detectAndResolve(event);
  event.status = conflictOutcome.status;

  if (conflictOutcome.status === "CONFLICT_CHECKED") {
    await updateCanonicalEvent(event.eventId, {
      metadata: {
        conflictIds: conflictOutcome.conflictIds,
      },
      status: "CONFLICT_CHECKED",
    });
    await writeAuditLog(
      buildAuditEntry(event, {
        message: "No field-level conflicts were detected within the holding pen window.",
        metadata: {
          conflictIds: conflictOutcome.conflictIds,
        },
        stage: "CONFLICT_REVIEW",
        status: "CONFLICT_CHECKED",
      }),
    );
  }

  if (!conflictOutcome.shouldContinue) {
    const result = buildResult(event, [], false);

    await Promise.all(
      [idempotency.keys.primary, idempotency.keys.fallback]
        .filter((key): key is string => Boolean(key))
        .map((key) => saveResponse(key, result)),
    );

    return result;
  }

  const routingOutcome = await getRoutingOutcome(event);
  const routedTargets = routingOutcome.targets.map((target) => ({
    localIdentifier: target.localIdentifier!,
    targetSystem: target.targetSystem,
  }));

  if (routedTargets.length === 0) {
    await writeAuditLog(
      buildAuditEntry(event, {
        message: "No valid target systems were resolved for routing.",
        metadata: {
          resolutions: routingOutcome.resolutions,
        },
        stage: "ROUTING",
        status: routingOutcome.status,
      }),
    );
  } else {
    for (const target of routingOutcome.targets) {
      if (!target.localIdentifier || !target.localIdentifierType) {
        continue;
      }

      await writeAuditLog(
        buildAuditEntry(event, {
          message: `Event routed to ${target.targetSystem}.`,
          metadata: {
            localIdentifier: target.localIdentifier,
            localIdentifierType: target.localIdentifierType,
            resolutionStatus: target.status,
          },
          stage: "ROUTING",
          status: "ROUTED",
          targetSystem: target.targetSystem,
        }),
      );
    }
  }

  const queueMetadata =
    routingOutcome.targets.length > 0
      ? await enqueueTargetWriteJobs(event, routingOutcome.targets)
      : [];

  event.status = queueMetadata.length > 0 ? "QUEUED" : routingOutcome.status;

  await updateCanonicalEvent(event.eventId, {
    metadata: {
      queuedTargets: queueMetadata,
      routingResolutions: routingOutcome.resolutions,
    },
    routeTargets: routedTargets,
    status: event.status,
  });

  const result = buildResult(event, routedTargets, false);

  await Promise.all(
    [idempotency.keys.primary, idempotency.keys.fallback]
      .filter((key): key is string => Boolean(key))
      .map((key) => saveResponse(key, result)),
  );

  return result;
}

export async function ingestInternal(
  input: KsyncIngestInput,
): Promise<KsyncIngestResult> {
  return ingestRequest(input);
}

export async function listEvents(): Promise<CanonicalEvent[]> {
  const events = await prisma.canonicalEvent.findMany({
    orderBy: [{ receivedAt: "desc" }, { createdAt: "desc" }],
    select: {
      changedFields: true,
      correlationId: true,
      eventId: true,
      normalizedPayloadHash: true,
      operation: true,
      payload: true,
      receivedAt: true,
      routeTargets: true,
      serviceType: true,
      sourceRequestId: true,
      sourceSystem: true,
      status: true,
      ubid: true,
    },
  });

  return events.map((event) => toCanonicalEvent(event));
}

export async function getEventById(eventId: string): Promise<CanonicalEvent> {
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
      routeTargets: true,
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
      message: `Canonical event ${eventId} was not found.`,
      statusCode: 404,
    });
  }

  return toCanonicalEvent(event);
}
