import { MappingStatus, MappingType } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AppError } from "../common/errors/AppError";
import { ERROR_CODES } from "../common/errors/errorCodes";
import prisma from "../config/prisma";
import {
  translate,
  translateEsurakshateToSws,
  translateSwsToEkarmika,
  translateSwsToEsurakshate,
} from "../modules/translation/translation.service";

const invalidMappingId = "map_translation_invalid_test_v1";

describe("translation.service", () => {
  beforeAll(async () => {
    await prisma.schemaMapping.deleteMany({
      where: {
        mappingId: invalidMappingId,
      },
    });
  });

  afterAll(async () => {
    await prisma.schemaMapping.deleteMany({
      where: {
        mappingId: invalidMappingId,
      },
    });

    await prisma.$disconnect();
  });

  it("maps SWS registeredAddress to e-Karmika addressFull", async () => {
    const result = await translateSwsToEkarmika<{
      addressFull: string;
    }>(
      {
        authorizedSignatory: {
          name: "Asha Rao",
        },
        businessName: "Acme Industries",
        employeeCount: 120,
        powerCapacityHP: 45,
        registeredAddress: {
          city: "Bengaluru",
          line1: "42 Residency Road",
          postalCode: "560025",
          state: "Karnataka",
        },
        workerLimit: 160,
      },
      "REGISTERED_ADDRESS_CHANGE",
    );

    expect(result.mappingId).toBe("map_sws_to_ekarmika_v1");
    expect(result.version).toBe(1);
    expect(result.translatedPayload.addressFull).toBe(
      "42 Residency Road, Bengaluru, Karnataka, 560025",
    );
  });

  it("maps SWS registeredAddress to e-Surakshate FactoryAddress", async () => {
    const result = await translateSwsToEsurakshate<{
      FactoryAddress: string;
    }>(
      {
        authorizedSignatory: {
          name: "Asha Rao",
        },
        businessName: "Acme Industries",
        employeeCount: 120,
        powerCapacityHP: 45,
        registeredAddress: {
          city: "Bengaluru",
          line1: "42 Residency Road",
          postalCode: "560025",
          state: "Karnataka",
        },
        workerLimit: 160,
      },
      "REGISTERED_ADDRESS_CHANGE",
    );

    expect(result.mappingId).toBe("map_sws_to_esurakshate_v1");
    expect(result.version).toBe(1);
    expect(result.translatedPayload.FactoryAddress).toBe(
      "42 Residency Road, Bengaluru, Karnataka, 560025",
    );
  });

  it("maps e-Surakshate ManagerName to SWS authorizedSignatory.name", async () => {
    const result = await translateEsurakshateToSws<{
      authorizedSignatory: {
        name: string;
      };
    }>(
      {
        BusinessName: "Metro Castings",
        EmployeeCount: 84,
        FactoryAddress: "Plot 18, Peenya Industrial Area",
        ManagerName: "Ravi Kumar",
        PowerCapacityHP: 60,
        WorkerLimit: 110,
      },
      "AUTHORIZED_SIGNATORY_CHANGE",
    );

    expect(result.mappingId).toBe("map_esurakshate_to_sws_v1");
    expect(result.version).toBe(1);
    expect(result.translatedPayload.authorizedSignatory.name).toBe("Ravi Kumar");
  });

  it("produces a controlled error for an invalid mapping", async () => {
    await prisma.schemaMapping.create({
      data: {
        mappingExpression: "invalid(",
        mappingId: invalidMappingId,
        mappingType: MappingType.JSONATA,
        serviceType: "POWER_CAPACITY_CHANGE",
        sourceSystem: "SWS",
        status: MappingStatus.ACTIVE,
        targetSystem: "KSYNC",
        version: 1,
      },
    });

    await expect(
      translate("SWS", "KSYNC", "POWER_CAPACITY_CHANGE", {
        powerCapacityHP: 75,
      }),
    ).rejects.toMatchObject({
      code: ERROR_CODES.INTERNAL_SERVER_ERROR,
      message: "Failed to evaluate schema mapping.",
      statusCode: 500,
    } satisfies Partial<AppError>);

    await prisma.schemaMapping.deleteMany({
      where: {
        mappingId: invalidMappingId,
      },
    });
  });
});
