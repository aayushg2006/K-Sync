import { Prisma } from "@prisma/client";

import { AppError } from "../../common/errors/AppError";
import { ERROR_CODES } from "../../common/errors/errorCodes";
import { CanonicalEvent } from "../../common/types/event.types";
import prisma from "../../config/prisma";
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

type SwsTranslatedPayload = {
  authorizedSignatory?: {
    designation?: string;
    email?: string;
    mobile?: string;
    name?: string;
  };
  businessName?: string;
  employeeCount?: number;
  licenseExpiry?: string;
  powerCapacityHP?: number;
  registeredAddress?: Record<string, unknown>;
  workerLimit?: number;
};

function mergeNestedObject(
  baseValue: unknown,
  nextValue: unknown,
) {
  if (
    baseValue &&
    nextValue &&
    typeof baseValue === "object" &&
    typeof nextValue === "object" &&
    !Array.isArray(baseValue) &&
    !Array.isArray(nextValue)
  ) {
    return {
      ...(baseValue as Record<string, unknown>),
      ...(nextValue as Record<string, unknown>),
    };
  }

  return nextValue ?? baseValue;
}

function getUpdatedFields(
  event: CanonicalEvent,
  translatedPayload: SwsTranslatedPayload,
) {
  const fields: string[] = [];

  if (
    event.changedFields.includes("businessName") &&
    translatedPayload.businessName !== undefined
  ) {
    fields.push("businessName");
  }

  if (
    event.changedFields.includes("registeredAddress") &&
    translatedPayload.registeredAddress !== undefined
  ) {
    fields.push("registeredAddress");
  }

  if (
    event.changedFields.includes("authorizedSignatory") &&
    translatedPayload.authorizedSignatory !== undefined
  ) {
    fields.push("authorizedSignatory");
  }

  if (
    event.changedFields.includes("employeeCount") &&
    translatedPayload.employeeCount !== undefined
  ) {
    fields.push("employeeCount");
  }

  if (
    event.changedFields.includes("workerLimit") &&
    translatedPayload.workerLimit !== undefined
  ) {
    fields.push("workerLimit");
  }

  if (
    event.changedFields.includes("powerCapacityHP") &&
    translatedPayload.powerCapacityHP !== undefined
  ) {
    fields.push("powerCapacityHP");
  }

  if (
    event.changedFields.includes("licenseExpiry") &&
    translatedPayload.licenseExpiry !== undefined
  ) {
    fields.push("licenseExpiry");
  }

  return fields;
}

export const swsAdapter: DepartmentAdapter = {
  targetSystem: "SWS",

  confirm(result: AdapterWriteResult) {
    return result;
  },

  async translate(
    event: CanonicalEvent,
    _target: AdapterTarget,
  ): Promise<TranslationResult<SwsTranslatedPayload>> {
    const sourcePayload = await getSourcePayloadForTranslation(event);

    return translate<SwsTranslatedPayload>(
      event.sourceSystem,
      "SWS",
      event.serviceType,
      sourcePayload,
    );
  },

  validateTarget(_event: CanonicalEvent, target: AdapterTarget) {
    if (!target.localIdentifier) {
      throw new AppError({
        code: ERROR_CODES.NOT_FOUND,
        message: "SWS target mapping is missing a business identifier.",
        statusCode: 404,
      });
    }
  },

  async write(
    translatedPayload: unknown,
    target: AdapterTarget,
    event: CanonicalEvent,
  ): Promise<AdapterWriteResult> {
    const payload = translatedPayload as SwsTranslatedPayload;
    const existingRecord = await prisma.mockSwsRecord.findUnique({
      where: { ubid: target.ubid },
      select: {
        authorizedSignatory: true,
        businessName: true,
        employeeCount: true,
        factoryLicenseNo: true,
        labourRegNo: true,
        licenseExpiry: true,
        powerCapacityHP: true,
        rawPayload: true,
        registeredAddress: true,
        sourceRequestId: true,
        ubid: true,
        workerLimit: true,
      },
    });

    if (!existingRecord) {
      throw new AppError({
        code: ERROR_CODES.NOT_FOUND,
        message: `Mock SWS business not found for UBID ${target.ubid}.`,
        statusCode: 404,
      });
    }

    const updatedFields = getUpdatedFields(event, payload);
    const rawPayload = parseJsonObject(existingRecord.rawPayload);
    const updateData: Prisma.MockSwsRecordUpdateInput = {
      lastModifiedAt: new Date(),
    };

    if (updatedFields.includes("businessName")) {
      updateData.businessName = payload.businessName ?? existingRecord.businessName;
      rawPayload.businessName = updateData.businessName;
    }

    if (updatedFields.includes("registeredAddress")) {
      updateData.registeredAddress = payload.registeredAddress
        ? toJsonValue(payload.registeredAddress)
        : Prisma.JsonNull;
      rawPayload.registeredAddress = payload.registeredAddress;
    }

    if (updatedFields.includes("authorizedSignatory")) {
      const mergedSignatory = mergeNestedObject(
        parseJsonObject(existingRecord.authorizedSignatory),
        payload.authorizedSignatory,
      );
      updateData.authorizedSignatory = toJsonValue(mergedSignatory);
      rawPayload.authorizedSignatory = mergedSignatory;
    }

    if (updatedFields.includes("employeeCount")) {
      updateData.employeeCount = payload.employeeCount ?? null;
      rawPayload.employeeCount = payload.employeeCount;
    }

    if (updatedFields.includes("workerLimit")) {
      updateData.workerLimit = payload.workerLimit ?? null;
      rawPayload.workerLimit = payload.workerLimit;
    }

    if (updatedFields.includes("powerCapacityHP")) {
      updateData.powerCapacityHP = payload.powerCapacityHP ?? null;
      rawPayload.powerCapacityHP = payload.powerCapacityHP;
    }

    if (updatedFields.includes("licenseExpiry")) {
      updateData.licenseExpiry = payload.licenseExpiry ?? null;
      rawPayload.licenseExpiry = payload.licenseExpiry;
    }

    rawPayload.lastPropagation = {
      appliedAt: new Date().toISOString(),
      eventId: event.eventId,
      sourceSystem: event.sourceSystem,
      serviceType: event.serviceType,
      targetSystem: target.targetSystem,
    };
    updateData.rawPayload = toJsonValue(rawPayload);

    await prisma.mockSwsRecord.update({
      where: { ubid: target.ubid },
      data: updateData,
    });

    return {
      localIdentifier: target.localIdentifier,
      metadata: {
        businessId: target.localIdentifier,
        ubid: target.ubid,
      },
      targetSystem: "SWS",
      updatedFields,
    };
  },
};
