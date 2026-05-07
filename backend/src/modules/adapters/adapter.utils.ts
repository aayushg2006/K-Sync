import { Prisma } from "@prisma/client";

import { AppError } from "../../common/errors/AppError";
import { ERROR_CODES } from "../../common/errors/errorCodes";
import { CanonicalEvent } from "../../common/types/event.types";
import prisma from "../../config/prisma";

type JsonObject = Record<string, unknown>;

function clone<T>(value: T): T {
  return structuredClone(value);
}

export function parseJsonObject(value: Prisma.JsonValue | null): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return clone(value as JsonObject);
}

export function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function mergeNestedObject(
  baseValue: unknown,
  patchValue: unknown,
): unknown {
  if (
    baseValue &&
    patchValue &&
    typeof baseValue === "object" &&
    typeof patchValue === "object" &&
    !Array.isArray(baseValue) &&
    !Array.isArray(patchValue)
  ) {
    return {
      ...(baseValue as JsonObject),
      ...(patchValue as JsonObject),
    };
  }

  return patchValue ?? baseValue;
}

export function mergeCanonicalPayloadIntoSourcePayload(
  sourcePayload: JsonObject,
  event: CanonicalEvent,
): JsonObject {
  const mergedPayload: JsonObject = clone(sourcePayload);

  if (event.payload.businessName !== undefined) {
    mergedPayload.businessName = event.payload.businessName;
  }

  if (event.payload.registeredAddress !== undefined) {
    mergedPayload.registeredAddress = mergeNestedObject(
      mergedPayload.registeredAddress,
      event.payload.registeredAddress,
    );
  }

  if (event.payload.authorizedSignatory !== undefined) {
    mergedPayload.authorizedSignatory = mergeNestedObject(
      mergedPayload.authorizedSignatory,
      event.payload.authorizedSignatory,
    );
  }

  if (event.payload.employeeCount !== undefined) {
    mergedPayload.employeeCount = event.payload.employeeCount;
  }

  if (event.payload.workerLimit !== undefined) {
    mergedPayload.workerLimit = event.payload.workerLimit;
  }

  if (event.payload.powerCapacityHP !== undefined) {
    mergedPayload.powerCapacityHP = event.payload.powerCapacityHP;
  }

  if (event.payload.licenseExpiry !== undefined) {
    mergedPayload.licenseExpiry = event.payload.licenseExpiry;
  }

  return mergedPayload;
}

export async function getSourcePayloadForTranslation(
  event: CanonicalEvent,
): Promise<unknown> {
  switch (event.sourceSystem) {
    case "SWS": {
      const sourceRecord = await prisma.mockSwsRecord.findUnique({
        where: { ubid: event.ubid },
        select: {
          rawPayload: true,
        },
      });

      if (!sourceRecord) {
        throw new AppError({
          code: ERROR_CODES.NOT_FOUND,
          message: `Source SWS record not found for UBID ${event.ubid}.`,
          statusCode: 404,
        });
      }

      return mergeCanonicalPayloadIntoSourcePayload(
        parseJsonObject(sourceRecord.rawPayload),
        event,
      );
    }
    case "EKARMIKA": {
      const sourceRecord = await prisma.mockEkarmikaRecord.findFirst({
        where: { ubid: event.ubid },
        select: {
          addressFull: true,
          businessName: true,
          employeeCount: true,
          labourRegNo: true,
          managerName: true,
          powerCapacityHP: true,
          rawPayload: true,
          ubid: true,
          workerLimit: true,
        },
      });

      if (!sourceRecord) {
        throw new AppError({
          code: ERROR_CODES.NOT_FOUND,
          message: `Source e-Karmika record not found for UBID ${event.ubid}.`,
          statusCode: 404,
        });
      }

      const rawPayload = parseJsonObject(sourceRecord.rawPayload);

      if (Object.keys(rawPayload).length > 0) {
        return rawPayload;
      }

      return {
        addressFull: sourceRecord.addressFull ?? undefined,
        businessName: sourceRecord.businessName,
        employeeCount: sourceRecord.employeeCount ?? undefined,
        labourRegNo: sourceRecord.labourRegNo,
        managerName: sourceRecord.managerName ?? undefined,
        powerCapacityHP: sourceRecord.powerCapacityHP ?? undefined,
        ubid: sourceRecord.ubid,
        workerLimit: sourceRecord.workerLimit ?? undefined,
      };
    }
    case "ESURAKSHATE": {
      const sourceRecord = await prisma.mockEsurakshateRecord.findFirst({
        where: { ubid: event.ubid },
        select: {
          businessName: true,
          employeeCount: true,
          factoryAddress: true,
          factoryLicenseNo: true,
          managerName: true,
          powerCapacityHP: true,
          rawPayload: true,
          ubid: true,
          workerLimit: true,
        },
      });

      if (!sourceRecord) {
        throw new AppError({
          code: ERROR_CODES.NOT_FOUND,
          message: `Source e-Surakshate record not found for UBID ${event.ubid}.`,
          statusCode: 404,
        });
      }

      const rawPayload = parseJsonObject(sourceRecord.rawPayload);
      return {
        ...rawPayload,
        BusinessName: sourceRecord.businessName,
        EmployeeCount: sourceRecord.employeeCount ?? rawPayload.EmployeeCount ?? undefined,
        FactoryAddress:
          sourceRecord.factoryAddress ??
          (typeof rawPayload.FactoryAddress === "string"
            ? rawPayload.FactoryAddress
            : undefined),
        FactoryLicenseNo: sourceRecord.factoryLicenseNo,
        ManagerName:
          sourceRecord.managerName ??
          (typeof rawPayload.ManagerName === "string"
            ? rawPayload.ManagerName
            : undefined),
        PowerCapacityHP:
          sourceRecord.powerCapacityHP ?? rawPayload.PowerCapacityHP ?? undefined,
        Ubid: sourceRecord.ubid,
        WorkerLimit: sourceRecord.workerLimit ?? rawPayload.WorkerLimit ?? undefined,
        businessName: sourceRecord.businessName,
        employeeCount: sourceRecord.employeeCount ?? rawPayload.employeeCount ?? undefined,
        factoryAddress:
          sourceRecord.factoryAddress ??
          (typeof rawPayload.factoryAddress === "string"
            ? rawPayload.factoryAddress
            : undefined),
        factoryLicenseNo: sourceRecord.factoryLicenseNo,
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
        managerName:
          sourceRecord.managerName ??
          (typeof rawPayload.managerName === "string"
            ? rawPayload.managerName
            : undefined),
        powerCapacityHP:
          sourceRecord.powerCapacityHP ?? rawPayload.powerCapacityHP ?? undefined,
        ubid: sourceRecord.ubid,
        workerLimit: sourceRecord.workerLimit ?? rawPayload.workerLimit ?? undefined,
      };
    }
    default:
      return event.payload;
  }
}
