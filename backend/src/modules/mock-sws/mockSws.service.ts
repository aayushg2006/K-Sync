import { nanoid } from "nanoid";
import { Prisma } from "@prisma/client";

import { AppError } from "../../common/errors/AppError";
import { ERROR_CODES } from "../../common/errors/errorCodes";
import type {
  AuthorizedSignatory,
  CanonicalPayload,
  CanonicalPayloadField,
  RegisteredAddress,
} from "../../common/types/event.types";
import type { OperationType, ServiceType } from "../../common/types/system.types";
import { MODULE_STATUS } from "../../config/constants";
import prisma from "../../config/prisma";
import type { MockServiceRequestRecord, MockSwsBusiness } from "../../common/utils/mockSystemStore";

interface SwsServiceRequestInput {
  correlationId: string;
  changedFields: CanonicalPayloadField[];
  operation: OperationType;
  payload: CanonicalPayload;
  requestedAt?: string;
  serviceType: ServiceType;
  sourceRequestId: string;
  ubid: string;
}

interface SwsBusinessUpdateInput {
  businessName?: string;
  payload?: CanonicalPayload;
  sourceRequestId?: string;
}

type RawObject = Record<string, unknown>;

function clone<T>(value: T): T {
  return structuredClone(value);
}

function getNow() {
  return new Date();
}

function createRecordId(prefix: string) {
  return `${prefix}-${nanoid(8)}`;
}

function parseJsonObject(value: Prisma.JsonValue | null): RawObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return clone(value as RawObject);
}

function parseJsonField<T>(value: Prisma.JsonValue | null): T | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  return clone(value as T);
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function toMockSwsBusiness(record: {
  authorizedSignatory: Prisma.JsonValue | null;
  businessName: string;
  employeeCount: number | null;
  factoryLicenseNo: string | null;
  labourRegNo: string | null;
  lastModifiedAt: Date;
  licenseExpiry: string | null;
  powerCapacityHP: number | null;
  registeredAddress: Prisma.JsonValue | null;
  sourceRequestId: string | null;
  ubid: string;
  workerLimit: number | null;
}): MockSwsBusiness {
  return {
    ubid: record.ubid,
    businessName: record.businessName,
    labourRegNo: record.labourRegNo ?? undefined,
    factoryLicenseNo: record.factoryLicenseNo ?? undefined,
    sourceRequestId: record.sourceRequestId ?? undefined,
    registeredAddress: parseJsonField<RegisteredAddress>(record.registeredAddress),
    authorizedSignatory: parseJsonField<AuthorizedSignatory>(record.authorizedSignatory),
    employeeCount: record.employeeCount ?? undefined,
    workerLimit: record.workerLimit ?? undefined,
    powerCapacityHP: record.powerCapacityHP ?? undefined,
    licenseExpiry: record.licenseExpiry ?? undefined,
    lastModified: record.lastModifiedAt.toISOString(),
  };
}

function applyCanonicalPayload(
  current: MockSwsBusiness,
  payload: CanonicalPayload,
): MockSwsBusiness {
  return {
    ...current,
    ...(payload.businessName !== undefined ? { businessName: payload.businessName } : {}),
    ...(payload.registeredAddress !== undefined ? { registeredAddress: payload.registeredAddress } : {}),
    ...(payload.authorizedSignatory !== undefined ? { authorizedSignatory: payload.authorizedSignatory } : {}),
    ...(payload.employeeCount !== undefined ? { employeeCount: payload.employeeCount } : {}),
    ...(payload.workerLimit !== undefined ? { workerLimit: payload.workerLimit } : {}),
    ...(payload.powerCapacityHP !== undefined ? { powerCapacityHP: payload.powerCapacityHP } : {}),
    ...(payload.licenseExpiry !== undefined ? { licenseExpiry: payload.licenseExpiry } : {}),
  };
}

