import { Prisma } from "@prisma/client";

import { AppError } from "../../common/errors/AppError";
import { ERROR_CODES } from "../../common/errors/errorCodes";
import { CanonicalEvent } from "../../common/types/event.types";
import prisma from "../../config/prisma";
import { consumeSimulatedWriteFailure } from "../scenarios/failure-simulation.service";
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

type EkarmikaTranslatedPayload = {
  addressFull?: string;
  businessName?: string;
  employeeCount?: number;
  employerName?: string;
  managerName?: string;
  powerCapacityHP?: number;
  workerLimit?: number;
};

function getUpdatedFields(
  event: CanonicalEvent,
  translatedPayload: EkarmikaTranslatedPayload,
) {
  const fields: string[] = [];

  if (
    event.changedFields.includes("registeredAddress") &&
    translatedPayload.addressFull !== undefined
  ) {
    fields.push("addressFull");
  }

  if (
    event.changedFields.includes("businessName") &&
    (translatedPayload.employerName !== undefined ||
      translatedPayload.businessName !== undefined)
  ) {
    fields.push("businessName");
  }

  if (
    event.changedFields.includes("authorizedSignatory") &&
    translatedPayload.managerName !== undefined
  ) {
    fields.push("managerName");
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

  return fields;
}

export const ekarmikaAdapter: DepartmentAdapter = {
  targetSystem: "EKARMIKA",

  confirm(result: AdapterWriteResult) {
    return result;
  },

  async translate(
    event: CanonicalEvent,
    _target: AdapterTarget,
  ): Promise<TranslationResult<EkarmikaTranslatedPayload>> {
    const sourcePayload = await getSourcePayloadForTranslation(event);

    return translate<EkarmikaTranslatedPayload>(
      event.sourceSystem,
      "EKARMIKA",
      event.serviceType,
      sourcePayload,
    );
  },

  validateTarget(_event: CanonicalEvent, target: AdapterTarget) {
    if (!target.localIdentifier) {
      throw new AppError({
        code: ERROR_CODES.NOT_FOUND,
        message: "e-Karmika target mapping is missing a labour registration number.",
        statusCode: 404,
      });
    }
  },

  async write(
    translatedPayload: unknown,
    target: AdapterTarget,
    event: CanonicalEvent,
  ): Promise<AdapterWriteResult> {
    const simulatedFailureReason = consumeSimulatedWriteFailure("EKARMIKA", event.ubid);

    if (simulatedFailureReason) {
      throw new Error(simulatedFailureReason);
    }

    const payload = translatedPayload as EkarmikaTranslatedPayload;
    const existingRecord = await prisma.mockEkarmikaRecord.findUnique({
      where: { labourRegNo: target.localIdentifier },
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

    if (!existingRecord) {
      throw new AppError({
        code: ERROR_CODES.NOT_FOUND,
        message: `Mock e-Karmika establishment not found for labour registration ${target.localIdentifier}.`,
        statusCode: 404,
      });
    }

    const updatedFields = getUpdatedFields(event, payload);
    const rawPayload = parseJsonObject(existingRecord.rawPayload);
    const nextBusinessName = payload.employerName ?? payload.businessName ?? existingRecord.businessName;

    const updateData: Prisma.MockEkarmikaRecordUpdateInput = {
      lastModifiedAt: new Date(),
    };

    if (updatedFields.includes("addressFull")) {
      updateData.addressFull = payload.addressFull ?? null;
      rawPayload.addressFull = payload.addressFull;
    }

    if (updatedFields.includes("businessName")) {
      updateData.businessName = nextBusinessName;
      rawPayload.businessName = nextBusinessName;
      rawPayload.employerName = nextBusinessName;
    }

    if (updatedFields.includes("managerName")) {
      updateData.managerName = payload.managerName ?? null;
      rawPayload.managerName = payload.managerName;
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

    rawPayload.lastPropagation = {
      appliedAt: new Date().toISOString(),
      eventId: event.eventId,
      sourceSystem: event.sourceSystem,
      serviceType: event.serviceType,
      targetSystem: target.targetSystem,
    };
    updateData.rawPayload = toJsonValue(rawPayload);

    await prisma.mockEkarmikaRecord.update({
      where: { labourRegNo: target.localIdentifier },
      data: updateData,
    });

    return {
      localIdentifier: target.localIdentifier,
      metadata: {
        labourRegNo: target.localIdentifier,
      },
      targetSystem: "EKARMIKA",
      updatedFields,
    };
  },
};
