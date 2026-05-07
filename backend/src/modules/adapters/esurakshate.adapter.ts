import { Prisma } from "@prisma/client";

import { AppError } from "../../common/errors/AppError";
import { ERROR_CODES } from "../../common/errors/errorCodes";
import { CanonicalEvent } from "../../common/types/event.types";
import prisma from "../../config/prisma";
import { buildFactoryXml } from "../mock-esurakshate/esurakshate.xml";
import { TranslationResult, translate } from "../translation/translation.service";
import {
  AdapterTarget,
  AdapterWriteResult,
  DepartmentAdapter,
} from "./DepartmentAdapter";
import {
  getSourcePayloadForTranslation,
  parseJsonObject,
  toJsonValue,
} from "./adapter.utils";

type EsurakshateTranslatedPayload = {
  BusinessName?: string;
  EmployeeCount?: number;
  FactoryAddress?: string;
  LicenseExpiry?: string;
  ManagerName?: string;
  PowerCapacityHP?: number;
  WorkerLimit?: number;
  businessName?: string;
  employeeCount?: number;
  factoryAddress?: string;
  licenseExpiry?: string;
  managerName?: string;
  powerCapacityHP?: number;
  workerLimit?: number;
};

function getUpdatedFields(
  event: CanonicalEvent,
  translatedPayload: EsurakshateTranslatedPayload,
) {
  const fields: string[] = [];

  if (
    event.changedFields.includes("registeredAddress") &&
    (translatedPayload.FactoryAddress !== undefined ||
      translatedPayload.factoryAddress !== undefined)
  ) {
    fields.push("factoryAddress");
  }

  if (
    event.changedFields.includes("businessName") &&
    (translatedPayload.BusinessName !== undefined ||
      translatedPayload.businessName !== undefined)
  ) {
    fields.push("businessName");
  }

  if (
    event.changedFields.includes("authorizedSignatory") &&
    (translatedPayload.ManagerName !== undefined ||
      translatedPayload.managerName !== undefined)
  ) {
    fields.push("managerName");
  }

  if (
    event.changedFields.includes("employeeCount") &&
    (translatedPayload.EmployeeCount !== undefined ||
      translatedPayload.employeeCount !== undefined)
  ) {
    fields.push("employeeCount");
  }

  if (
    event.changedFields.includes("workerLimit") &&
    (translatedPayload.WorkerLimit !== undefined ||
      translatedPayload.workerLimit !== undefined)
  ) {
    fields.push("workerLimit");
  }

  if (
    event.changedFields.includes("powerCapacityHP") &&
    (translatedPayload.PowerCapacityHP !== undefined ||
      translatedPayload.powerCapacityHP !== undefined)
  ) {
    fields.push("powerCapacityHP");
  }

  if (
    event.changedFields.includes("licenseExpiry") &&
    (translatedPayload.LicenseExpiry !== undefined ||
      translatedPayload.licenseExpiry !== undefined)
  ) {
    fields.push("licenseExpiry");
  }

  return fields;
}

function buildSnapshotXml(rawPayload: Record<string, unknown>) {
  return buildFactoryXml({
    FactorySnapshot: {
      BusinessName: rawPayload.BusinessName ?? rawPayload.businessName,
      EmployeeCount: rawPayload.EmployeeCount ?? rawPayload.employeeCount,
      FactoryAddress: rawPayload.FactoryAddress ?? rawPayload.factoryAddress,
      FactoryLicenseNo: rawPayload.FactoryLicenseNo ?? rawPayload.factoryLicenseNo,
      LastModified: rawPayload.LastModified ?? rawPayload.lastModified ?? new Date().toISOString(),
      LicenseExpiry: rawPayload.LicenseExpiry ?? rawPayload.licenseExpiry,
      ManagerName: rawPayload.ManagerName ?? rawPayload.managerName,
      PowerCapacityHP: rawPayload.PowerCapacityHP ?? rawPayload.powerCapacityHP,
      Ubid: rawPayload.Ubid ?? rawPayload.ubid,
      WorkerLimit: rawPayload.WorkerLimit ?? rawPayload.workerLimit,
    },
  });
}