function toPrismaUpdateData(
  current: MockSwsBusiness,
  payload?: CanonicalPayload,
  options?: {
    businessName?: string;
    lastModifiedAt?: Date;
    rawPayload?: Prisma.InputJsonValue;
    sourceRequestId?: string;
  },
): Prisma.MockSwsRecordUpdateInput {
  const next = payload ? applyCanonicalPayload(current, payload) : current;

  if (options?.businessName !== undefined) {
    next.businessName = options.businessName;
  }

  if (options?.sourceRequestId !== undefined) {
    next.sourceRequestId = options.sourceRequestId;
  }

  return {
    businessName: next.businessName,
    labourRegNo: next.labourRegNo,
    factoryLicenseNo: next.factoryLicenseNo,
    sourceRequestId: next.sourceRequestId,
    registeredAddress: next.registeredAddress ? toJsonValue(next.registeredAddress) : Prisma.JsonNull,
    authorizedSignatory: next.authorizedSignatory ? toJsonValue(next.authorizedSignatory) : Prisma.JsonNull,
    employeeCount: next.employeeCount ?? null,
    workerLimit: next.workerLimit ?? null,
    powerCapacityHP: next.powerCapacityHP ?? null,
    licenseExpiry: next.licenseExpiry ?? null,
    rawPayload: options?.rawPayload ?? undefined,
    lastModifiedAt: options?.lastModifiedAt ?? getNow(),
  };
}

async function findBusinessRecordOrThrow(ubid: string) {
  const business = await prisma.mockSwsRecord.findUnique({
    where: { ubid },
  });

  if (!business) {
    throw new AppError({
      code: ERROR_CODES.NOT_FOUND,
      message: `Mock SWS business not found for UBID ${ubid}.`,
      statusCode: 404,
    });
  }

  return business;
}

function buildRequestRecord(
  input: SwsServiceRequestInput,
  requestedAt: Date,
): MockServiceRequestRecord {
  return {
    requestId: createRecordId("SWSREQ"),
    correlationId: input.correlationId,
    ubid: input.ubid,
    serviceType: input.serviceType,
    operation: input.operation,
    changedFields: input.changedFields,
    lastModified: requestedAt.toISOString(),
    sourceRequestId: input.sourceRequestId,
  };
}

function buildRawPayloadWithRequest(
  existingRawPayload: Prisma.JsonValue | null,
  business: MockSwsBusiness,
  request: MockServiceRequestRecord,
): Prisma.InputJsonValue {
  const rawPayload = parseJsonObject(existingRawPayload);

  return toJsonValue({
    ...rawPayload,
    businessId:
      typeof rawPayload.businessId === "string"
        ? rawPayload.businessId
        : `SWS-BIZ-${business.ubid.slice(-4)}`,
    lastRequest: request,
    pan: typeof rawPayload.pan === "string" ? rawPayload.pan : undefined,
    registeredAddress: business.registeredAddress,
    authorizedSignatory: business.authorizedSignatory,
    businessName: business.businessName,
    employeeCount: business.employeeCount,
    workerLimit: business.workerLimit,
    powerCapacityHP: business.powerCapacityHP,
    licenseExpiry: business.licenseExpiry,
  });
}

export async function getMockSwsStatus() {
  const seededBusinesses = await prisma.mockSwsRecord.count();

  return {
    message: "Mock SWS PostgreSQL API is ready.",
    module: "mock-sws",
    seededBusinesses,
    status: MODULE_STATUS,
  };
}

export async function listMockSwsBusinesses() {
  const businesses = await prisma.mockSwsRecord.findMany({
    orderBy: { ubid: "asc" },
  });

  return businesses.map((business) => toMockSwsBusiness(business));
}

export async function getMockSwsBusinessByUbid(ubid: string) {
  return toMockSwsBusiness(await findBusinessRecordOrThrow(ubid));
}

