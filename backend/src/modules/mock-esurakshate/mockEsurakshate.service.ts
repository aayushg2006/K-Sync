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
  MockEsurakshateFactory,
} from "../../common/utils/mockSystemStore";
import { buildFactoryXml } from "./esurakshate.xml";

interface EsurakshateAmendmentInput {
  businessName?: string;
  employeeCount?: number;
  factoryAddress?: string;
  managerName?: string;
  powerCapacityHP?: number;
  workerLimit?: number;
}

interface EsurakshateManualUpdateInput {
  changedFields: CanonicalPayloadField[];
  correlationId: string;
  operation: OperationType;
  payload: CanonicalPayload;
  remarks?: string;
  serviceType: ServiceType;
  ubid: string;
  updatedBy?: string;
}

type EsurakshateChangeSource = "AMENDMENT" | "MANUAL_UPDATE";
type RawObject = Record<string, unknown>;

type LastChangeMetadata = {
  changeId: string;
  changeSource: EsurakshateChangeSource;
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

function toFactory(record: {
  businessName: string;
  employeeCount: number | null;
  factoryAddress: string | null;
  factoryLicenseNo: string;
  lastModifiedAt: Date;
  managerName: string | null;
  powerCapacityHP: number | null;
  ubid: string;
  workerLimit: number | null;
}): MockEsurakshateFactory {
  return {
    factoryLicenseNo: record.factoryLicenseNo,
    ubid: record.ubid,
    businessName: record.businessName,
    factoryAddress: record.factoryAddress ?? undefined,
    managerName: record.managerName ?? undefined,
    employeeCount: record.employeeCount ?? undefined,
    workerLimit: record.workerLimit ?? undefined,
    powerCapacityHP: record.powerCapacityHP ?? undefined,
    lastModified: record.lastModifiedAt.toISOString(),
  };
}

function applyCanonicalPayload(
  current: MockEsurakshateFactory,
  payload: CanonicalPayload,
): MockEsurakshateFactory {
  return {
    ...current,
    ...(payload.businessName !== undefined ? { businessName: payload.businessName } : {}),
    ...(payload.registeredAddress !== undefined
      ? { factoryAddress: addressToFlatString(payload.registeredAddress) }
      : {}),
    ...(payload.authorizedSignatory?.name !== undefined
      ? { managerName: payload.authorizedSignatory.name }
      : {}),
    ...(payload.employeeCount !== undefined ? { employeeCount: payload.employeeCount } : {}),
    ...(payload.workerLimit !== undefined ? { workerLimit: payload.workerLimit } : {}),
    ...(payload.powerCapacityHP !== undefined ? { powerCapacityHP: payload.powerCapacityHP } : {}),
  };
}

function buildSnapshotPayload(factory: MockEsurakshateFactory) {
  return {
    FactorySnapshot: {
      BusinessName: factory.businessName,
      EmployeeCount: factory.employeeCount,
      FactoryAddress: factory.factoryAddress,
      FactoryLicenseNo: factory.factoryLicenseNo,
      LastModified: factory.lastModified,
      ManagerName: factory.managerName,
      PowerCapacityHP: factory.powerCapacityHP,
      Ubid: factory.ubid,
      WorkerLimit: factory.workerLimit,
    },
  };
}

function buildSnapshotXml(factory: MockEsurakshateFactory) {
  return buildFactoryXml(buildSnapshotPayload(factory));
}

function buildLastChangeMetadata(
  input: {
    changeSource: EsurakshateChangeSource;
    changedFields: string[];
    correlationId?: string;
    operation?: OperationType;
    remarks?: string;
    serviceType?: ServiceType;
    updatedBy?: string;
  },
): LastChangeMetadata {
  return {
    changeId: createRecordId("ESCHG"),
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
  factory: MockEsurakshateFactory,
  lastChange: LastChangeMetadata,
): Prisma.InputJsonValue {
  const rawPayload = parseJsonObject(existingRawPayload);

  return toJsonValue({
    ...rawPayload,
    ubid: factory.ubid,
    Ubid: factory.ubid,
    factoryLicenseNo: factory.factoryLicenseNo,
    FactoryLicenseNo: factory.factoryLicenseNo,
    businessName: factory.businessName,
    BusinessName: factory.businessName,
    factoryAddress: factory.factoryAddress,
    FactoryAddress: factory.factoryAddress,
    managerName: factory.managerName,
    ManagerName: factory.managerName,
    employeeCount: factory.employeeCount,
    EmployeeCount: factory.employeeCount,
    workerLimit: factory.workerLimit,
    WorkerLimit: factory.workerLimit,
    powerCapacityHP: factory.powerCapacityHP,
    PowerCapacityHP: factory.powerCapacityHP,
    licenseExpiry:
      typeof rawPayload.licenseExpiry === "string"
        ? rawPayload.licenseExpiry
        : typeof rawPayload.LicenseExpiry === "string"
          ? rawPayload.LicenseExpiry
          : undefined,
    LicenseExpiry:
      typeof rawPayload.licenseExpiry === "string"
        ? rawPayload.licenseExpiry
        : typeof rawPayload.LicenseExpiry === "string"
          ? rawPayload.LicenseExpiry
          : undefined,
    lastChange,
  });
}

function toChangeRecord(record: {
  factoryLicenseNo: string;
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
    changeId: parsedLastChange?.changeId ?? `ESCHG-${record.factoryLicenseNo}-${record.lastModifiedAt.getTime()}`,
    ubid: record.ubid,
    factoryLicenseNo: record.factoryLicenseNo,
    operation: parsedLastChange?.operation,
    serviceType: parsedLastChange?.serviceType,
    changeSource: parsedLastChange?.changeSource ?? "MANUAL_UPDATE",
    changedFields: parsedLastChange?.changedFields ?? [],
    updatedBy: parsedLastChange?.updatedBy,
    remarks: parsedLastChange?.remarks,
    lastModified: record.lastModifiedAt.toISOString(),
  };
}

async function findByFactoryLicenseNoOrThrow(factoryLicenseNo: string) {
  const factory = await prisma.mockEsurakshateRecord.findUnique({
    where: { factoryLicenseNo },
  });

  if (!factory) {
    throw new AppError({
      code: ERROR_CODES.NOT_FOUND,
      message: `Mock e-Surakshate factory not found for license ${factoryLicenseNo}.`,
      statusCode: 404,
    });
  }

  return factory;
}

async function findByUbidOrThrow(ubid: string) {
  const factory = await prisma.mockEsurakshateRecord.findFirst({
    where: { ubid },
  });

  if (!factory) {
    throw new AppError({
      code: ERROR_CODES.NOT_FOUND,
      message: `Mock e-Surakshate factory not found for UBID ${ubid}.`,
      statusCode: 404,
    });
  }

  return factory;
}

export async function getMockEsurakshateStatus() {
  const seededFactories = await prisma.mockEsurakshateRecord.count();

  return {
    message: "Mock e-Surakshate PostgreSQL API is ready.",
    module: "mock-esurakshate",
    seededFactories,
    status: MODULE_STATUS,
  };
}

export async function getFactoryByLicenseNo(factoryLicenseNo: string) {
  return toFactory(await findByFactoryLicenseNoOrThrow(factoryLicenseNo));
}

export async function amendFactoryByLicenseNo(
  factoryLicenseNo: string,
  input: EsurakshateAmendmentInput,
) {
  const existingRecord = await findByFactoryLicenseNoOrThrow(factoryLicenseNo);
  const current = toFactory(existingRecord);
  const amended: MockEsurakshateFactory = {
    ...current,
    ...(input.businessName !== undefined ? { businessName: input.businessName } : {}),
    ...(input.factoryAddress !== undefined ? { factoryAddress: input.factoryAddress } : {}),
    ...(input.managerName !== undefined ? { managerName: input.managerName } : {}),
    ...(input.employeeCount !== undefined ? { employeeCount: input.employeeCount } : {}),
    ...(input.workerLimit !== undefined ? { workerLimit: input.workerLimit } : {}),
    ...(input.powerCapacityHP !== undefined ? { powerCapacityHP: input.powerCapacityHP } : {}),
  };
  const updatedAt = getNow();
  amended.lastModified = updatedAt.toISOString();

  const changedFields = Object.entries(input)
    .filter(([, value]) => value !== undefined)
    .map(([key]) => key);
  const change = buildLastChangeMetadata({
    changeSource: "AMENDMENT",
    changedFields,
    operation: "UPDATE",
  });

  const updatedRecord = await prisma.mockEsurakshateRecord.update({
    where: { factoryLicenseNo },
    data: {
      businessName: amended.businessName,
      factoryAddress: amended.factoryAddress ?? null,
      managerName: amended.managerName ?? null,
      employeeCount: amended.employeeCount ?? null,
      workerLimit: amended.workerLimit ?? null,
      powerCapacityHP: amended.powerCapacityHP ?? null,
      snapshotXml: buildSnapshotXml(amended),
      rawPayload: buildRawPayload(existingRecord.rawPayload, amended, change),
      lastModifiedAt: updatedAt,
    },
  });

  return {
    change: toChangeRecord(updatedRecord),
    factory: toFactory(updatedRecord),
  };
}

export async function manuallyUpdateFactory(input: EsurakshateManualUpdateInput) {
  const existingRecord = await findByUbidOrThrow(input.ubid);
  const current = toFactory(existingRecord);
  const updatedFactory = applyCanonicalPayload(current, input.payload);
  const updatedAt = getNow();
  updatedFactory.lastModified = updatedAt.toISOString();

  const change = buildLastChangeMetadata({
    changeSource: "MANUAL_UPDATE",
    changedFields: input.changedFields,
    correlationId: input.correlationId,
    operation: input.operation,
    remarks: input.remarks,
    serviceType: input.serviceType,
    updatedBy: input.updatedBy,
  });

  const updatedRecord = await prisma.mockEsurakshateRecord.update({
    where: { factoryLicenseNo: existingRecord.factoryLicenseNo },
    data: {
      businessName: updatedFactory.businessName,
      factoryAddress: updatedFactory.factoryAddress ?? null,
      managerName: updatedFactory.managerName ?? null,
      employeeCount: updatedFactory.employeeCount ?? null,
      workerLimit: updatedFactory.workerLimit ?? null,
      powerCapacityHP: updatedFactory.powerCapacityHP ?? null,
      snapshotXml: buildSnapshotXml(updatedFactory),
      rawPayload: buildRawPayload(existingRecord.rawPayload, updatedFactory, change),
      lastModifiedAt: updatedAt,
    },
  });

  return {
    change: toChangeRecord(updatedRecord),
    factory: toFactory(updatedRecord),
  };
}

export async function buildFactorySnapshot(factoryLicenseNo: string) {
  const factory = toFactory(await findByFactoryLicenseNoOrThrow(factoryLicenseNo));
  const snapshotXml = buildSnapshotXml(factory);

  return {
    factory: clone(factory),
    snapshotXml,
  };
}
