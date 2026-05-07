import { Prisma } from "@prisma/client";
import { nanoid } from "nanoid";

import { AuditLogInput } from "../../common/types/audit.types";
import { MODULE_STATUS } from "../../config/constants";
import prisma from "../../config/prisma";

export interface AuditLogRecord extends AuditLogInput {
  auditId: string;
}

export interface AuditLogFilters {
  correlationId?: string;
  eventId?: string;
  limit?: number;
  stage?: AuditLogInput["stage"];
  status?: AuditLogInput["status"];
  ubid?: string;
}

type AuditLogRow = {
  auditId: string;
  correlationId: string;
  eventId: string;
  message: string;
  metadata: Prisma.JsonValue | null;
  operation: AuditLogInput["operation"];
  recordedAt: Date;
  serviceType: AuditLogInput["serviceType"];
  sourceRequestId: string | null;
  sourceSystem: AuditLogInput["sourceSystem"];
  stage: AuditLogInput["stage"];
  status: AuditLogInput["status"];
  targetSystem: AuditLogInput["targetSystem"] | null;
  ubid: string;
};

function clone<T>(value: T): T {
  return structuredClone(value);
}

function toJsonValue(value: Record<string, unknown> | undefined): Prisma.InputJsonValue | undefined {
  if (value === undefined) {
    return undefined;
  }

  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function parseMetadata(value: Prisma.JsonValue | null): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  return clone(value as Record<string, unknown>);
}

function toAuditLogRecord(record: AuditLogRow): AuditLogRecord {
  return {
    auditId: record.auditId,
    correlationId: record.correlationId,
    eventId: record.eventId,
    message: record.message,
    metadata: parseMetadata(record.metadata),
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

function normalizeLimit(limit: AuditLogFilters["limit"]) {
  if (typeof limit === "number" && Number.isFinite(limit)) {
    return limit;
  }

  if (typeof limit === "string") {
    const parsedLimit = Number.parseInt(limit, 10);

    if (Number.isFinite(parsedLimit) && parsedLimit > 0) {
      return parsedLimit;
    }
  }

  return undefined;
}

export async function getAuditStatus() {
  const totalLogs = await prisma.auditLog.count();

  return {
    message: "Audit module is running with Prisma-backed storage.",
    module: "audit",
    status: MODULE_STATUS,
    totalLogs,
  };
}

export async function writeAuditLog(input: AuditLogInput): Promise<AuditLogRecord> {
  const createdRecord = await prisma.auditLog.create({
    data: {
      auditId: input.auditId ?? `AUD-${nanoid(12)}`,
      correlationId: input.correlationId,
      eventId: input.eventId,
      message: input.message,
      metadata: toJsonValue(input.metadata),
      operation: input.operation,
      recordedAt: new Date(input.recordedAt),
      serviceType: input.serviceType,
      sourceRequestId: input.sourceRequestId ?? null,
      sourceSystem: input.sourceSystem,
      stage: input.stage,
      status: input.status,
      targetSystem: input.targetSystem ?? null,
      ubid: input.ubid,
    },
    select: {
      auditId: true,
      correlationId: true,
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
  });

  return toAuditLogRecord(createdRecord);
}

export async function getAuditLogs(filters: AuditLogFilters = {}): Promise<AuditLogRecord[]> {
  const limit = normalizeLimit(filters.limit);
  const auditLogs = await prisma.auditLog.findMany({
    where: {
      ...(filters.correlationId ? { correlationId: filters.correlationId } : {}),
      ...(filters.eventId ? { eventId: filters.eventId } : {}),
      ...(filters.stage ? { stage: filters.stage } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.ubid ? { ubid: filters.ubid } : {}),
    },
    orderBy: [{ recordedAt: "desc" }, { createdAt: "desc" }],
    take: limit,
    select: {
      auditId: true,
      correlationId: true,
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
  });

  return auditLogs.map((auditLog) => toAuditLogRecord(auditLog));
}

export async function getAuditByCorrelationId(correlationId: string): Promise<AuditLogRecord[]> {
  return getAuditLogs({ correlationId });
}

export async function getRecentAuditLogs(limit = 10): Promise<AuditLogRecord[]> {
  return getAuditLogs({ limit });
}