export async function updateMockSwsBusiness(ubid: string, input: SwsBusinessUpdateInput) {
  const existingRecord = await findBusinessRecordOrThrow(ubid);
  const current = toMockSwsBusiness(existingRecord);
  const updatedAt = getNow();
  const mergedBusiness = applyCanonicalPayload(current, input.payload ?? {});

  if (input.businessName !== undefined) {
    mergedBusiness.businessName = input.businessName;
  }

  if (input.sourceRequestId !== undefined) {
    mergedBusiness.sourceRequestId = input.sourceRequestId;
  }

  const updatedRecord = await prisma.mockSwsRecord.update({
    where: { ubid },
    data: toPrismaUpdateData(current, input.payload, {
      businessName: input.businessName,
      lastModifiedAt: updatedAt,
      rawPayload: buildRawPayloadWithRequest(
        existingRecord.rawPayload,
        mergedBusiness,
        {
          requestId: createRecordId("SWSUPD"),
          correlationId: "MANUAL-SWS-UPDATE",
          ubid,
          serviceType: "REGISTERED_ADDRESS_CHANGE",
          operation: "UPDATE",
          changedFields: Object.keys(input.payload ?? {}) as CanonicalPayloadField[],
          lastModified: updatedAt.toISOString(),
          sourceRequestId: input.sourceRequestId ?? current.sourceRequestId ?? "MANUAL-SWS-UPDATE",
        },
      ),
      sourceRequestId: input.sourceRequestId,
    }),
  });

  return toMockSwsBusiness(updatedRecord);
}

export async function createMockSwsServiceRequest(input: SwsServiceRequestInput) {
  const requestedAt = input.requestedAt ? new Date(input.requestedAt) : getNow();
  const requestRecord = buildRequestRecord(input, requestedAt);

  if (input.operation === "DELETE") {
    await findBusinessRecordOrThrow(input.ubid);

    await prisma.mockSwsRecord.delete({
      where: { ubid: input.ubid },
    });

    return {
      deletedUbid: input.ubid,
      request: clone(requestRecord),
    };
  }

  const existingRecord = await prisma.mockSwsRecord.findUnique({
    where: { ubid: input.ubid },
  });

  if (!existingRecord) {
    const createdBusiness: MockSwsBusiness = applyCanonicalPayload(
      {
        ubid: input.ubid,
        businessName: input.payload.businessName ?? `New business ${input.ubid}`,
        lastModified: requestedAt.toISOString(),
        sourceRequestId: input.sourceRequestId,
      },
      input.payload,
    );

    createdBusiness.sourceRequestId = input.sourceRequestId;
    createdBusiness.lastModified = requestedAt.toISOString();

    const createdRecord = await prisma.mockSwsRecord.create({
      data: {
        ubid: createdBusiness.ubid,
        businessName: createdBusiness.businessName,
        labourRegNo: createdBusiness.labourRegNo ?? null,
        factoryLicenseNo: createdBusiness.factoryLicenseNo ?? null,
        sourceRequestId: createdBusiness.sourceRequestId ?? null,
        registeredAddress: createdBusiness.registeredAddress
          ? toJsonValue(createdBusiness.registeredAddress)
          : Prisma.JsonNull,
        authorizedSignatory: createdBusiness.authorizedSignatory
          ? toJsonValue(createdBusiness.authorizedSignatory)
          : Prisma.JsonNull,
        employeeCount: createdBusiness.employeeCount ?? null,
        workerLimit: createdBusiness.workerLimit ?? null,
        powerCapacityHP: createdBusiness.powerCapacityHP ?? null,
        licenseExpiry: createdBusiness.licenseExpiry ?? null,
        rawPayload: buildRawPayloadWithRequest(null, createdBusiness, requestRecord),
        lastModifiedAt: requestedAt,
      },
    });

    return {
      business: toMockSwsBusiness(createdRecord),
      request: clone(requestRecord),
    };
  }

  const current = toMockSwsBusiness(existingRecord);
  const mergedBusiness = applyCanonicalPayload(current, input.payload);
  mergedBusiness.sourceRequestId = input.sourceRequestId;
  mergedBusiness.lastModified = requestedAt.toISOString();

  const updatedRecord = await prisma.mockSwsRecord.update({
    where: { ubid: input.ubid },
    data: toPrismaUpdateData(current, input.payload, {
      lastModifiedAt: requestedAt,
      rawPayload: buildRawPayloadWithRequest(existingRecord.rawPayload, mergedBusiness, requestRecord),
      sourceRequestId: input.sourceRequestId,
    }),
  });

  return {
    business: toMockSwsBusiness(updatedRecord),
    request: clone(requestRecord),
  };
}
