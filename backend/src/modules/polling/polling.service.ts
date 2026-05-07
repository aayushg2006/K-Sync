import { nanoid } from "nanoid";
import { Prisma } from "@prisma/client";

import { AuditLogInput } from "../../common/types/audit.types";
import { CanonicalPayload, CanonicalPayloadField } from "../../common/types/event.types";
import { OperationType, ServiceType, SystemName } from "../../common/types/system.types";
import prisma from "../../config/prisma";
import { writeAuditLog } from "../audit/audit.service";
import { computeNormalizedPayloadHash } from "../ksync/canonical-event.factory";
import { ingestRequest } from "../ksync/ksync.service";
import {
  PollableSystemName,
  SnapshotDiffEntry,
  diffObjects,
} from "./diff.service";
import {
  StoredDepartmentSnapshot,
  computeSnapshotHash,
  getPreviousSnapshot,
  listStoredSnapshots,
  saveSnapshot,
} from "./snapshot.service";

type JsonObject = Record<string, unknown>;

interface NormalizedDepartmentRecord {
  lastModifiedAt: Date;
  localIdentifier: string;
  rawPayload: JsonObject;
  snapshot: JsonObject;
  systemName: PollableSystemName;
  ubid: string;
}

interface PollingActionSummary {
  action:
    | "BASELINE_SAVED"
    | "EVENT_CREATED"
    | "NO_CHANGE"
    | "PROPAGATED_CHANGE_CONFIRMED"
    | "UNSUPPORTED_CHANGE_SKIPPED";
  changedFields?: CanonicalPayloadField[];
  conflictAwareStatus?: string;
  correlationId?: string;
  eventId?: string;
  localIdentifier: string;
  message: string;
  propagatedEventId?: string;
  serviceType?: ServiceType;
  systemName: PollableSystemName;
  ubid: string;
}

export interface PollingRunSummary {
  baselinesSaved: number;
  eventsCreated: number;
  noChanges: number;
  propagatedChangesConfirmed: number;
  snapshotsSaved: number;
  summaries: PollingActionSummary[];
  unsupportedChanges: number;
}

type DepartmentSnapshotRow = {
  addressFull?: string | null;
  employeeCount?: number | null;
  factoryAddress?: string | null;
  factoryLicenseNo?: string;
  lastModifiedAt: Date;
  labourRegNo?: string;
  managerName?: string | null;
  powerCapacityHP?: number | null;
  rawPayload: Prisma.JsonValue | null;
  ubid: string;
  workerLimit?: number | null;
};

type PropagationMetadata = {
  appliedAt?: string;
  eventId?: string;
  serviceType?: ServiceType;
  sourceSystem?: SystemName;
  targetSystem?: SystemName;
};

function clone<T>(value: T): T {
  return structuredClone(value);
}

function parseJsonObject(value: Prisma.JsonValue | null): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return clone(value as JsonObject);
}

function mergeCanonicalPayloadFragments(
  fragments: Array<Partial<CanonicalPayload>>,
): CanonicalPayload {
  const mergedPayload: CanonicalPayload = {};

  for (const fragment of fragments) {
    if (fragment.businessName !== undefined) {
      mergedPayload.businessName = fragment.businessName;
    }

    if (fragment.registeredAddress !== undefined) {
      mergedPayload.registeredAddress = {
        ...(mergedPayload.registeredAddress ?? {}),
        ...fragment.registeredAddress,
      };
    }

    if (fragment.authorizedSignatory !== undefined) {
      mergedPayload.authorizedSignatory = {
        ...(mergedPayload.authorizedSignatory ?? {}),
        ...fragment.authorizedSignatory,
      };
    }

    if (fragment.employeeCount !== undefined) {
      mergedPayload.employeeCount = fragment.employeeCount;
    }

    if (fragment.workerLimit !== undefined) {
      mergedPayload.workerLimit = fragment.workerLimit;
    }

    if (fragment.powerCapacityHP !== undefined) {
      mergedPayload.powerCapacityHP = fragment.powerCapacityHP;
    }

    if (fragment.licenseExpiry !== undefined) {
      mergedPayload.licenseExpiry = fragment.licenseExpiry;
    }
  }

  return mergedPayload;
}

