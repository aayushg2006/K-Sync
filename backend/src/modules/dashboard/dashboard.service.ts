import {
  AuditStage,
  ConflictResolutionStatus,
  EventStatus,
  MappingStatus,
  Prisma,
  QueueJobStatus,
  ReviewStatus,
  ServiceType,
  SystemName,
} from "@prisma/client";

import { AppError } from "../../common/errors/AppError";
import { ERROR_CODES } from "../../common/errors/errorCodes";
import { MODULE_STATUS } from "../../config/constants";
import prisma from "../../config/prisma";
import { redisConnection } from "../../config/redis";
import { getQueueStats } from "../queues/queue.service";
import { getMappingsByUbid } from "../ubid-registry/ubid.service";

type PaginationQuery = {
  limit?: number | string;
  page?: number | string;
};

type DashboardEventsQuery = PaginationQuery & {
  sourceSystem?: SystemName;
  serviceType?: ServiceType;
  status?: EventStatus;
  ubid?: string;
};

type DashboardAuditQuery = PaginationQuery & {
  correlationId?: string;
  eventId?: string;
  sourceSystem?: SystemName;
  stage?: AuditStage;
  targetSystem?: SystemName;
  ubid?: string;
};

type DashboardConflictsQuery = PaginationQuery & {
  resolutionStatus?: ConflictResolutionStatus;
  ubid?: string;
};

type CanonicalEventRow = {
  changedFields: Prisma.JsonValue;
  completedAt: Date | null;
  correlationId: string;
  createdAt: Date;
  eventId: string;
  metadata: Prisma.JsonValue | null;
  normalizedPayloadHash: string;
  operation: Prisma.JsonValue;
  payload: Prisma.JsonValue;
  receivedAt: Date;
  routeTargets: Prisma.JsonValue | null;
  serviceType: ServiceType;
  sourceRequestId: string | null;
  sourceSystem: SystemName;
  status: EventStatus;
  targetSystem: SystemName | null;
  ubid: string;
  updatedAt: Date;
};

type AuditRow = {
  auditId: string;
  correlationId: string;
  createdAt: Date;
  eventId: string;
  message: string;
  metadata: Prisma.JsonValue | null;
  operation: Prisma.JsonValue;
  recordedAt: Date;
  serviceType: ServiceType;
  sourceRequestId: string | null;
  sourceSystem: SystemName;
  stage: AuditStage;
  status: EventStatus;
  targetSystem: SystemName | null;
  ubid: string;
};

type ConflictRow = {
  authorityDecision: Prisma.JsonValue | null;
  conflictingFields: Prisma.JsonValue;
  conflictId: string;
  correlationId: string;
  detectedAt: Date;
  eventId: string;
  metadata: Prisma.JsonValue | null;
  notes: string | null;
  resolutionStatus: ConflictResolutionStatus;
  reviewStatus: ReviewStatus | null;
  reviewedAt: Date | null;
  reviewedBy: string | null;
  serviceType: ServiceType;
  sourcePayload: Prisma.JsonValue;
  sourceSystem: SystemName;
  targetPayload: Prisma.JsonValue;
  targetSystem: SystemName;
  ubid: string;
};

type ManualReviewRow = {
  assignedTo: string | null;
  closedAt: Date | null;
  conflictId: string | null;
  correlationId: string | null;
  createdAt: Date;
  eventId: string | null;
  jobId: string | null;
  openedAt: Date;
  payload: Prisma.JsonValue | null;
  resolutionPayload: Prisma.JsonValue | null;
  reviewId: string;
  reviewerNotes: string | null;
  reviewStatus: ReviewStatus;
  reviewType: string;
  reviewedAt: Date | null;
  sourceSystem: SystemName | null;
  summary: string | null;
  targetSystem: SystemName | null;
  title: string;
  ubid: string | null;
  updatedAt: Date;
};

type AuthorityMatrixRow = {
  authoritativeSystem: SystemName;
  fallbackSystem: SystemName | null;
  fieldPath: string;
  manualReviewRequired: boolean;
  notes: string | null;
  ruleConfig: Prisma.JsonValue | null;
  serviceType: ServiceType | null;
  status: MappingStatus;
  targetSystem: SystemName | null;
  version: number;
};

const SUCCESS_EVENT_STATUSES: EventStatus[] = [
  "COMPLETED",
  "WRITE_SUCCEEDED",
  "PROPAGATED_CHANGE_CONFIRMED",
];

function clone<T>(value: T): T {
  return structuredClone(value);
}

