import { nanoid } from "nanoid";
import { Prisma } from "@prisma/client";

import { AppError } from "../../common/errors/AppError";
import { ERROR_CODES } from "../../common/errors/errorCodes";
import type {
  CanonicalPayload,
  CanonicalPayloadField,
  RegisteredAddress,
} from "../../common/types/event.types";
import type { OperationType, ServiceType } from "../../common/types/system.types";
import { MODULE_STATUS } from "../../config/constants";
import prisma from "../../config/prisma";
import type {
  MockDepartmentChangeRecord,
  MockEkarmikaEstablishment,
} from "../../common/utils/mockSystemStore";

interface EkarmikaAmendmentInput {
  addressFull?: string;
  businessName?: string;
  employeeCount?: number;
  managerName?: string;
  powerCapacityHP?: number;
  workerLimit?: number;
}

interface EkarmikaManualUpdateInput {
  changedFields: CanonicalPayloadField[];
  correlationId: string;
  operation: OperationType;
  payload: CanonicalPayload;
  remarks?: string;
  serviceType: ServiceType;
  ubid: string;
  updatedBy?: string;
}

interface ListChangesOptions {
  updatedSince?: string;
}

type EkarmikaChangeSource = "AMENDMENT" | "MANUAL_UPDATE";
type RawObject = Record<string, unknown>;

type LastChangeMetadata = {
  changeId: string;
  changeSource: EkarmikaChangeSource;
  changedFields: string[];
  correlationId?: string;
  operation?: OperationType;
  remarks?: string;
  serviceType?: ServiceType;
  updatedBy?: string;
};

function clone<T>(value: T): T {
  return structuredClone(value);
}

function getNow() {
  return new Date();
}

function createRecordId(prefix: string) {
  return `${prefix}-${nanoid(8)}`;
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function parseJsonObject(value: Prisma.JsonValue | null): RawObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return clone(value as RawObject);
}

function addressToFlatString(address: RegisteredAddress) {
  return [address.line1, address.line2, address.city, address.district, address.state, address.postalCode]
    .filter(Boolean)
    .join(", ");
}

function toEkarmikaEstablishment(record: {
  addressFull: string | null;
  businessName: string;
  employeeCount: number | null;
  labourRegNo: string;
  lastModifiedAt: Date;
  managerName: string | null;
  powerCapacityHP: number | null;
  ubid: string;
  workerLimit: number | null;
}): MockEkarmikaEstablishment {
  return {
    labourRegNo: record.labourRegNo,
    ubid: record.ubid,
    businessName: record.businessName,
    addressFull: record.addressFull ?? undefined,
    managerName: record.managerName ?? undefined,
    employeeCount: record.employeeCount ?? undefined,
    workerLimit: record.workerLimit ?? undefined,
    powerCapacityHP: record.powerCapacityHP ?? undefined,
    lastModified: record.lastModifiedAt.toISOString(),
  };
}

function applyCanonicalPayload(
  current: MockEkarmikaEstablishment,
  payload: CanonicalPayload,
): MockEkarmikaEstablishment {
  return {
    ...current,
    ...(payload.businessName !== undefined ? { businessName: payload.businessName } : {}),
    ...(payload.registeredAddress !== undefined
      ? { addressFull: addressToFlatString(payload.registeredAddress) }
      : {}),
    ...(payload.authorizedSignatory?.name !== undefined
      ? { managerName: payload.authorizedSignatory.name }
      : {}),
    ...(payload.employeeCount !== undefined ? { employeeCount: payload.employeeCount } : {}),
    ...(payload.workerLimit !== undefined ? { workerLimit: payload.workerLimit } : {}),
    ...(payload.powerCapacityHP !== undefined ? { powerCapacityHP: payload.powerCapacityHP } : {}),
  };
}

function buildLastChangeMetadata(
  input: {
    changeSource: EkarmikaChangeSource;
    changedFields: string[];
    correlationId?: string;
    operation?: OperationType;
    remarks?: string;
    serviceType?: ServiceType;
    updatedBy?: string;
  },
): LastChangeMetadata {
  return {
    changeId: createRecordId("EKCHG"),
    changeSource: input.changeSource,
    changedFields: input.changedFields,
    correlationId: input.correlationId,
    operation: input.operation,
    remarks: input.remarks,
    serviceType: input.serviceType,
    updatedBy: input.updatedBy,
  };
}

function buildRawPayload(
  existingRawPayload: Prisma.JsonValue | null,
  establishment: MockEkarmikaEstablishment,
  lastChange: LastChangeMetadata,
): Prisma.InputJsonValue {
  const rawPayload = parseJsonObject(existingRawPayload);

  return toJsonValue({
    ...rawPayload,
    ubid: establishment.ubid,
    labourRegNo: establishment.labourRegNo,
    businessName: establishment.businessName,
    addressFull: establishment.addressFull,
    managerName: establishment.managerName,
    employeeCount: establishment.employeeCount,
    workerLimit: establishment.workerLimit,
    powerCapacityHP: establishment.powerCapacityHP,
    lastChange,
  });
}

function toChangeRecord(record: {
  labourRegNo: string;
  lastModifiedAt: Date;
  rawPayload: Prisma.JsonValue | null;
  ubid: string;
}): MockDepartmentChangeRecord {
  const rawPayload = parseJsonObject(record.rawPayload);
  const lastChange = rawPayload.lastChange;
  const parsedLastChange =
    lastChange && typeof lastChange === "object" && !Array.isArray(lastChange)
      ? (lastChange as Partial<LastChangeMetadata>)
      : undefined;

  return {
    changeId: parsedLastChange?.changeId ?? `EKCHG-${record.labourRegNo}-${record.lastModifiedAt.getTime()}`,
    ubid: record.ubid,
    labourRegNo: record.labourRegNo,
    operation: parsedLastChange?.operation,
    serviceType: parsedLastChange?.serviceType,
    changeSource: parsedLastChange?.changeSource ?? "MANUAL_UPDATE",
    changedFields: parsedLastChange?.changedFields ?? [],
    updatedBy: parsedLastChange?.updatedBy,
    remarks: parsedLastChange?.remarks,
    lastModified: record.lastModifiedAt.toISOString(),
  };
}