function buildAuditEntry(input: {
  correlationId: string;
  eventId: string;
  message: string;
  metadata?: Record<string, unknown>;
  operation: OperationType;
  serviceType: ServiceType;
  sourceSystem: SystemName;
  sourceRequestId?: string;
  stage: AuditLogInput["stage"];
  status: AuditLogInput["status"];
  targetSystem?: SystemName;
  ubid: string;
}) {
  return {
    correlationId: input.correlationId,
    eventId: input.eventId,
    message: input.message,
    metadata: input.metadata,
    operation: input.operation,
    recordedAt: new Date().toISOString(),
    serviceType: input.serviceType,
    sourceRequestId: input.sourceRequestId,
    sourceSystem: input.sourceSystem,
    stage: input.stage,
    status: input.status,
    targetSystem: input.targetSystem,
    ubid: input.ubid,
  } satisfies AuditLogInput;
}

function pickRepresentativeServiceType(snapshot: JsonObject, systemName: PollableSystemName) {
  if (systemName === "EKARMIKA") {
    if (typeof snapshot.employeeCount === "number") {
      return "EMPLOYEE_COUNT_CHANGE" satisfies ServiceType;
    }

    if (typeof snapshot.employerName === "string") {
      return "AUTHORIZED_SIGNATORY_CHANGE" satisfies ServiceType;
    }

    return "REGISTERED_ADDRESS_CHANGE" satisfies ServiceType;
  }

  if (typeof snapshot.managerName === "string") {
    return "AUTHORIZED_SIGNATORY_CHANGE" satisfies ServiceType;
  }

  if (typeof snapshot.licenseExpiry === "string") {
    return "LICENSE_EXPIRY_CHANGE" satisfies ServiceType;
  }

  if (typeof snapshot.powerCapacityHP === "number") {
    return "POWER_CAPACITY_CHANGE" satisfies ServiceType;
  }

  return "REGISTERED_ADDRESS_CHANGE" satisfies ServiceType;
}

function getPropagationMetadata(rawPayload: JsonObject): PropagationMetadata | undefined {
  const lastPropagation = rawPayload.lastPropagation;

  if (!lastPropagation || typeof lastPropagation !== "object" || Array.isArray(lastPropagation)) {
    return undefined;
  }

  return lastPropagation as PropagationMetadata;
}

function isPropagationTimestampMatch(
  lastModifiedAt: Date,
  propagationMetadata: PropagationMetadata,
) {
  if (!propagationMetadata.appliedAt) {
    return false;
  }

  const appliedAt = new Date(propagationMetadata.appliedAt);

  return Math.abs(lastModifiedAt.getTime() - appliedAt.getTime()) <= 5000;
}

async function confirmPropagatedChangeIfApplicable(
  record: NormalizedDepartmentRecord,
  serviceType: ServiceType,
  payload: CanonicalPayload,
  changedFields: CanonicalPayloadField[],
  canonicalFieldPaths: string[],
  snapshotHash: string,
) {
  const propagationMetadata = getPropagationMetadata(record.rawPayload);

  if (
    !propagationMetadata?.eventId ||
    propagationMetadata.sourceSystem === record.systemName ||
    propagationMetadata.serviceType !== serviceType ||
    !isPropagationTimestampMatch(record.lastModifiedAt, propagationMetadata)
  ) {
    return null;
  }

  const propagatedEvent = await prisma.canonicalEvent.findUnique({
    where: { eventId: propagationMetadata.eventId },
    select: {
      changedFields: true,
      correlationId: true,
      eventId: true,
      normalizedPayloadHash: true,
      operation: true,
      serviceType: true,
      sourceRequestId: true,
      sourceSystem: true,
      ubid: true,
    },
  });

  if (
    !propagatedEvent ||
    propagatedEvent.sourceSystem === record.systemName ||
    propagatedEvent.serviceType !== serviceType ||
    propagatedEvent.ubid !== record.ubid
  ) {
    return null;
  }

  const payloadHash = computeNormalizedPayloadHash(payload);
  const changedFieldSet = JSON.stringify([...changedFields].sort());
  const propagatedChangedFieldSet = JSON.stringify(
    Array.isArray(propagatedEvent.changedFields)
      ? [...(propagatedEvent.changedFields as CanonicalPayloadField[])].sort()
      : [],
  );

  if (
    propagatedEvent.normalizedPayloadHash !== payloadHash &&
    changedFieldSet !== propagatedChangedFieldSet
  ) {
    return null;
  }

  await writeAuditLog(
    buildAuditEntry({
      correlationId: propagatedEvent.correlationId,
      eventId: propagatedEvent.eventId,
      message: `Polling confirmed the propagated ${record.systemName} write for ${record.localIdentifier}.`,
      metadata: {
        canonicalFieldPaths,
        changedFields,
        localIdentifier: record.localIdentifier,
        snapshotHash,
        systemName: record.systemName,
      },
      operation: propagatedEvent.operation,
      serviceType,
      sourceSystem: propagatedEvent.sourceSystem,
      sourceRequestId: propagatedEvent.sourceRequestId ?? undefined,
      stage: "DELIVERY",
      status: "PROPAGATED_CHANGE_CONFIRMED",
      targetSystem: record.systemName,
      ubid: record.ubid,
    }),
  );

  return propagatedEvent;
}