function normalizePagination(query: PaginationQuery) {
  const limit =
    typeof query.limit === "number"
      ? query.limit
      : Number.parseInt(String(query.limit ?? 20), 10);
  const page =
    typeof query.page === "number"
      ? query.page
      : Number.parseInt(String(query.page ?? 1), 10);

  return {
    limit,
    page,
    skip: (page - 1) * limit,
  };
}

function parseJsonArray<T>(value: Prisma.JsonValue | null): T[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return clone(value as T[]);
}

function parseJsonObject<T>(value: Prisma.JsonValue | null): T | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  return clone(value as T);
}

function toDashboardEvent(record: CanonicalEventRow) {
  return {
    changedFields: parseJsonArray<string>(record.changedFields),
    completedAt: record.completedAt?.toISOString(),
    correlationId: record.correlationId,
    createdAt: record.createdAt.toISOString(),
    eventId: record.eventId,
    metadata: parseJsonObject<Record<string, unknown>>(record.metadata),
    normalizedPayloadHash: record.normalizedPayloadHash,
    operation: record.operation,
    payload: clone(record.payload as Record<string, unknown>),
    receivedAt: record.receivedAt.toISOString(),
    routeTargets: parseJsonArray<Record<string, unknown>>(record.routeTargets),
    serviceType: record.serviceType,
    sourceRequestId: record.sourceRequestId ?? undefined,
    sourceSystem: record.sourceSystem,
    status: record.status,
    targetSystem: record.targetSystem ?? undefined,
    ubid: record.ubid,
    updatedAt: record.updatedAt.toISOString(),
  };
}

function toDashboardAudit(record: AuditRow) {
  return {
    auditId: record.auditId,
    correlationId: record.correlationId,
    createdAt: record.createdAt.toISOString(),
    eventId: record.eventId,
    message: record.message,
    metadata: parseJsonObject<Record<string, unknown>>(record.metadata),
    operation: record.operation,
    recordedAt: record.recordedAt.toISOString(),
    serviceType: record.serviceType,
    sourceRequestId: record.sourceRequestId ?? undefined,
    sourceSystem: record.sourceSystem,
    stage: record.stage,
    status: record.status,
    targetSystem: record.targetSystem ?? undefined,
    ubid: record.ubid,
  };
}

function deriveConflictOutcome(
  sourceSystem: SystemName,
  targetSystem: SystemName,
  resolutionStatus: ConflictResolutionStatus,
  reviewStatus?: ReviewStatus,
) {
  if (reviewStatus === "REJECTED") {
    return "REJECTED";
  }

  if (resolutionStatus === "MANUAL_REVIEW_REQUIRED") {
    return "PENDING_REVIEW";
  }

  if (resolutionStatus === "SUPERSEDED") {
    return "TARGET_ACCEPTED";
  }

  if (resolutionStatus === "AUTO_RESOLVED") {
    return sourceSystem === targetSystem ? "MERGED" : "SOURCE_ACCEPTED";
  }

  return "PENDING_REVIEW";
}

function toDashboardConflict(record: ConflictRow) {
  return {
    authorityDecision: parseJsonObject<Record<string, unknown>>(record.authorityDecision),
    conflictingFields: parseJsonArray<string>(record.conflictingFields),
    conflictId: record.conflictId,
    correlationId: record.correlationId,
    detectedAt: record.detectedAt.toISOString(),
    eventId: record.eventId,
    explanation:
      parseJsonArray<{ reason?: string }>(
        parseJsonObject<{ fieldDecisions?: Array<{ reason?: string }> }>(record.authorityDecision)
          ?.fieldDecisions as unknown as Prisma.JsonValue,
      )
        .map((decision) => decision.reason)
        .find((reason): reason is string => Boolean(reason)) ?? record.notes ?? undefined,
    metadata: parseJsonObject<Record<string, unknown>>(record.metadata),
    notes: record.notes ?? undefined,
    outcome: deriveConflictOutcome(
      record.sourceSystem,
      record.targetSystem,
      record.resolutionStatus,
      record.reviewStatus ?? undefined,
    ),
    resolutionStatus: record.resolutionStatus,
    reviewStatus: record.reviewStatus ?? undefined,
    reviewedAt: record.reviewedAt?.toISOString(),
    reviewedBy: record.reviewedBy ?? undefined,
    serviceType: record.serviceType,
    sourcePayload: clone(record.sourcePayload as Record<string, unknown>),
    sourceSystem: record.sourceSystem,
    targetPayload: clone(record.targetPayload as Record<string, unknown>),
    targetSystem: record.targetSystem,
    ubid: record.ubid,
  };
}