async function findByLabourRegNoOrThrow(labourRegNo: string) {
  const establishment = await prisma.mockEkarmikaRecord.findUnique({
    where: { labourRegNo },
  });

  if (!establishment) {
    throw new AppError({
      code: ERROR_CODES.NOT_FOUND,
      message: `Mock e-Karmika establishment not found for labour registration ${labourRegNo}.`,
      statusCode: 404,
    });
  }

  return establishment;
}

async function findByUbidOrThrow(ubid: string) {
  const establishment = await prisma.mockEkarmikaRecord.findFirst({
    where: { ubid },
  });

  if (!establishment) {
    throw new AppError({
      code: ERROR_CODES.NOT_FOUND,
      message: `Mock e-Karmika establishment not found for UBID ${ubid}.`,
      statusCode: 404,
    });
  }

  return establishment;
}

export async function getMockEkarmikaStatus() {
  const seededEstablishments = await prisma.mockEkarmikaRecord.count();

  return {
    message: "Mock e-Karmika PostgreSQL API is ready.",
    module: "mock-ekarmika",
    seededEstablishments,
    status: MODULE_STATUS,
  };
}

export async function getEstablishmentByLabourRegNo(labourRegNo: string) {
  return toEkarmikaEstablishment(await findByLabourRegNoOrThrow(labourRegNo));
}

export async function amendEstablishmentByLabourRegNo(
  labourRegNo: string,
  input: EkarmikaAmendmentInput,
) {
  const existingRecord = await findByLabourRegNoOrThrow(labourRegNo);
  const current = toEkarmikaEstablishment(existingRecord);
  const amended: MockEkarmikaEstablishment = {
    ...current,
    ...(input.businessName !== undefined ? { businessName: input.businessName } : {}),
    ...(input.addressFull !== undefined ? { addressFull: input.addressFull } : {}),
    ...(input.managerName !== undefined ? { managerName: input.managerName } : {}),
    ...(input.employeeCount !== undefined ? { employeeCount: input.employeeCount } : {}),
    ...(input.workerLimit !== undefined ? { workerLimit: input.workerLimit } : {}),
    ...(input.powerCapacityHP !== undefined ? { powerCapacityHP: input.powerCapacityHP } : {}),
  };

  const changedFields = Object.entries(input)
    .filter(([, value]) => value !== undefined)
    .map(([key]) => key);
  const updatedAt = getNow();
  const change = buildLastChangeMetadata({
    changeSource: "AMENDMENT",
    changedFields,
    operation: "UPDATE",
  });

  const updatedRecord = await prisma.mockEkarmikaRecord.update({
    where: { labourRegNo },
    data: {
      businessName: amended.businessName,
      addressFull: amended.addressFull ?? null,
      managerName: amended.managerName ?? null,
      employeeCount: amended.employeeCount ?? null,
      workerLimit: amended.workerLimit ?? null,
      powerCapacityHP: amended.powerCapacityHP ?? null,
      rawPayload: buildRawPayload(existingRecord.rawPayload, amended, change),
      lastModifiedAt: updatedAt,
    },
  });

  return {
    change: toChangeRecord(updatedRecord),
    establishment: toEkarmikaEstablishment(updatedRecord),
  };
}

export async function manuallyUpdateEstablishment(input: EkarmikaManualUpdateInput) {
  const existingRecord = await findByUbidOrThrow(input.ubid);
  const current = toEkarmikaEstablishment(existingRecord);
  const updatedEstablishment = applyCanonicalPayload(current, input.payload);
  const updatedAt = getNow();
  const change = buildLastChangeMetadata({
    changeSource: "MANUAL_UPDATE",
    changedFields: input.changedFields,
    correlationId: input.correlationId,
    operation: input.operation,
    remarks: input.remarks,
    serviceType: input.serviceType,
    updatedBy: input.updatedBy,
  });

  const updatedRecord = await prisma.mockEkarmikaRecord.update({
    where: { labourRegNo: existingRecord.labourRegNo },
    data: {
      businessName: updatedEstablishment.businessName,
      addressFull: updatedEstablishment.addressFull ?? null,
      managerName: updatedEstablishment.managerName ?? null,
      employeeCount: updatedEstablishment.employeeCount ?? null,
      workerLimit: updatedEstablishment.workerLimit ?? null,
      powerCapacityHP: updatedEstablishment.powerCapacityHP ?? null,
      rawPayload: buildRawPayload(existingRecord.rawPayload, updatedEstablishment, change),
      lastModifiedAt: updatedAt,
    },
  });

  return {
    change: toChangeRecord(updatedRecord),
    establishment: toEkarmikaEstablishment(updatedRecord),
  };
}

export async function listEkarmikaChanges(options: ListChangesOptions = {}) {
  const establishments = await prisma.mockEkarmikaRecord.findMany({
    where: options.updatedSince
      ? {
          lastModifiedAt: {
            gt: new Date(options.updatedSince),
          },
        }
      : undefined,
    orderBy: { lastModifiedAt: "desc" },
  });

  return establishments.map((establishment) => toChangeRecord(establishment));
}