async function normalizeEkarmikaRecord(
  ubid: string,
): Promise<NormalizedDepartmentRecord | null> {
  const record = await prisma.mockEkarmikaRecord.findFirst({
    where: { ubid },
    select: {
      addressFull: true,
      employeeCount: true,
      labourRegNo: true,
      lastModifiedAt: true,
      managerName: true,
      powerCapacityHP: true,
      rawPayload: true,
      ubid: true,
      workerLimit: true,
    },
  });

  if (!record?.labourRegNo) {
    return null;
  }

  const rawPayload = parseJsonObject(record.rawPayload);

  return {
    lastModifiedAt: record.lastModifiedAt,
    localIdentifier: record.labourRegNo,
    rawPayload,
    snapshot: {
      addressFull: record.addressFull ?? undefined,
      employeeCount: record.employeeCount ?? undefined,
      employerName:
        typeof rawPayload.employerName === "string"
          ? rawPayload.employerName
          : record.managerName ?? undefined,
    },
    systemName: "EKARMIKA",
    ubid: record.ubid,
  };
}

async function normalizeEsurakshateRecord(
  ubid: string,
): Promise<NormalizedDepartmentRecord | null> {
  const record = await prisma.mockEsurakshateRecord.findFirst({
    where: { ubid },
    select: {
      factoryAddress: true,
      factoryLicenseNo: true,
      lastModifiedAt: true,
      managerName: true,
      powerCapacityHP: true,
      rawPayload: true,
      ubid: true,
      workerLimit: true,
    },
  });

  if (!record?.factoryLicenseNo) {
    return null;
  }

  const rawPayload = parseJsonObject(record.rawPayload);

  return {
    lastModifiedAt: record.lastModifiedAt,
    localIdentifier: record.factoryLicenseNo,
    rawPayload,
    snapshot: {
      factoryAddress: record.factoryAddress ?? undefined,
      licenseExpiry:
        typeof rawPayload.licenseExpiry === "string"
          ? rawPayload.licenseExpiry
          : typeof rawPayload.LicenseExpiry === "string"
            ? rawPayload.LicenseExpiry
            : undefined,
      managerName: record.managerName ?? undefined,
      powerCapacityHP: record.powerCapacityHP ?? undefined,
      workerLimit: record.workerLimit ?? undefined,
    },
    systemName: "ESURAKSHATE",
    ubid: record.ubid,
  };
}

async function writeBaselineAudit(record: NormalizedDepartmentRecord) {
  const baselineEventId = `POLL-BASELINE-${record.systemName}-${record.localIdentifier}`;
  const baselineCorrelationId = `POLL-BASELINE-${record.systemName}-${record.ubid}`;

  await writeAuditLog(
    buildAuditEntry({
      correlationId: baselineCorrelationId,
      eventId: baselineEventId,
      message: `Baseline snapshot captured for ${record.systemName} ${record.localIdentifier}.`,
      metadata: {
        auditType: "POLLING_BASELINE",
        localIdentifier: record.localIdentifier,
        snapshotFields: Object.keys(record.snapshot),
      },
      operation: "UPDATE",
      serviceType: pickRepresentativeServiceType(record.snapshot, record.systemName),
      sourceSystem: record.systemName,
      stage: "INGESTION",
      status: "VALIDATED",
      ubid: record.ubid,
    }),
  );
}