function toManualReviewItem(record: ManualReviewRow) {
  return {
    assignedTo: record.assignedTo ?? undefined,
    closedAt: record.closedAt?.toISOString(),
    conflictId: record.conflictId ?? undefined,
    correlationId: record.correlationId ?? undefined,
    createdAt: record.createdAt.toISOString(),
    eventId: record.eventId ?? undefined,
    jobId: record.jobId ?? undefined,
    openedAt: record.openedAt.toISOString(),
    payload: parseJsonObject<Record<string, unknown>>(record.payload),
    resolutionPayload: parseJsonObject<Record<string, unknown>>(record.resolutionPayload),
    reviewId: record.reviewId,
    reviewerNotes: record.reviewerNotes ?? undefined,
    reviewStatus: record.reviewStatus,
    reviewType: record.reviewType,
    reviewedAt: record.reviewedAt?.toISOString(),
    sourceSystem: record.sourceSystem ?? undefined,
    summary: record.summary ?? undefined,
    targetSystem: record.targetSystem ?? undefined,
    title: record.title,
    ubid: record.ubid ?? undefined,
    updatedAt: record.updatedAt.toISOString(),
  };
}

function toAuthorityRule(record: AuthorityMatrixRow) {
  return {
    authoritativeSystem: record.authoritativeSystem,
    fallbackSystem: record.fallbackSystem ?? undefined,
    fieldPath: record.fieldPath,
    manualReviewRequired: record.manualReviewRequired,
    notes: record.notes ?? undefined,
    ruleConfig: parseJsonObject<Record<string, unknown>>(record.ruleConfig),
    serviceType: record.serviceType ?? undefined,
    status: record.status,
    targetSystem: record.targetSystem ?? undefined,
    version: record.version,
  };
}

export async function getDashboardStatus() {
  const [totalEvents, authorityRuleCount] = await Promise.all([
    prisma.canonicalEvent.count(),
    prisma.authorityMatrix.count({
      where: {
        status: MappingStatus.ACTIVE,
      },
    }),
  ]);

  return {
    authorityRuleCount,
    message: "Dashboard module is running with live Prisma-backed queries.",
    module: "dashboard",
    routes: [
      "/api/dashboard/metrics",
      "/api/dashboard/system-health",
      "/api/dashboard/business-comparison/:ubid",
      "/api/dashboard/events",
      "/api/dashboard/audit",
      "/api/dashboard/conflicts",
      "/api/dashboard/queue-status",
      "/api/dashboard/authority-matrix",
    ],
    status: MODULE_STATUS,
    totalEvents,
  };
}

export async function getDashboardMetrics() {
  const [
    totalEvents,
    successfulSyncs,
    failedWrites,
    conflictsDetected,
    duplicateRequestsBlocked,
    duplicateAuditFallback,
    pendingManualReviews,
    dlqJobs,
    queueJobs,
  ] = await Promise.all([
    prisma.canonicalEvent.count(),
    prisma.canonicalEvent.count({
      where: {
        status: {
          in: SUCCESS_EVENT_STATUSES,
        },
      },
    }),
    prisma.auditLog.count({
      where: {
        status: "WRITE_FAILED",
      },
    }),
    prisma.conflict.count(),
    prisma.idempotencyKey.count({
      where: {
        status: "DUPLICATE_DETECTED",
      },
    }),
    prisma.auditLog.count({
      where: {
        status: "DUPLICATE_DETECTED",
      },
    }),
    prisma.manualReviewItem.count({
      where: {
        reviewStatus: {
          in: ["OPEN", "IN_REVIEW"],
        },
      },
    }),
    prisma.deadLetterJob.count(),
    prisma.queueJob.count(),
  ]);

  return {
    conflictsDetected,
    dlqJobs,
    duplicateRequestsBlocked:
      duplicateRequestsBlocked > 0 ? duplicateRequestsBlocked : duplicateAuditFallback,
    failedWrites,
    pendingManualReviews,
    queueJobs,
    successfulSyncs,
    totalEvents,
  };
}

async function getDatabaseHealth() {
  try {
    await prisma.$queryRaw`SELECT 1`;

    return {
      status: "online" as const,
    };
  } catch (error) {
    return {
      message: (error as Error).message,
      status: "degraded" as const,
    };
  }
}

