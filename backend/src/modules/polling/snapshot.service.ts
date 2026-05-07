import { createHash } from "node:crypto";

import { Prisma } from "@prisma/client";

import { SystemName } from "../../common/types/system.types";
import prisma from "../../config/prisma";

export interface StoredDepartmentSnapshot {
  capturedAt: string;
  lastModifiedAt?: string;
  localIdentifier: string;
  localIdentifierType?: string;
  normalizedPayloadHash?: string;
  snapshotPayload: Record<string, unknown>;
  systemName: SystemName;
  ubid: string;
}

type DepartmentSnapshotRow = {
  capturedAt: Date;
  lastModifiedAt: Date | null;
  localIdentifier: string;
  localIdentifierType: string | null;
  normalizedPayloadHash: string | null;
  snapshotPayload: Prisma.JsonValue;
  systemName: SystemName;
  ubid: string;
};

function clone<T>(value: T): T {
  return structuredClone(value);
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }

  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((accumulator, key) => {
        accumulator[key] = sortValue((value as Record<string, unknown>)[key]);
        return accumulator;
      }, {});
  }

  return value;
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function parseSnapshotPayload(value: Prisma.JsonValue): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return clone(value as Record<string, unknown>);
}

function inferLocalIdentifierType(systemName: SystemName) {
  switch (systemName) {
    case "EKARMIKA":
      return "labourRegNo";
    case "ESURAKSHATE":
      return "factoryLicenseNo";
    case "SWS":
      return "businessId";
    default:
      return undefined;
  }
}

function toStoredSnapshot(record: DepartmentSnapshotRow): StoredDepartmentSnapshot {
  return {
    capturedAt: record.capturedAt.toISOString(),
    lastModifiedAt: record.lastModifiedAt?.toISOString(),
    localIdentifier: record.localIdentifier,
    localIdentifierType: record.localIdentifierType ?? undefined,
    normalizedPayloadHash: record.normalizedPayloadHash ?? undefined,
    snapshotPayload: parseSnapshotPayload(record.snapshotPayload),
    systemName: record.systemName,
    ubid: record.ubid,
  };
}

export function computeSnapshotHash(normalizedObject: Record<string, unknown>) {
  const normalizedSnapshot = JSON.stringify(sortValue(normalizedObject));

  return createHash("sha256").update(normalizedSnapshot).digest("hex");
}

export async function getPreviousSnapshot(
  systemName: SystemName,
  ubid: string,
  localIdentifier: string,
): Promise<StoredDepartmentSnapshot | null> {
  const snapshot = await prisma.departmentSnapshot.findUnique({
    where: {
      systemName_ubid_localIdentifier: {
        localIdentifier,
        systemName,
        ubid,
      },
    },
    select: {
      capturedAt: true,
      lastModifiedAt: true,
      localIdentifier: true,
      localIdentifierType: true,
      normalizedPayloadHash: true,
      snapshotPayload: true,
      systemName: true,
      ubid: true,
    },
  });

  return snapshot ? toStoredSnapshot(snapshot) : null;
}

export async function saveSnapshot(
  systemName: SystemName,
  ubid: string,
  localIdentifier: string,
  hash: string,
  normalizedSnapshotJson: Record<string, unknown>,
  lastModifiedAt?: string,
) {
  const now = new Date();
  const snapshot = await prisma.departmentSnapshot.upsert({
    where: {
      systemName_ubid_localIdentifier: {
        localIdentifier,
        systemName,
        ubid,
      },
    },
    create: {
      capturedAt: now,
      lastModifiedAt: lastModifiedAt ? new Date(lastModifiedAt) : null,
      localIdentifier,
      localIdentifierType: inferLocalIdentifierType(systemName) ?? null,
      normalizedPayloadHash: hash,
      snapshotPayload: toJsonValue(normalizedSnapshotJson),
      systemName,
      ubid,
    },
    update: {
      capturedAt: now,
      lastModifiedAt: lastModifiedAt ? new Date(lastModifiedAt) : null,
      localIdentifierType: inferLocalIdentifierType(systemName) ?? null,
      normalizedPayloadHash: hash,
      snapshotPayload: toJsonValue(normalizedSnapshotJson),
    },
    select: {
      capturedAt: true,
      lastModifiedAt: true,
      localIdentifier: true,
      localIdentifierType: true,
      normalizedPayloadHash: true,
      snapshotPayload: true,
      systemName: true,
      ubid: true,
    },
  });

  return toStoredSnapshot(snapshot);
}

export async function listStoredSnapshots() {
  const snapshots = await prisma.departmentSnapshot.findMany({
    orderBy: [{ systemName: "asc" }, { ubid: "asc" }, { capturedAt: "desc" }],
    select: {
      capturedAt: true,
      lastModifiedAt: true,
      localIdentifier: true,
      localIdentifierType: true,
      normalizedPayloadHash: true,
      snapshotPayload: true,
      systemName: true,
      ubid: true,
    },
  });

  return snapshots.map((snapshot) => toStoredSnapshot(snapshot));
}

