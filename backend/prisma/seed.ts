import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  MappingStatus,
  MappingType,
  Prisma,
  PrismaClient,
  ServiceType,
  SystemName,
} from "@prisma/client";

import { buildFactoryXml } from "../src/modules/mock-esurakshate/esurakshate.xml";

const prisma = new PrismaClient();

type SeedBusiness = {
  authorizedSignatory: {
    designation: string;
    email: string;
    mobile: string;
    name: string;
  };
  businessName: string;
  employeeCount: number;
  factoryLicenseNo?: string;
  lastModifiedAt: Date;
  licenceExpiry?: string;
  labourRegNo?: string;
  pan: string;
  powerCapacityHP: number;
  registeredAddress: {
    city: string;
    line1: string;
    line2?: string;
    postalCode: string;
    state: string;
  };
  sourceRequestId: string;
  swsBusinessId: string;
  ubid: string;
  workerLimit: number;
};

const seedTag = "ksync-demo-seed-v1";

const businesses: SeedBusiness[] = [
  {
    ubid: "UBID-KA-2026-0001",
    businessName: "Pragati Precision Works Pvt Ltd",
    pan: "SYNTH1234A",
    swsBusinessId: "SWS-BIZ-2026-0001",
    sourceRequestId: "SWS-SEED-0001",
    labourRegNo: "LAB-KA-2026-0001",
    factoryLicenseNo: "FAC-KA-2026-0001",
    registeredAddress: {
      line1: "12 Peenya Industrial Area",
      line2: "Phase II",
      city: "Bengaluru",
      state: "Karnataka",
      postalCode: "560058",
    },
    authorizedSignatory: {
      name: "Ananya Kulkarni",
      designation: "Managing Director",
      email: "ananya.kulkarni@example.com",
      mobile: "9000000001",
    },
    employeeCount: 128,
    workerLimit: 180,
    powerCapacityHP: 75,
    licenceExpiry: "2027-03-31",
    lastModifiedAt: new Date("2026-05-01T09:00:00.000Z"),
  },
  {
    ubid: "UBID-KA-2026-0002",
    businessName: "Nandini Retail Traders",
    pan: "SYNTH5678B",
    swsBusinessId: "SWS-BIZ-2026-0002",
    sourceRequestId: "SWS-SEED-0002",
    labourRegNo: "LAB-KA-2026-0002",
    registeredAddress: {
      line1: "88 Mission Street",
      city: "Mysuru",
      state: "Karnataka",
      postalCode: "570001",
    },
    authorizedSignatory: {
      name: "Rohit Hegde",
      designation: "Partner",
      email: "rohit.hegde@example.com",
      mobile: "9000000002",
    },
    employeeCount: 46,
    workerLimit: 60,
    powerCapacityHP: 18,
    lastModifiedAt: new Date("2026-05-01T09:15:00.000Z"),
  },
  {
    ubid: "UBID-KA-2026-0003",
    businessName: "Mysuru Advanced Components LLP",
    pan: "SYNTH9012C",
    swsBusinessId: "SWS-BIZ-2026-0003",
    sourceRequestId: "SWS-SEED-0003",
    factoryLicenseNo: "FAC-KA-2026-0003",
    registeredAddress: {
      line1: "5 Hebbal Industrial Estate",
      line2: "Unit 7",
      city: "Mysuru",
      state: "Karnataka",
      postalCode: "570016",
    },
    authorizedSignatory: {
      name: "Divya Narasimha",
      designation: "Operations Head",
      email: "divya.narasimha@example.com",
      mobile: "9000000003",
    },
    employeeCount: 92,
    workerLimit: 120,
    powerCapacityHP: 54,
    licenceExpiry: "2027-08-15",
    lastModifiedAt: new Date("2026-05-01T09:30:00.000Z"),
  },
];