async function getRedisHealth() {
  try {
    const result = await redisConnection.ping();

    return {
      status: result === "PONG" ? ("online" as const) : ("degraded" as const),
    };
  } catch (error) {
    return {
      message: (error as Error).message,
      status: "degraded" as const,
    };
  }
}

async function getQueueHealth() {
  try {
    await getQueueStats();

    return {
      status: "active" as const,
    };
  } catch (error) {
    return {
      message: (error as Error).message,
      status: "degraded" as const,
    };
  }
}

export async function getDashboardSystemHealth() {
  const [database, redis, queue] = await Promise.all([
    getDatabaseHealth(),
    getRedisHealth(),
    getQueueHealth(),
  ]);

  return {
    database,
    mockEkarmika: {
      status: "online" as const,
    },
    mockEsurakshate: {
      status: "online" as const,
    },
    mockSws: {
      status: "online" as const,
    },
    queue,
    redis,
  };
}

export async function getBusinessComparison(ubid: string) {
  const [swsRecord, ekarmikaRecord, esurakshateRecord, registryMappings] = await Promise.all([
    prisma.mockSwsRecord.findUnique({
      where: { ubid },
      select: {
        authorizedSignatory: true,
        businessName: true,
        employeeCount: true,
        factoryLicenseNo: true,
        labourRegNo: true,
        lastModifiedAt: true,
        licenseExpiry: true,
        powerCapacityHP: true,
        rawPayload: true,
        registeredAddress: true,
        sourceRequestId: true,
        ubid: true,
        workerLimit: true,
      },
    }),
    prisma.mockEkarmikaRecord.findFirst({
      where: { ubid },
      select: {
        addressFull: true,
        businessName: true,
        employeeCount: true,
        labourRegNo: true,
        lastModifiedAt: true,
        managerName: true,
        powerCapacityHP: true,
        rawPayload: true,
        ubid: true,
        workerLimit: true,
      },
    }),
    prisma.mockEsurakshateRecord.findFirst({
      where: { ubid },
      select: {
        businessName: true,
        employeeCount: true,
        factoryAddress: true,
        factoryLicenseNo: true,
        lastModifiedAt: true,
        managerName: true,
        powerCapacityHP: true,
        rawPayload: true,
        snapshotXml: true,
        ubid: true,
        workerLimit: true,
      },
    }),
    getMappingsByUbid(ubid),
  ]);

  if (!swsRecord && registryMappings.length === 0 && !ekarmikaRecord && !esurakshateRecord) {
    throw new AppError({
      code: ERROR_CODES.NOT_FOUND,
      message: `No business comparison data was found for ${ubid}.`,
      statusCode: 404,
    });
  }

  const missingSystems: Array<"EKARMIKA" | "ESURAKSHATE" | "SWS"> = [];

  if (!swsRecord) {
    missingSystems.push("SWS");
  }

  if (!ekarmikaRecord) {
    missingSystems.push("EKARMIKA");
  }

  if (!esurakshateRecord) {
    missingSystems.push("ESURAKSHATE");
  }

  return {
    ekarmika: ekarmikaRecord
      ? {
          addressFull: ekarmikaRecord.addressFull ?? undefined,
          businessName: ekarmikaRecord.businessName,
          employeeCount: ekarmikaRecord.employeeCount ?? undefined,
          labourRegNo: ekarmikaRecord.labourRegNo,
          lastModifiedAt: ekarmikaRecord.lastModifiedAt.toISOString(),
          managerName: ekarmikaRecord.managerName ?? undefined,
          powerCapacityHP: ekarmikaRecord.powerCapacityHP ?? undefined,
          rawPayload: parseJsonObject<Record<string, unknown>>(ekarmikaRecord.rawPayload),
          sourceSystem: "EKARMIKA",
          ubid: ekarmikaRecord.ubid,
          workerLimit: ekarmikaRecord.workerLimit ?? undefined,
        }
      : null,
    esurakshate: esurakshateRecord
      ? {
          businessName: esurakshateRecord.businessName,
          employeeCount: esurakshateRecord.employeeCount ?? undefined,
          factoryAddress: esurakshateRecord.factoryAddress ?? undefined,
          factoryLicenseNo: esurakshateRecord.factoryLicenseNo,
          lastModifiedAt: esurakshateRecord.lastModifiedAt.toISOString(),
          managerName: esurakshateRecord.managerName ?? undefined,
          powerCapacityHP: esurakshateRecord.powerCapacityHP ?? undefined,
          rawPayload: parseJsonObject<Record<string, unknown>>(esurakshateRecord.rawPayload),
          snapshotXml: esurakshateRecord.snapshotXml ?? undefined,
          sourceSystem: "ESURAKSHATE",
          ubid: esurakshateRecord.ubid,
          workerLimit: esurakshateRecord.workerLimit ?? undefined,
        }
      : null,
    missingSystems,
    registryMappings,
    sws: swsRecord
      ? {
          authorizedSignatory: parseJsonObject<Record<string, unknown>>(swsRecord.authorizedSignatory),
          businessName: swsRecord.businessName,
          employeeCount: swsRecord.employeeCount ?? undefined,
          factoryLicenseNo: swsRecord.factoryLicenseNo ?? undefined,
          labourRegNo: swsRecord.labourRegNo ?? undefined,
          lastModifiedAt: swsRecord.lastModifiedAt.toISOString(),
          licenseExpiry: swsRecord.licenseExpiry ?? undefined,
          powerCapacityHP: swsRecord.powerCapacityHP ?? undefined,
          rawPayload: parseJsonObject<Record<string, unknown>>(swsRecord.rawPayload),
          registeredAddress: parseJsonObject<Record<string, unknown>>(swsRecord.registeredAddress),
          sourceRequestId: swsRecord.sourceRequestId ?? undefined,
          sourceSystem: "SWS",
          ubid: swsRecord.ubid,
          workerLimit: swsRecord.workerLimit ?? undefined,
        }
      : null,
    ubid,
  };
}