async function pollNormalizedRecord(
  record: NormalizedDepartmentRecord,
): Promise<PollingRunSummary> {
  const snapshotHash = computeSnapshotHash(record.snapshot);
  const previousSnapshot = await getPreviousSnapshot(
    record.systemName,
    record.ubid,
    record.localIdentifier,
  );
  const summary: PollingRunSummary = {
    baselinesSaved: 0,
    eventsCreated: 0,
    noChanges: 0,
    propagatedChangesConfirmed: 0,
    snapshotsSaved: 0,
    summaries: [],
    unsupportedChanges: 0,
  };

  if (!previousSnapshot) {
    await saveSnapshot(
      record.systemName,
      record.ubid,
      record.localIdentifier,
      snapshotHash,
      record.snapshot,
      record.lastModifiedAt.toISOString(),
    );
    await writeBaselineAudit(record);

    summary.baselinesSaved += 1;
    summary.snapshotsSaved += 1;
    summary.summaries.push({
      action: "BASELINE_SAVED",
      localIdentifier: record.localIdentifier,
      message: `Saved initial baseline snapshot for ${record.systemName}.`,
      systemName: record.systemName,
      ubid: record.ubid,
    });

    return summary;
  }

  if (previousSnapshot.normalizedPayloadHash === snapshotHash) {
    summary.noChanges += 1;
    summary.summaries.push({
      action: "NO_CHANGE",
      localIdentifier: record.localIdentifier,
      message: `No changes detected for ${record.systemName}.`,
      systemName: record.systemName,
      ubid: record.ubid,
    });

    return summary;
  }

  const diffEntries = diffObjects(
    previousSnapshot.snapshotPayload,
    record.snapshot,
    record.systemName,
  );

  const supportedEntries = diffEntries.filter(
    (entry): entry is SnapshotDiffEntry & { serviceType: ServiceType } =>
      entry.serviceType !== undefined,
  );
  const unsupportedEntries = diffEntries.filter((entry) => entry.serviceType === undefined);

  const groupedEntries = supportedEntries.reduce<Map<ServiceType, SnapshotDiffEntry[]>>(
    (accumulator, entry) => {
      const existingEntries = accumulator.get(entry.serviceType) ?? [];
      existingEntries.push(entry);
      accumulator.set(entry.serviceType, existingEntries);
      return accumulator;
    },
    new Map(),
  );

  for (const [serviceType, entries] of groupedEntries) {
    const payload = mergeCanonicalPayloadFragments(entries.map((entry) => entry.payloadFragment));
    const changedFields = Array.from(
      new Set(entries.map((entry) => entry.changedField)),
    ) as CanonicalPayloadField[];
    const canonicalFieldPaths = Array.from(
      new Set(entries.map((entry) => entry.canonicalFieldPath)),
    );

    const propagatedEvent = await confirmPropagatedChangeIfApplicable(
      record,
      serviceType,
      payload,
      changedFields,
      canonicalFieldPaths,
      snapshotHash,
    );

    if (propagatedEvent) {
      summary.propagatedChangesConfirmed += 1;
      summary.summaries.push({
        action: "PROPAGATED_CHANGE_CONFIRMED",
        changedFields,
        conflictAwareStatus: "PROPAGATED_CHANGE_CONFIRMED",
        correlationId: propagatedEvent.correlationId,
        eventId: propagatedEvent.eventId,
        localIdentifier: record.localIdentifier,
        message: `Confirmed propagated ${serviceType} change for ${record.systemName}.`,
        propagatedEventId: propagatedEvent.eventId,
        serviceType,
        systemName: record.systemName,
        ubid: record.ubid,
      });

      continue;
    }

    const result = await ingestRequest({
      changedFields,
      correlationId: `POLL-${record.systemName}-${record.ubid}-${nanoid(8)}`,
      operation: "UPDATE",
      payload,
      serviceType,
      sourceSystem: record.systemName,
      ubid: record.ubid,
    });

    summary.eventsCreated += 1;
    summary.summaries.push({
      action: "EVENT_CREATED",
      changedFields,
      conflictAwareStatus: result.status,
      correlationId: result.correlationId,
      eventId: result.eventId,
      localIdentifier: record.localIdentifier,
      message: `Detected ${serviceType} change and created a canonical event.`,
      serviceType,
      systemName: record.systemName,
      ubid: record.ubid,
    });
  }

  if (unsupportedEntries.length > 0) {
    summary.unsupportedChanges += unsupportedEntries.length;
    summary.summaries.push({
      action: "UNSUPPORTED_CHANGE_SKIPPED",
      changedFields: Array.from(
        new Set(unsupportedEntries.map((entry) => entry.changedField)),
      ) as CanonicalPayloadField[],
      localIdentifier: record.localIdentifier,
      message: `Skipped unsupported direct-change fields: ${unsupportedEntries
        .map((entry) => entry.canonicalFieldPath)
        .join(", ")}.`,
      systemName: record.systemName,
      ubid: record.ubid,
    });
  }

  await saveSnapshot(
    record.systemName,
    record.ubid,
    record.localIdentifier,
    snapshotHash,
    record.snapshot,
    record.lastModifiedAt.toISOString(),
  );
  summary.snapshotsSaved += 1;

  return summary;
}

