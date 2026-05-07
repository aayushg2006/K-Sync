import { MappingStatus } from "@prisma/client";

import { AppError } from "../../common/errors/AppError";
import { ERROR_CODES } from "../../common/errors/errorCodes";
import { ServiceType, SystemName } from "../../common/types/system.types";
import prisma from "../../config/prisma";

export interface ActiveSchemaMapping {
  mappingExpression: string;
  mappingId: string;
  serviceType: ServiceType;
  sourceSystem: SystemName;
  targetSystem: SystemName;
  version: number;
}

export async function getActiveMapping(
  sourceSystem: SystemName,
  targetSystem: SystemName,
  serviceType: ServiceType,
): Promise<ActiveSchemaMapping> {
  const mapping = await prisma.schemaMapping.findFirst({
    where: {
      serviceType,
      sourceSystem,
      status: MappingStatus.ACTIVE,
      targetSystem,
    },
    orderBy: [{ version: "desc" }, { updatedAt: "desc" }],
    select: {
      mappingExpression: true,
      mappingId: true,
      serviceType: true,
      sourceSystem: true,
      targetSystem: true,
      version: true,
    },
  });

  if (!mapping) {
    throw new AppError({
      code: ERROR_CODES.NOT_FOUND,
      details: {
        serviceType,
        sourceSystem,
        status: MappingStatus.ACTIVE,
        targetSystem,
      },
      message: `No active schema mapping found for ${sourceSystem} -> ${targetSystem} ${serviceType}.`,
      statusCode: 404,
    });
  }

  return mapping;
}