export async function getDashboardEvents(query: DashboardEventsQuery) {
  const { limit, page, skip } = normalizePagination(query);
  const where: Prisma.CanonicalEventWhereInput = {
    ...(query.sourceSystem ? { sourceSystem: query.sourceSystem } : {}),
    ...(query.serviceType ? { serviceType: query.serviceType } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.ubid ? { ubid: query.ubid } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.canonicalEvent.findMany({
      where,
      orderBy: [{ receivedAt: "desc" }, { createdAt: "desc" }],
      skip,
      take: limit,
      select: {
        changedFields: true,
        completedAt: true,
        correlationId: true,
        createdAt: true,
        eventId: true,
        metadata: true,
        normalizedPayloadHash: true,
        operation: true,
        payload: true,
        receivedAt: true,
        routeTargets: true,
        serviceType: true,
        sourceRequestId: true,
        sourceSystem: true,
        status: true,
        targetSystem: true,
        ubid: true,
        updatedAt: true,
      },
    }),
    prisma.canonicalEvent.count({ where }),
  ]);

  return {
    items: items.map((item) => toDashboardEvent(item)),
    limit,
    page,
    total,
  };
}

export async function getDashboardEventById(eventId: string) {
  const [event, auditLogs] = await Promise.all([
    prisma.canonicalEvent.findUnique({
      where: { eventId },
      select: {
        changedFields: true,
        completedAt: true,
        correlationId: true,
        createdAt: true,
        eventId: true,
        metadata: true,
        normalizedPayloadHash: true,
        operation: true,
        payload: true,
        receivedAt: true,
        routeTargets: true,
        serviceType: true,
        sourceRequestId: true,
        sourceSystem: true,
        status: true,
        targetSystem: true,
        ubid: true,
        updatedAt: true,
      },
    }),
    prisma.auditLog.findMany({
      where: { eventId },
      orderBy: [{ recordedAt: "desc" }, { createdAt: "desc" }],
      select: {
        auditId: true,
        correlationId: true,
        createdAt: true,
        eventId: true,
        message: true,
        metadata: true,
        operation: true,
        recordedAt: true,
        serviceType: true,
        sourceRequestId: true,
        sourceSystem: true,
        stage: true,
        status: true,
        targetSystem: true,
        ubid: true,
      },
    }),
  ]);

  if (!event) {
    throw new AppError({
      code: ERROR_CODES.NOT_FOUND,
      message: `Canonical event ${eventId} was not found.`,
      statusCode: 404,
    });
  }

  return {
    auditLogs: auditLogs.map((auditLog) => toDashboardAudit(auditLog)),
    event: toDashboardEvent(event),
  };
}