function mergeRunSummaries(summaries: PollingRunSummary[]) {
  return summaries.reduce<PollingRunSummary>(
    (accumulator, summary) => ({
      baselinesSaved: accumulator.baselinesSaved + summary.baselinesSaved,
      eventsCreated: accumulator.eventsCreated + summary.eventsCreated,
      noChanges: accumulator.noChanges + summary.noChanges,
      propagatedChangesConfirmed:
        accumulator.propagatedChangesConfirmed + summary.propagatedChangesConfirmed,
      snapshotsSaved: accumulator.snapshotsSaved + summary.snapshotsSaved,
      summaries: [...accumulator.summaries, ...summary.summaries],
      unsupportedChanges: accumulator.unsupportedChanges + summary.unsupportedChanges,
    }),
    {
      baselinesSaved: 0,
      eventsCreated: 0,
      noChanges: 0,
      propagatedChangesConfirmed: 0,
      snapshotsSaved: 0,
      summaries: [],
      unsupportedChanges: 0,
    },
  );
}

export async function pollEkarmikaByUbid(ubid: string) {
  const record = await normalizeEkarmikaRecord(ubid);

  if (!record) {
    return {
      baselinesSaved: 0,
      eventsCreated: 0,
      noChanges: 0,
      propagatedChangesConfirmed: 0,
      snapshotsSaved: 0,
      summaries: [
        {
          action: "NO_CHANGE",
          localIdentifier: "not-found",
          message: `No e-Karmika record exists for ${ubid}.`,
          systemName: "EKARMIKA" as const,
          ubid,
        },
      ],
      unsupportedChanges: 0,
    } satisfies PollingRunSummary;
  }

  return pollNormalizedRecord(record);
}

export async function pollEsurakshateByUbid(ubid: string) {
  const record = await normalizeEsurakshateRecord(ubid);

  if (!record) {
    return {
      baselinesSaved: 0,
      eventsCreated: 0,
      noChanges: 0,
      propagatedChangesConfirmed: 0,
      snapshotsSaved: 0,
      summaries: [
        {
          action: "NO_CHANGE",
          localIdentifier: "not-found",
          message: `No e-Surakshate record exists for ${ubid}.`,
          systemName: "ESURAKSHATE" as const,
          ubid,
        },
      ],
      unsupportedChanges: 0,
    } satisfies PollingRunSummary;
  }

  return pollNormalizedRecord(record);
}

export async function pollSingleDepartmentRecord(
  systemName: PollableSystemName,
  ubid: string,
) {
  return systemName === "EKARMIKA"
    ? pollEkarmikaByUbid(ubid)
    : pollEsurakshateByUbid(ubid);
}

export async function pollAllKnownDepartmentRecords() {
  const [ekarmikaUbids, esurakshateUbids] = await Promise.all([
    prisma.mockEkarmikaRecord.findMany({
      orderBy: { ubid: "asc" },
      select: { ubid: true },
    }),
    prisma.mockEsurakshateRecord.findMany({
      orderBy: { ubid: "asc" },
      select: { ubid: true },
    }),
  ]);

  const runs: PollingRunSummary[] = [];

  for (const record of ekarmikaUbids) {
    runs.push(await pollEkarmikaByUbid(record.ubid));
  }

  for (const record of esurakshateUbids) {
    runs.push(await pollEsurakshateByUbid(record.ubid));
  }

  return mergeRunSummaries(runs);
}

export async function getPollingSnapshots() {
  return listStoredSnapshots();
}