function getSystemsForBusiness(business: SeedBusiness): SystemName[] {
  const systems: SystemName[] = [SystemName.SWS];

  if (business.labourRegNo) {
    systems.push(SystemName.EKARMIKA);
  }

  if (business.factoryLicenseNo) {
    systems.push(SystemName.ESURAKSHATE);
  }

  return systems;
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function formatAddress(address: SeedBusiness["registeredAddress"]) {
  return [address.line1, address.line2, address.city, address.state, address.postalCode]
    .filter((value) => Boolean(value))
    .join(", ");
}

function buildBusinessMetadata(business: SeedBusiness): Prisma.InputJsonValue {
  return toJsonValue({
    pan: business.pan,
    seedTag,
    systemsPresent: getSystemsForBusiness(business),
  });
}

function buildCanonicalPayload(business: SeedBusiness): Prisma.InputJsonValue {
  return toJsonValue({
    businessName: business.businessName,
    registeredAddress: business.registeredAddress,
    authorizedSignatory: business.authorizedSignatory,
    employeeCount: business.employeeCount,
    workerLimit: business.workerLimit,
    powerCapacityHP: business.powerCapacityHP,
    licenseExpiry: business.licenceExpiry,
  });
}

function buildEkarmikaPayload(business: SeedBusiness): Prisma.InputJsonValue {
  return toJsonValue({
    labourRegNo: business.labourRegNo,
    ubid: business.ubid,
    businessName: business.businessName,
    pan: business.pan,
    addressFull: formatAddress(business.registeredAddress),
    managerName: business.authorizedSignatory.name,
    employeeCount: business.employeeCount,
    workerLimit: business.workerLimit,
    powerCapacityHP: business.powerCapacityHP,
    seedTag,
  });
}

function buildEsurakshatePayload(business: SeedBusiness): Prisma.InputJsonValue {
  return toJsonValue({
    factoryLicenseNo: business.factoryLicenseNo,
    ubid: business.ubid,
    businessName: business.businessName,
    pan: business.pan,
    factoryAddress: formatAddress(business.registeredAddress),
    managerName: business.authorizedSignatory.name,
    employeeCount: business.employeeCount,
    workerLimit: business.workerLimit,
    powerCapacityHP: business.powerCapacityHP,
    licenseExpiry: business.licenceExpiry,
    seedTag,
  });
}

function buildFactorySnapshotXml(business: SeedBusiness) {
  return buildFactoryXml({
    FactorySnapshot: {
      BusinessName: business.businessName,
      EmployeeCount: business.employeeCount,
      FactoryAddress: formatAddress(business.registeredAddress),
      FactoryLicenseNo: business.factoryLicenseNo,
      LastModified: business.lastModifiedAt.toISOString(),
      ManagerName: business.authorizedSignatory.name,
      Pan: business.pan,
      PowerCapacityHP: business.powerCapacityHP,
      Ubid: business.ubid,
      WorkerLimit: business.workerLimit,
    },
  });
}

async function loadMapping(fileName: string) {
  const filePath = path.resolve(__dirname, "../src/modules/translation/mappings", fileName);
  return readFile(filePath, "utf8");
}

async function clearTables() {
  await prisma.auditLog.deleteMany();
  await prisma.idempotencyKey.deleteMany();
  await prisma.queueJob.deleteMany();
  await prisma.deadLetterJob.deleteMany();
  await prisma.manualReviewItem.deleteMany();
  await prisma.conflict.deleteMany();
  await prisma.departmentSnapshot.deleteMany();
  await prisma.canonicalEvent.deleteMany();
  await prisma.schemaMapping.deleteMany();
  await prisma.authorityMatrix.deleteMany();
  await prisma.mockEkarmikaRecord.deleteMany();
  await prisma.mockEsurakshateRecord.deleteMany();
  await prisma.mockSwsRecord.deleteMany();
  await prisma.ubidRegistry.deleteMany();
  await prisma.business.deleteMany();
}

async function seedBusinesses() {
  await prisma.business.createMany({
    data: businesses.map((business) => ({
      ubid: business.ubid,
      businessName: business.businessName,
      labourRegNo: business.labourRegNo,
      factoryLicenseNo: business.factoryLicenseNo,
      sourceRequestId: business.sourceRequestId,
      registeredAddress: toJsonValue(business.registeredAddress),
      authorizedSignatory: toJsonValue(business.authorizedSignatory),
      employeeCount: business.employeeCount,
      workerLimit: business.workerLimit,
      powerCapacityHP: business.powerCapacityHP,
      licenseExpiry: business.licenceExpiry,
      metadata: buildBusinessMetadata(business),
      lastModifiedAt: business.lastModifiedAt,
    })),
  });
}

async function seedMockRecords() {
  await prisma.mockSwsRecord.createMany({
    data: businesses.map((business) => ({
      ubid: business.ubid,
      businessName: business.businessName,
      labourRegNo: business.labourRegNo,
      factoryLicenseNo: business.factoryLicenseNo,
      sourceRequestId: business.sourceRequestId,
      registeredAddress: toJsonValue(business.registeredAddress),
      authorizedSignatory: toJsonValue(business.authorizedSignatory),
      employeeCount: business.employeeCount,
      workerLimit: business.workerLimit,
      powerCapacityHP: business.powerCapacityHP,
      licenseExpiry: business.licenceExpiry,
      rawPayload: toJsonValue({
        businessId: business.swsBusinessId,
        pan: business.pan,
        seedTag,
        ...JSON.parse(JSON.stringify(buildCanonicalPayload(business))),
      }),
      lastModifiedAt: business.lastModifiedAt,
    })),
  });

  const ekarmikaBusinesses = businesses.filter((business) => Boolean(business.labourRegNo));
  await prisma.mockEkarmikaRecord.createMany({
    data: ekarmikaBusinesses.map((business) => ({
      labourRegNo: business.labourRegNo!,
      ubid: business.ubid,
      businessName: business.businessName,
      addressFull: formatAddress(business.registeredAddress),
      managerName: business.authorizedSignatory.name,
      employeeCount: business.employeeCount,
      workerLimit: business.workerLimit,
      powerCapacityHP: business.powerCapacityHP,
      rawPayload: buildEkarmikaPayload(business),
      lastModifiedAt: business.lastModifiedAt,
    })),
  });

  const esurakshateBusinesses = businesses.filter((business) => Boolean(business.factoryLicenseNo));
  await prisma.mockEsurakshateRecord.createMany({
    data: esurakshateBusinesses.map((business) => ({
      factoryLicenseNo: business.factoryLicenseNo!,
      ubid: business.ubid,
      businessName: business.businessName,
      factoryAddress: formatAddress(business.registeredAddress),
      managerName: business.authorizedSignatory.name,
      employeeCount: business.employeeCount,
      workerLimit: business.workerLimit,
      powerCapacityHP: business.powerCapacityHP,
      snapshotXml: buildFactorySnapshotXml(business),
      rawPayload: buildEsurakshatePayload(business),
      lastModifiedAt: business.lastModifiedAt,
    })),
  });
}

async function seedRegistry() {
  const registryRows: Prisma.UbidRegistryCreateManyInput[] = [];

  for (const business of businesses) {
    registryRows.push({
      ubid: business.ubid,
      systemName: SystemName.SWS,
      localIdentifierType: "businessId",
      localIdentifier: business.swsBusinessId,
      businessName: business.businessName,
      metadata: toJsonValue({
        pan: business.pan,
        seedTag,
      }),
    });

    if (business.labourRegNo) {
      registryRows.push({
        ubid: business.ubid,
        systemName: SystemName.EKARMIKA,
        localIdentifierType: "labourRegNo",
        localIdentifier: business.labourRegNo,
        businessName: business.businessName,
        metadata: toJsonValue({
          pan: business.pan,
          seedTag,
        }),
      });
    }

    if (business.factoryLicenseNo) {
      registryRows.push({
        ubid: business.ubid,
        systemName: SystemName.ESURAKSHATE,
        localIdentifierType: "factoryLicenseNo",
        localIdentifier: business.factoryLicenseNo,
        businessName: business.businessName,
        metadata: toJsonValue({
          pan: business.pan,
          seedTag,
        }),
      });
    }
  }

  await prisma.ubidRegistry.createMany({
    data: registryRows,
  });
}

async function seedAuthorityMatrix() {
  await prisma.authorityMatrix.createMany({
    data: [
      {
        fieldPath: "businessName",
        version: 1,
        authoritativeSystem: SystemName.SWS,
        manualReviewRequired: false,
        status: MappingStatus.ACTIVE,
        ruleConfig: toJsonValue({
          seedTag,
          sourceOfTruth: "SWS",
        }),
      },
      {
        fieldPath: "registeredAddress",
        version: 1,
        authoritativeSystem: SystemName.SWS,
        manualReviewRequired: false,
        status: MappingStatus.ACTIVE,
        ruleConfig: toJsonValue({
          seedTag,
          sourceOfTruth: "SWS",
        }),
      },
      {
        fieldPath: "authorizedSignatory.name",
        version: 1,
        authoritativeSystem: SystemName.ESURAKSHATE,
        manualReviewRequired: false,
        status: MappingStatus.ACTIVE,
        ruleConfig: toJsonValue({
          seedTag,
          sourceOfTruth: "ESURAKSHATE",
        }),
      },
      {
        fieldPath: "employeeCount",
        version: 1,
        authoritativeSystem: SystemName.EKARMIKA,
        manualReviewRequired: false,
        status: MappingStatus.ACTIVE,
        ruleConfig: toJsonValue({
          seedTag,
          sourceOfTruth: "EKARMIKA",
        }),
      },
      {
        fieldPath: "workerLimit",
        version: 1,
        authoritativeSystem: SystemName.ESURAKSHATE,
        manualReviewRequired: false,
        status: MappingStatus.ACTIVE,
        ruleConfig: toJsonValue({
          seedTag,
          sourceOfTruth: "ESURAKSHATE",
        }),
      },
      {
        fieldPath: "powerCapacityHP",
        version: 1,
        authoritativeSystem: SystemName.ESURAKSHATE,
        manualReviewRequired: false,
        status: MappingStatus.ACTIVE,
        ruleConfig: toJsonValue({
          seedTag,
          sourceOfTruth: "ESURAKSHATE",
        }),
      },
      {
        fieldPath: "licenseExpiry",
        version: 1,
        authoritativeSystem: SystemName.ESURAKSHATE,
        manualReviewRequired: false,
        status: MappingStatus.ACTIVE,
        ruleConfig: toJsonValue({
          seedTag,
          sourceOfTruth: "ESURAKSHATE",
        }),
      },
    ],
  });
}

async function seedSchemaMappings() {
  const [
    swsToEkarmikaMapping,
    swsToEsurakshateMapping,
    ekarmikaToSwsMapping,
    esurakshateToSwsMapping,
  ] = await Promise.all([
    loadMapping("sws-to-ekarmika.jsonata"),
    loadMapping("sws-to-esurakshate.jsonata"),
    loadMapping("ekarmika-to-sws.jsonata"),
    loadMapping("esurakshate-to-sws.jsonata"),
  ]);

  const signatoryToEkarmikaMapping = `(
  {
    "businessName": businessName,
    "managerName": authorizedSignatory.name
  }
)`;

  const signatoryToEsurakshateMapping = `(
  {
    "BusinessName": businessName,
    "ManagerName": authorizedSignatory.name
  }
)`;

  const businessOne = businesses[0];

  await prisma.schemaMapping.createMany({
    data: [
      {
        mappingId: "map_sws_to_ekarmika_v1",
        sourceSystem: SystemName.SWS,
        targetSystem: SystemName.EKARMIKA,
        serviceType: ServiceType.REGISTERED_ADDRESS_CHANGE,
        mappingType: MappingType.JSONATA,
        status: MappingStatus.ACTIVE,
        version: 1,
        mappingExpression: swsToEkarmikaMapping,
        fieldConfig: {
          changedFields: ["registeredAddress"],
          seedTag,
        },
        sampleInput: buildCanonicalPayload(businessOne),
        sampleOutput: {
          businessName: businessOne.businessName,
          addressFull: formatAddress(businessOne.registeredAddress),
          managerName: businessOne.authorizedSignatory.name,
          employeeCount: businessOne.employeeCount,
          workerLimit: businessOne.workerLimit,
          powerCapacityHP: businessOne.powerCapacityHP,
        },
        metadata: {
          seedTag,
        },
      },
      {
        mappingId: "map_sws_to_esurakshate_v1",
        sourceSystem: SystemName.SWS,
        targetSystem: SystemName.ESURAKSHATE,
        serviceType: ServiceType.REGISTERED_ADDRESS_CHANGE,
        mappingType: MappingType.JSONATA,
        status: MappingStatus.ACTIVE,
        version: 1,
        mappingExpression: swsToEsurakshateMapping,
        fieldConfig: {
          changedFields: ["registeredAddress"],
          seedTag,
        },
        sampleInput: buildCanonicalPayload(businessOne),
        sampleOutput: {
          BusinessName: businessOne.businessName,
          FactoryAddress: formatAddress(businessOne.registeredAddress),
          ManagerName: businessOne.authorizedSignatory.name,
          EmployeeCount: businessOne.employeeCount,
          WorkerLimit: businessOne.workerLimit,
          PowerCapacityHP: businessOne.powerCapacityHP,
        },
        metadata: {
          seedTag,
        },
      },
      {
        mappingId: "map_ekarmika_to_sws_v1",
        sourceSystem: SystemName.EKARMIKA,
        targetSystem: SystemName.SWS,
        serviceType: ServiceType.EMPLOYEE_COUNT_CHANGE,
        mappingType: MappingType.JSONATA,
        status: MappingStatus.ACTIVE,
        version: 1,
        mappingExpression: ekarmikaToSwsMapping,
        fieldConfig: {
          changedFields: ["employeeCount"],
          seedTag,
        },
        sampleInput: buildEkarmikaPayload(businessOne),
        sampleOutput: {
          businessName: businessOne.businessName,
          registeredAddress: {
            line1: formatAddress(businessOne.registeredAddress),
          },
          authorizedSignatory: {
            name: businessOne.authorizedSignatory.name,
          },
          employeeCount: businessOne.employeeCount,
          workerLimit: businessOne.workerLimit,
          powerCapacityHP: businessOne.powerCapacityHP,
        },
        metadata: {
          seedTag,
        },
      },
      {
        mappingId: "map_esurakshate_to_sws_v1",
        sourceSystem: SystemName.ESURAKSHATE,
        targetSystem: SystemName.SWS,
        serviceType: ServiceType.AUTHORIZED_SIGNATORY_CHANGE,
        mappingType: MappingType.JSONATA,
        status: MappingStatus.ACTIVE,
        version: 1,
        mappingExpression: esurakshateToSwsMapping,
        fieldConfig: {
          changedFields: ["authorizedSignatory"],
          seedTag,
        },
        sampleInput: buildEsurakshatePayload(businessOne),
        sampleOutput: {
          businessName: businessOne.businessName,
          registeredAddress: {
            line1: formatAddress(businessOne.registeredAddress),
          },
          authorizedSignatory: {
            name: businessOne.authorizedSignatory.name,
          },
          employeeCount: businessOne.employeeCount,
          workerLimit: businessOne.workerLimit,
          powerCapacityHP: businessOne.powerCapacityHP,
        },
        metadata: {
          seedTag,
        },
      },
      {
        mappingId: "map_sws_to_ekarmika_signatory_v1",
        sourceSystem: SystemName.SWS,
        targetSystem: SystemName.EKARMIKA,
        serviceType: ServiceType.AUTHORIZED_SIGNATORY_CHANGE,
        mappingType: MappingType.JSONATA,
        status: MappingStatus.ACTIVE,
        version: 1,
        mappingExpression: signatoryToEkarmikaMapping,
        fieldConfig: {
          changedFields: ["authorizedSignatory"],
          seedTag,
        },
        sampleInput: buildCanonicalPayload(businessOne),
        sampleOutput: {
          businessName: businessOne.businessName,
          managerName: businessOne.authorizedSignatory.name,
        },
        metadata: {
          seedTag,
        },
      },
      {
        mappingId: "map_sws_to_esurakshate_signatory_v1",
        sourceSystem: SystemName.SWS,
        targetSystem: SystemName.ESURAKSHATE,
        serviceType: ServiceType.AUTHORIZED_SIGNATORY_CHANGE,
        mappingType: MappingType.JSONATA,
        status: MappingStatus.ACTIVE,
        version: 1,
        mappingExpression: signatoryToEsurakshateMapping,
        fieldConfig: {
          changedFields: ["authorizedSignatory"],
          seedTag,
        },
        sampleInput: buildCanonicalPayload(businessOne),
        sampleOutput: {
          BusinessName: businessOne.businessName,
          ManagerName: businessOne.authorizedSignatory.name,
        },
        metadata: {
          seedTag,
        },
      },
    ],
  });
}

async function main() {
  console.info("Seeding started");

  await clearTables();
  console.info("Tables cleared");

  await seedBusinesses();
  console.info("Businesses seeded");

  await seedMockRecords();
  console.info("Mock records seeded");

  await seedRegistry();
  console.info("Registry seeded");

  await seedAuthorityMatrix();
  console.info("Authority matrix seeded");

  await seedSchemaMappings();
  console.info("Schema mappings seeded");

  console.info("Seeding complete");
}

main()
  .catch((error) => {
    console.error("Prisma seed failed.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