export async function getDashboardAudit(query: DashboardAuditQuery) {
  const { limit, page, skip } = normalizePagination(query);
  const where: Prisma.AuditLogWhereInput = {
    ...(query.correlationId ? { correlationId: query.correlationId } : {}),
    ...(query.eventId ? { eventId: query.eventId } : {}),
    ...(query.sourceSystem ? { sourceSystem: query.sourceSystem } : {}),
    ...(query.stage ? { stage: query.stage } : {}),
    ...(query.targetSystem ? { targetSystem: query.targetSystem } : {}),
    ...(query.ubid ? { ubid: query.ubid } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: [{ recordedAt: "desc" }, { createdAt: "desc" }],
      skip,
      take: limit,
      select: {
        auditId: true,
        correlationId: true,
        createdAt: true,
        eventId: true,
        message: true,
        metadata: true,
        operation: true,
        recordedAt: true,
        serviceType: true,
        sourceRequestId: true,
        sourceSystem: true,
        stage: true,
        status: true,
        targetSystem: true,
        ubid: true,
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    items: items.map((item) => toDashboardAudit(item)),
    limit,
    page,
    total,
  };
}

export async function getDashboardConflictList(query: DashboardConflictsQuery) {
  const { limit, page, skip } = normalizePagination(query);
  const where: Prisma.ConflictWhereInput = {
    ...(query.resolutionStatus ? { resolutionStatus: query.resolutionStatus } : {}),
    ...(query.ubid ? { ubid: query.ubid } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.conflict.findMany({
      where,
      orderBy: [{ detectedAt: "desc" }, { createdAt: "desc" }],
      skip,
      take: limit,
      select: {
        authorityDecision: true,
        conflictingFields: true,
        conflictId: true,
        correlationId: true,
        detectedAt: true,
        eventId: true,
        metadata: true,
        notes: true,
        resolutionStatus: true,
        reviewStatus: true,
        reviewedAt: true,
        reviewedBy: true,
        serviceType: true,
        sourcePayload: true,
        sourceSystem: true,
        targetPayload: true,
        targetSystem: true,
        ubid: true,
      },
    }),
    prisma.conflict.count({ where }),
  ]);

  const conflictIds = items.map((item) => item.conflictId);
  const manualReviewItems =
    conflictIds.length === 0
      ? []
      : await prisma.manualReviewItem.findMany({
          where: {
            conflictId: {
              in: conflictIds,
            },
          },
          orderBy: [{ openedAt: "desc" }, { createdAt: "desc" }],
          select: {
            assignedTo: true,
            closedAt: true,
            conflictId: true,
            correlationId: true,
            createdAt: true,
            eventId: true,
            jobId: true,
            openedAt: true,
            payload: true,
            resolutionPayload: true,
            reviewId: true,
            reviewerNotes: true,
            reviewStatus: true,
            reviewType: true,
            reviewedAt: true,
            sourceSystem: true,
            summary: true,
            targetSystem: true,
            title: true,
            ubid: true,
            updatedAt: true,
          },
        });

  return {
    items: items.map((item) => toDashboardConflict(item)),
    limit,
    manualReviewItems: manualReviewItems.map((item) => toManualReviewItem(item)),
    page,
    total,
  };
}

export async function getDashboardQueueStatus() {
  const [dbCounts, deadLetterJobCount, redisHealth, queueHealth] = await Promise.all([
    prisma.queueJob.groupBy({
      by: ["status"],
      _count: {
        status: true,
      },
    }),
    prisma.deadLetterJob.count(),
    getRedisHealth(),
    getQueueHealth(),
  ]);

  let bullmqStats: Awaited<ReturnType<typeof getQueueStats>> | undefined;

  try {
    bullmqStats = await getQueueStats();
  } catch {
    bullmqStats = undefined;
  }

  return {
    bullmq: bullmqStats,
    deadLetterJobCount,
    queueJobStatusCounts: Object.values(QueueJobStatus).reduce<Record<string, number>>(
      (accumulator, status) => {
        accumulator[status] =
          dbCounts.find((item) => item.status === status)?._count.status ?? 0;
        return accumulator;
      },
      {},
    ),
    queue: queueHealth,
    redis: redisHealth,
  };
}

export async function getAuthorityMatrix() {
  const rules = await prisma.authorityMatrix.findMany({
    where: {
      status: MappingStatus.ACTIVE,
    },
    orderBy: [{ fieldPath: "asc" }, { version: "desc" }],
    select: {
      authoritativeSystem: true,
      fallbackSystem: true,
      fieldPath: true,
      manualReviewRequired: true,
      notes: true,
      ruleConfig: true,
      serviceType: true,
      status: true,
      targetSystem: true,
      version: true,
    },
  });

  return rules.map((rule) => toAuthorityRule(rule));
}