export const esurakshateAdapter: DepartmentAdapter = {
  targetSystem: "ESURAKSHATE",

  confirm(result: AdapterWriteResult) {
    return result;
  },

  async translate(
    event: CanonicalEvent,
    _target: AdapterTarget,
  ): Promise<TranslationResult<EsurakshateTranslatedPayload>> {
    const sourcePayload = await getSourcePayloadForTranslation(event);

    return translate<EsurakshateTranslatedPayload>(
      event.sourceSystem,
      "ESURAKSHATE",
      event.serviceType,
      sourcePayload,
    );
  },

  validateTarget(_event: CanonicalEvent, target: AdapterTarget) {
    if (!target.localIdentifier) {
      throw new AppError({
        code: ERROR_CODES.NOT_FOUND,
        message: "e-Surakshate target mapping is missing a factory license number.",
        statusCode: 404,
      });
    }
  },

  async write(
    translatedPayload: unknown,
    target: AdapterTarget,
    event: CanonicalEvent,
  ): Promise<AdapterWriteResult> {
    const payload = translatedPayload as EsurakshateTranslatedPayload;
    const existingRecord = await prisma.mockEsurakshateRecord.findUnique({
      where: { factoryLicenseNo: target.localIdentifier },
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

    if (!existingRecord) {
      throw new AppError({
        code: ERROR_CODES.NOT_FOUND,
        message: `Mock e-Surakshate factory not found for license ${target.localIdentifier}.`,
        statusCode: 404,
      });
    }

    const updatedFields = getUpdatedFields(event, payload);
    const rawPayload = parseJsonObject(existingRecord.rawPayload);
    const nextBusinessName = payload.BusinessName ?? payload.businessName ?? existingRecord.businessName;
    const nextFactoryAddress = payload.FactoryAddress ?? payload.factoryAddress;
    const nextManagerName = payload.ManagerName ?? payload.managerName;
    const nextEmployeeCount = payload.EmployeeCount ?? payload.employeeCount;
    const nextWorkerLimit = payload.WorkerLimit ?? payload.workerLimit;
    const nextPowerCapacity = payload.PowerCapacityHP ?? payload.powerCapacityHP;
    const nextLicenseExpiry = payload.LicenseExpiry ?? payload.licenseExpiry;

    const updateData: Prisma.MockEsurakshateRecordUpdateInput = {
      lastModifiedAt: new Date(),
    };

    if (updatedFields.includes("businessName")) {
      updateData.businessName = nextBusinessName;
      rawPayload.BusinessName = nextBusinessName;
      rawPayload.businessName = nextBusinessName;
    }

    if (updatedFields.includes("factoryAddress")) {
      updateData.factoryAddress = nextFactoryAddress ?? null;
      rawPayload.FactoryAddress = nextFactoryAddress;
      rawPayload.factoryAddress = nextFactoryAddress;
    }

    if (updatedFields.includes("managerName")) {
      updateData.managerName = nextManagerName ?? null;
      rawPayload.ManagerName = nextManagerName;
      rawPayload.managerName = nextManagerName;
    }

    if (updatedFields.includes("employeeCount")) {
      updateData.employeeCount = nextEmployeeCount ?? null;
      rawPayload.EmployeeCount = nextEmployeeCount;
      rawPayload.employeeCount = nextEmployeeCount;
    }

    if (updatedFields.includes("workerLimit")) {
      updateData.workerLimit = nextWorkerLimit ?? null;
      rawPayload.WorkerLimit = nextWorkerLimit;
      rawPayload.workerLimit = nextWorkerLimit;
    }

    if (updatedFields.includes("powerCapacityHP")) {
      updateData.powerCapacityHP = nextPowerCapacity ?? null;
      rawPayload.PowerCapacityHP = nextPowerCapacity;
      rawPayload.powerCapacityHP = nextPowerCapacity;
    }

    if (updatedFields.includes("licenseExpiry")) {
      rawPayload.LicenseExpiry = nextLicenseExpiry;
      rawPayload.licenseExpiry = nextLicenseExpiry;
    }

    rawPayload.FactoryLicenseNo = rawPayload.FactoryLicenseNo ?? existingRecord.factoryLicenseNo;
    rawPayload.factoryLicenseNo = rawPayload.factoryLicenseNo ?? existingRecord.factoryLicenseNo;
    rawPayload.Ubid = rawPayload.Ubid ?? existingRecord.ubid;
    rawPayload.ubid = rawPayload.ubid ?? existingRecord.ubid;
    rawPayload.LastModified = new Date().toISOString();
    rawPayload.lastModified = rawPayload.LastModified;
    rawPayload.lastPropagation = {
      appliedAt: rawPayload.LastModified,
      eventId: event.eventId,
      sourceSystem: event.sourceSystem,
      serviceType: event.serviceType,
      targetSystem: target.targetSystem,
    };

    updateData.rawPayload = toJsonValue(rawPayload);
    updateData.snapshotXml = buildSnapshotXml(rawPayload);

    await prisma.mockEsurakshateRecord.update({
      where: { factoryLicenseNo: target.localIdentifier },
      data: updateData,
    });

    return {
      localIdentifier: target.localIdentifier,
      metadata: {
        factoryLicenseNo: target.localIdentifier,
      },
      targetSystem: "ESURAKSHATE",
      updatedFields,
    };
  },
};
