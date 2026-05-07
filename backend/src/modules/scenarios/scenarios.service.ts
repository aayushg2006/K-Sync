import { Prisma } from "@prisma/client";

import { AppError } from "../../common/errors/AppError";
import { ERROR_CODES } from "../../common/errors/errorCodes";
import type { CanonicalPayload, RegisteredAddress } from "../../common/types/event.types";
import prisma from "../../config/prisma";
import {
  departmentWriteQueue,
  pollingQueue,
  retryQueue,
  swsWriteQueue,
} from "../../config/queues";
import { redisConnection } from "../../config/redis";
import { getAuditLogs } from "../audit/audit.service";
import { ingestRequest } from "../ksync/ksync.service";
import {
  getEstablishmentByLabourRegNo,
  manuallyUpdateEstablishment,
} from "../mock-ekarmika/mockEkarmika.service";
import {
  getFactoryByLicenseNo,
  manuallyUpdateFactory,
} from "../mock-esurakshate/mockEsurakshate.service";
import { buildFactoryXml } from "../mock-esurakshate/esurakshate.xml";
import { getMockSwsBusinessByUbid } from "../mock-sws/mockSws.service";
import { pollSingleDepartmentRecord } from "../polling/polling.service";
import { clearSimulatedWriteFailures, scheduleSimulatedWriteFailure } from "./failure-simulation.service";

type ScenarioName =
  | "SWS_TO_DEPARTMENTS"
  | "DEPARTMENT_TO_SWS"
  | "CONFLICT"
  | "MANUAL_REVIEW"
  | "IDEMPOTENCY"
  | "FAILURE_RETRY"
  | "RESET_DEMO";

type DemoSeedBusiness = {
  authorizedSignatory: {
    designation: string;
    email: string;
    mobile: string;
    name: string;
  };
  businessName: string;
  employeeCount: number;
  factoryLicenseNo?: string;
  labourRegNo?: string;
  licenseExpiry?: string;
  lastModifiedAt: string;
  pan: string;
  powerCapacityHP: number;
  registeredAddress: RegisteredAddress;
  sourceRequestId: string;
  swsBusinessId: string;
  ubid: string;
  workerLimit: number;
};

export interface ScenarioApiResponse {
  conflictId?: string;
  correlationId?: string;
  details: Record<string, unknown>;
  eventId?: string;
  message: string;
  scenario: ScenarioName;
  success: true;
}

type EventRuntimeSummary = {
  auditLogs: Awaited<ReturnType<typeof getAuditLogs>>;
  correlationId: string;
  eventId: string;
  finalStatus: string;
  queueStatuses: Array<{
    attemptsMade: number;
    jobId: string;
    queueName: string;
    status: string;
    targetSystem: string | null;
  }>;
};

const DEMO_SEED_TAG = "ksync-demo-seed-v1";
const HOLDING_PEN_KEY_PREFIX = "ksync:holding-pen";
const IDEMPOTENCY_KEY_PREFIX = "ksync:idempotency";
const SCENARIO_WAIT_INTERVAL_MS = 250;
const STANDARD_WAIT_TIMEOUT_MS = 20_000;
const FAILURE_RETRY_WAIT_TIMEOUT_MS = 30_000;

const demoSeedBusinesses: DemoSeedBusiness[] = [
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
    licenseExpiry: "2027-03-31",
    lastModifiedAt: "2026-05-01T09:00:00.000Z",
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
    lastModifiedAt: "2026-05-01T09:15:00.000Z",
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
    licenseExpiry: "2027-08-15",
    lastModifiedAt: "2026-05-01T09:30:00.000Z",
  },
];

const demoSeedBusinessByUbid = new Map(
  demoSeedBusinesses.map((business) => [business.ubid, business] as const),
);

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function parseJsonObject<T>(value: Prisma.JsonValue | null): T | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  return clone(value as T);
}

function assertScenario(condition: unknown, message: string, details?: unknown): asserts condition {
  if (condition) {
    return;
  }

  throw new AppError({
    code: ERROR_CODES.INTERNAL_SERVER_ERROR,
    details,
    message,
    statusCode: 500,
  });
}

function formatAddress(address: RegisteredAddress) {
  return [
    address.line1,
    address.line2,
    address.city,
    address.district,
    address.state,
    address.postalCode,
  ]
    .filter(Boolean)
    .join(", ");
}

function buildFactorySnapshotXml(business: DemoSeedBusiness) {
  return buildFactoryXml({
    FactorySnapshot: {
      BusinessName: business.businessName,
      EmployeeCount: business.employeeCount,
      FactoryAddress: formatAddress(business.registeredAddress),
      FactoryLicenseNo: business.factoryLicenseNo,
      LastModified: business.lastModifiedAt,
      LicenseExpiry: business.licenseExpiry,
      ManagerName: business.authorizedSignatory.name,
      PowerCapacityHP: business.powerCapacityHP,
      Ubid: business.ubid,
      WorkerLimit: business.workerLimit,
    },
  });
}

function buildSeededSwsRawPayload(business: DemoSeedBusiness) {
  return {
    authorizedSignatory: business.authorizedSignatory,
    businessId: business.swsBusinessId,
    businessName: business.businessName,
    employeeCount: business.employeeCount,
    factoryLicenseNo: business.factoryLicenseNo,
    licenseExpiry: business.licenseExpiry,
    pan: business.pan,
    powerCapacityHP: business.powerCapacityHP,
    registeredAddress: business.registeredAddress,
    seedTag: DEMO_SEED_TAG,
    workerLimit: business.workerLimit,
  };
}

function buildSeededEkarmikaRawPayload(business: DemoSeedBusiness) {
  return {
    addressFull: formatAddress(business.registeredAddress),
    businessName: business.businessName,
    employeeCount: business.employeeCount,
    labourRegNo: business.labourRegNo,
    managerName: business.authorizedSignatory.name,
    pan: business.pan,
    powerCapacityHP: business.powerCapacityHP,
    seedTag: DEMO_SEED_TAG,
    ubid: business.ubid,
    workerLimit: business.workerLimit,
  };
}

function buildSeededEsurakshateRawPayload(business: DemoSeedBusiness) {
  return {
    BusinessName: business.businessName,
    EmployeeCount: business.employeeCount,
    FactoryAddress: formatAddress(business.registeredAddress),
    FactoryLicenseNo: business.factoryLicenseNo,
    LicenseExpiry: business.licenseExpiry,
    ManagerName: business.authorizedSignatory.name,
    PowerCapacityHP: business.powerCapacityHP,
    WorkerLimit: business.workerLimit,
    factoryAddress: formatAddress(business.registeredAddress),
    factoryLicenseNo: business.factoryLicenseNo,
    licenseExpiry: business.licenseExpiry,
    managerName: business.authorizedSignatory.name,
    powerCapacityHP: business.powerCapacityHP,
    seedTag: DEMO_SEED_TAG,
    ubid: business.ubid,
    Ubid: business.ubid,
    workerLimit: business.workerLimit,
  };
}

function buildBusinessMetadata(business: DemoSeedBusiness) {
  return {
    pan: business.pan,
    seedTag: DEMO_SEED_TAG,
    systemsPresent: [
      "SWS",
      ...(business.labourRegNo ? ["EKARMIKA"] : []),
      ...(business.factoryLicenseNo ? ["ESURAKSHATE"] : []),
    ],
  };
}

function buildCorrelationId(suffix: string) {
  return `scenario-${suffix}-${Date.now()}`;
}

function getSeedBusinesses(ubids?: string[]) {
  if (!ubids || ubids.length === 0) {
    return demoSeedBusinesses;
  }

  return ubids.map((ubid) => {
    const business = demoSeedBusinessByUbid.get(ubid);

    if (!business) {
      throw new AppError({
        code: ERROR_CODES.BAD_REQUEST,
        message: `No demo seed business was found for ${ubid}.`,
        statusCode: 400,
      });
    }

    return business;
  });
}

function buildScenarioAddress(input: {
  city?: string;
  district?: string;
  line1: string;
  line2?: string;
  postalCode: string;
}) {
  return {
    city: input.city ?? "Bengaluru",
    district: input.district,
    line1: input.line1,
    line2: input.line2,
    postalCode: input.postalCode,
    state: "Karnataka",
  } satisfies RegisteredAddress;
}

function buildScenarioRunId(prefix: string) {
  return `${prefix}-${Date.now()}`;
}

function buildScenarioPersonName(baseName: string, runId: string) {
  return `${baseName} ${runId.slice(-4)}`;
}

async function waitForEventSummary(
  eventId: string,
  timeoutMs = STANDARD_WAIT_TIMEOUT_MS,
): Promise<EventRuntimeSummary> {
  const startedAt = Date.now();

  while (Date.now() - startedAt <= timeoutMs) {
    const [event, queueStatuses] = await Promise.all([
      prisma.canonicalEvent.findUnique({
        where: { eventId },
        select: {
          correlationId: true,
          eventId: true,
          status: true,
        },
      }),
      prisma.queueJob.findMany({
        where: { eventId },
        orderBy: [{ queueName: "asc" }, { targetSystem: "asc" }],
        select: {
          attemptsMade: true,
          jobId: true,
          queueName: true,
          status: true,
          targetSystem: true,
        },
      }),
    ]);

    if (!event) {
      break;
    }

    const queueComplete =
      queueStatuses.length === 0 ||
      queueStatuses.every((queueJob) =>
        ["COMPLETED", "FAILED", "DLQ_MOVED"].includes(queueJob.status),
      );
    const eventComplete = [
      "COMPLETED",
      "CONFLICT_RESOLVED",
      "DLQ_MOVED",
      "DUPLICATE_DETECTED",
      "FAILED",
      "MANUAL_REVIEW_REQUIRED",
      "SUPERSEDED",
      "TARGET_MAPPING_MISSING",
      "TARGET_NOT_APPLICABLE",
      "WRITE_SUCCEEDED",
      "REGISTRATION_REQUIRED",
    ].includes(event.status);

    if (queueComplete && eventComplete) {
      const auditLogs = await getAuditLogs({ eventId });

      return {
        auditLogs,
        correlationId: event.correlationId,
        eventId: event.eventId,
        finalStatus: event.status,
        queueStatuses: queueStatuses.map((queueJob) => ({
          attemptsMade: queueJob.attemptsMade,
          jobId: queueJob.jobId,
          queueName: queueJob.queueName,
          status: queueJob.status,
          targetSystem: queueJob.targetSystem,
        })),
      };
    }

    await sleep(SCENARIO_WAIT_INTERVAL_MS);
  }

  const [event, queueStatuses, auditLogs] = await Promise.all([
    prisma.canonicalEvent.findUnique({
      where: { eventId },
      select: {
        correlationId: true,
        eventId: true,
        status: true,
      },
    }),
    prisma.queueJob.findMany({
      where: { eventId },
      orderBy: [{ queueName: "asc" }, { targetSystem: "asc" }],
      select: {
        attemptsMade: true,
        jobId: true,
        queueName: true,
        status: true,
        targetSystem: true,
      },
    }),
    getAuditLogs({ eventId }),
  ]);

  return {
    auditLogs,
    correlationId: event?.correlationId ?? "unknown",
    eventId,
    finalStatus: event?.status ?? "UNKNOWN",
    queueStatuses: queueStatuses.map((queueJob) => ({
      attemptsMade: queueJob.attemptsMade,
      jobId: queueJob.jobId,
      queueName: queueJob.queueName,
      status: queueJob.status,
      targetSystem: queueJob.targetSystem,
    })),
  };
}

async function ensurePollingBaseline(systemName: "EKARMIKA" | "ESURAKSHATE", ubid: string) {
  const result = await pollSingleDepartmentRecord(systemName, ubid);

  if (result.baselinesSaved > 0) {
    return {
      baselineCreated: true,
      pollingResult: result,
    };
  }

  return {
    baselineCreated: false,
    pollingResult: result,
  };
}

async function clearRedisHoldingPen() {
  await clearRedisKeysByPrefix(HOLDING_PEN_KEY_PREFIX);
}

async function clearRedisIdempotencyCache() {
  await clearRedisKeysByPrefix(IDEMPOTENCY_KEY_PREFIX);
}

async function clearRedisKeysByPrefix(prefix: string) {
  let cursor = "0";

  do {
    const [nextCursor, keys] = await redisConnection.scan(
      cursor,
      "MATCH",
      `${prefix}:*`,
      "COUNT",
      100,
    );
    cursor = nextCursor;

    if (keys.length > 0) {
      await redisConnection.del(...keys);
    }
  } while (cursor !== "0");
}

async function resetBullMqQueues() {
  await Promise.all([
    departmentWriteQueue.obliterate({ force: true }),
    swsWriteQueue.obliterate({ force: true }),
    pollingQueue.obliterate({ force: true }),
    retryQueue.obliterate({ force: true }),
  ]);
}

async function clearRuntimeTables() {
  await prisma.auditLog.deleteMany();
  await prisma.idempotencyKey.deleteMany();
  await prisma.queueJob.deleteMany();
  await prisma.deadLetterJob.deleteMany();
  await prisma.manualReviewItem.deleteMany();
  await prisma.conflict.deleteMany();
  await prisma.departmentSnapshot.deleteMany();
  await prisma.canonicalEvent.deleteMany();
}

async function restoreBusinesses(seedBusinesses: DemoSeedBusiness[] = demoSeedBusinesses) {
  const ubids = seedBusinesses.map((business) => business.ubid);

  await prisma.business.deleteMany({
    where: seedBusinesses.length === demoSeedBusinesses.length ? undefined : { ubid: { in: ubids } },
  });

  await prisma.business.createMany({
    data: seedBusinesses.map((business) => ({
      ubid: business.ubid,
      businessName: business.businessName,
      labourRegNo: business.labourRegNo ?? null,
      factoryLicenseNo: business.factoryLicenseNo ?? null,
      sourceRequestId: business.sourceRequestId,
      registeredAddress: toJsonValue(business.registeredAddress),
      authorizedSignatory: toJsonValue(business.authorizedSignatory),
      employeeCount: business.employeeCount,
      workerLimit: business.workerLimit,
      powerCapacityHP: business.powerCapacityHP,
      licenseExpiry: business.licenseExpiry ?? null,
      metadata: toJsonValue(buildBusinessMetadata(business)),
      lastModifiedAt: new Date(business.lastModifiedAt),
    })),
  });
}

async function restoreRegistry(seedBusinesses: DemoSeedBusiness[] = demoSeedBusinesses) {
  const ubids = seedBusinesses.map((business) => business.ubid);

  await prisma.ubidRegistry.deleteMany({
    where: seedBusinesses.length === demoSeedBusinesses.length ? undefined : { ubid: { in: ubids } },
  });

  const registryRows: Prisma.UbidRegistryCreateManyInput[] = [];

  for (const business of seedBusinesses) {
    registryRows.push({
      ubid: business.ubid,
      systemName: "SWS",
      localIdentifierType: "businessId",
      localIdentifier: business.swsBusinessId,
      businessName: business.businessName,
      metadata: toJsonValue({
        pan: business.pan,
        seedTag: DEMO_SEED_TAG,
      }),
    });

    if (business.labourRegNo) {
      registryRows.push({
        ubid: business.ubid,
        systemName: "EKARMIKA",
        localIdentifierType: "labourRegNo",
        localIdentifier: business.labourRegNo,
        businessName: business.businessName,
        metadata: toJsonValue({
          pan: business.pan,
          seedTag: DEMO_SEED_TAG,
        }),
      });
    }

    if (business.factoryLicenseNo) {
      registryRows.push({
        ubid: business.ubid,
        systemName: "ESURAKSHATE",
        localIdentifierType: "factoryLicenseNo",
        localIdentifier: business.factoryLicenseNo,
        businessName: business.businessName,
        metadata: toJsonValue({
          pan: business.pan,
          seedTag: DEMO_SEED_TAG,
        }),
      });
    }
  }

  await prisma.ubidRegistry.createMany({
    data: registryRows,
  });
}

async function restoreMockRecords(seedBusinesses: DemoSeedBusiness[] = demoSeedBusinesses) {
  const ubids = seedBusinesses.map((business) => business.ubid);

  await prisma.mockEkarmikaRecord.deleteMany({
    where: seedBusinesses.length === demoSeedBusinesses.length ? undefined : { ubid: { in: ubids } },
  });
  await prisma.mockEsurakshateRecord.deleteMany({
    where: seedBusinesses.length === demoSeedBusinesses.length ? undefined : { ubid: { in: ubids } },
  });
  await prisma.mockSwsRecord.deleteMany({
    where: seedBusinesses.length === demoSeedBusinesses.length ? undefined : { ubid: { in: ubids } },
  });

  await prisma.mockSwsRecord.createMany({
    data: seedBusinesses.map((business) => ({
      ubid: business.ubid,
      businessName: business.businessName,
      labourRegNo: business.labourRegNo ?? null,
      factoryLicenseNo: business.factoryLicenseNo ?? null,
      sourceRequestId: business.sourceRequestId,
      registeredAddress: toJsonValue(business.registeredAddress),
      authorizedSignatory: toJsonValue(business.authorizedSignatory),
      employeeCount: business.employeeCount,
      workerLimit: business.workerLimit,
      powerCapacityHP: business.powerCapacityHP,
      licenseExpiry: business.licenseExpiry ?? null,
      rawPayload: toJsonValue(buildSeededSwsRawPayload(business)),
      lastModifiedAt: new Date(business.lastModifiedAt),
    })),
  });

  const ekarmikaBusinesses = seedBusinesses.filter((business) => business.labourRegNo);
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
      rawPayload: toJsonValue(buildSeededEkarmikaRawPayload(business)),
      lastModifiedAt: new Date(business.lastModifiedAt),
    })),
  });

  const esurakshateBusinesses = seedBusinesses.filter(
    (business) => business.factoryLicenseNo,
  );
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
      rawPayload: toJsonValue(buildSeededEsurakshateRawPayload(business)),
      lastModifiedAt: new Date(business.lastModifiedAt),
    })),
  });
}

async function prepareScenarioDemoState() {
  clearSimulatedWriteFailures();
  await resetBullMqQueues();
  await clearRedisHoldingPen();
  await clearRedisIdempotencyCache();
  await clearRuntimeTables();
  await restoreBusinesses();
  await restoreRegistry();
  await restoreMockRecords();
}

async function prepareScenarioWorkspace(ubids: string[]) {
  const seedBusinesses = getSeedBusinesses(ubids);

  clearSimulatedWriteFailures();
  await clearRedisHoldingPen();
  await prisma.departmentSnapshot.deleteMany({
    where: {
      ubid: {
        in: ubids,
      },
    },
  });
  await restoreBusinesses(seedBusinesses);
  await restoreRegistry(seedBusinesses);
  await restoreMockRecords(seedBusinesses);
}

function buildScenarioResponse(
  scenario: ScenarioName,
  message: string,
  details: Record<string, unknown>,
  metadata?: {
    conflictId?: string;
    correlationId?: string;
    eventId?: string;
  },
): ScenarioApiResponse {
  return {
    success: true,
    scenario,
    message,
    correlationId: metadata?.correlationId,
    eventId: metadata?.eventId,
    conflictId: metadata?.conflictId,
    details,
  };
}

export async function runSwsToDepartmentsScenario(): Promise<ScenarioApiResponse> {
  const ubid = "UBID-KA-2026-0001";
  await prepareScenarioWorkspace([ubid]);
  const runId = buildScenarioRunId("scenario1");
  const addressLine = `Plot 44, Peenya Industrial Area ${runId.slice(-4)}`;

  const sourceRequestId = `scenario-sws-address-${Date.now()}`;
  const correlationId = buildCorrelationId("sws-address");
  const payload: CanonicalPayload = {
    registeredAddress: buildScenarioAddress({
      district: "Bengaluru Urban",
      line1: addressLine,
      postalCode: "560058",
    }),
  };

  const ingestResult = await ingestRequest({
    changedFields: ["registeredAddress"],
    correlationId,
    operation: "UPDATE",
    payload,
    serviceType: "REGISTERED_ADDRESS_CHANGE",
    sourceRequestId,
    sourceSystem: "SWS",
    ubid,
  });
  const runtime = await waitForEventSummary(ingestResult.eventId);
  const [ekarmikaRecord, esurakshateRecord] = await Promise.all([
    getEstablishmentByLabourRegNo("LAB-KA-2026-0001"),
    getFactoryByLicenseNo("FAC-KA-2026-0001"),
  ]);

  assertScenario(
    ekarmikaRecord.addressFull?.includes(addressLine),
    "Scenario 1 did not update mock e-Karmika with the propagated address.",
    {
      addressFull: ekarmikaRecord.addressFull,
      expectedAddressLine: addressLine,
      eventId: ingestResult.eventId,
    },
  );
  assertScenario(
    esurakshateRecord.factoryAddress?.includes(addressLine),
    "Scenario 1 did not update mock e-Surakshate with the propagated address.",
    {
      expectedAddressLine: addressLine,
      eventId: ingestResult.eventId,
      factoryAddress: esurakshateRecord.factoryAddress,
    },
  );

  return buildScenarioResponse(
    "SWS_TO_DEPARTMENTS",
    "SWS address change propagated to both department systems through the existing K-Sync pipeline.",
    {
      auditStatuses: runtime.auditLogs.map((auditLog) => auditLog.status),
      addressLine,
      ekarmikaAddressFull: ekarmikaRecord.addressFull,
      esurakshateFactoryAddress: esurakshateRecord.factoryAddress,
      finalStatus: runtime.finalStatus,
      queueStatuses: runtime.queueStatuses,
      sourceRequestId,
      targets: ingestResult.targets,
    },
    {
      correlationId: ingestResult.correlationId,
      eventId: ingestResult.eventId,
    },
  );
}

export async function runDepartmentToSwsScenario(): Promise<ScenarioApiResponse> {
  const ubid = "UBID-KA-2026-0003";
  await prepareScenarioWorkspace([ubid]);
  const runId = buildScenarioRunId("scenario2");
  const managerName = buildScenarioPersonName("Meera Rao", runId);
  const baseline = await ensurePollingBaseline("ESURAKSHATE", ubid);

  await manuallyUpdateFactory({
    changedFields: ["authorizedSignatory"],
    correlationId: buildCorrelationId("department-to-sws"),
    operation: "UPDATE",
    payload: {
      authorizedSignatory: {
        name: managerName,
      },
    },
    remarks: "Scenario runner applied a direct e-Surakshate manager update.",
    serviceType: "AUTHORIZED_SIGNATORY_CHANGE",
    ubid,
    updatedBy: "scenario-runner",
  });

  const pollingResult = await pollSingleDepartmentRecord("ESURAKSHATE", ubid);
  const createdEvent = pollingResult.summaries.find(
    (summary) =>
      summary.action === "EVENT_CREATED" &&
      summary.eventId &&
      summary.serviceType === "AUTHORIZED_SIGNATORY_CHANGE",
  );

  assertScenario(
    createdEvent?.eventId && createdEvent.correlationId,
    "Scenario 2 polling did not create an AUTHORIZED_SIGNATORY_CHANGE canonical event.",
    pollingResult,
  );

  const runtime = await waitForEventSummary(createdEvent.eventId);
  const [swsBusiness, esurakshateFactory] = await Promise.all([
    getMockSwsBusinessByUbid(ubid),
    getFactoryByLicenseNo("FAC-KA-2026-0003"),
  ]);

  assertScenario(
    swsBusiness.authorizedSignatory?.name === managerName,
    "Scenario 2 did not sync the updated manager name back into mock SWS.",
    {
      authorizedSignatory: swsBusiness.authorizedSignatory,
      expectedManagerName: managerName,
      eventId: createdEvent.eventId,
    },
  );

  return buildScenarioResponse(
    "DEPARTMENT_TO_SWS",
    "Direct e-Surakshate manager change was detected by polling and synced back to SWS.",
    {
      auditStatuses: runtime.auditLogs.map((auditLog) => auditLog.status),
      baseline,
      changedFields: createdEvent.changedFields ?? [],
      detectedChange: createdEvent,
      esurakshateManagerName: esurakshateFactory.managerName,
      finalStatus: runtime.finalStatus,
      managerName,
      pollingSummary: pollingResult,
      queueStatuses: runtime.queueStatuses,
      swsAuthorizedSignatoryName: swsBusiness.authorizedSignatory?.name,
    },
    {
      correlationId: createdEvent.correlationId,
      eventId: createdEvent.eventId,
    },
  );
}

export async function runConflictScenario(): Promise<ScenarioApiResponse> {
  const ubid = "UBID-KA-2026-0001";
  await prepareScenarioWorkspace([ubid]);
  const runId = buildScenarioRunId("scenario3");
  const competingAddressLine = `92 Competing Labour Layout ${runId.slice(-4)}`;
  const authoritativeAddressLine = `11 Authority Matrix Road ${runId.slice(-4)}`;
  const baseline = await ensurePollingBaseline("EKARMIKA", ubid);

  await manuallyUpdateEstablishment({
    changedFields: ["registeredAddress"],
    correlationId: buildCorrelationId("conflict-ekarmika"),
    operation: "UPDATE",
    payload: {
      registeredAddress: buildScenarioAddress({
        district: "Bengaluru Rural",
        line1: competingAddressLine,
        postalCode: "560059",
      }),
    },
    remarks: "Scenario runner created a competing e-Karmika address update.",
    serviceType: "REGISTERED_ADDRESS_CHANGE",
    ubid,
    updatedBy: "scenario-runner",
  });

  const pollingResult = await pollSingleDepartmentRecord("EKARMIKA", ubid);
  const ekarmikaEvent = pollingResult.summaries.find(
    (summary) =>
      summary.action === "EVENT_CREATED" &&
      summary.eventId &&
      summary.serviceType === "REGISTERED_ADDRESS_CHANGE",
  );

  assertScenario(
    ekarmikaEvent?.eventId && ekarmikaEvent.correlationId,
    "Scenario 3 did not create the competing e-Karmika event needed for conflict detection.",
    pollingResult,
  );

  const swsSourceRequestId = `scenario-conflict-sws-${Date.now()}`;
  const swsCorrelationId = buildCorrelationId("conflict-sws");

  const swsResult = await ingestRequest({
    changedFields: ["registeredAddress"],
    correlationId: swsCorrelationId,
    operation: "UPDATE",
    payload: {
      registeredAddress: buildScenarioAddress({
        district: "Bengaluru Urban",
        line1: authoritativeAddressLine,
        postalCode: "560058",
      }),
    },
    serviceType: "REGISTERED_ADDRESS_CHANGE",
    sourceRequestId: swsSourceRequestId,
    sourceSystem: "SWS",
    ubid,
  });

  const [swsRuntime, ekarmikaRuntime] = await Promise.all([
    waitForEventSummary(swsResult.eventId),
    waitForEventSummary(ekarmikaEvent.eventId),
  ]);
  const conflict = await prisma.conflict.findFirst({
    where: {
      eventId: swsResult.eventId,
      resolutionStatus: "AUTO_RESOLVED",
    },
    orderBy: [{ detectedAt: "desc" }],
    select: {
      authorityDecision: true,
      conflictId: true,
      eventId: true,
      metadata: true,
      resolutionStatus: true,
      sourceSystem: true,
      targetSystem: true,
    },
  });

  assertScenario(
    conflict?.conflictId,
    "Scenario 3 did not produce the expected conflict record resolved in favor of SWS.",
    {
      ekarmikaEventId: ekarmikaEvent.eventId,
      swsEventId: swsResult.eventId,
    },
  );

  const authorityDecision = parseJsonObject<{
    competingEventId?: string;
    fieldDecisions?: Array<{ reason?: string }>;
  }>(conflict.authorityDecision);
  const explanation =
    authorityDecision?.fieldDecisions?.find((decision) => decision.reason)?.reason ??
    "Authority Matrix marked SWS as the authoritative source for registeredAddress.";

  assertScenario(
    ekarmikaRuntime.finalStatus === "SUPERSEDED",
    "Scenario 3 expected the e-Karmika event to be superseded by the SWS event.",
    ekarmikaRuntime,
  );

  return buildScenarioResponse(
    "CONFLICT",
    "Conflict detected and resolved deterministically in favor of SWS for registeredAddress.",
    {
      auditStatuses: {
        ekarmikaEvent: ekarmikaRuntime.auditLogs.map((auditLog) => auditLog.status),
        swsEvent: swsRuntime.auditLogs.map((auditLog) => auditLog.status),
      },
      baseline,
      competingAddressLine,
      explanation,
      involvedEventIds: {
        ekarmikaEventId: ekarmikaEvent.eventId,
        swsEventId: swsResult.eventId,
      },
      authoritativeAddressLine,
      loser: "EKARMIKA",
      winner: "SWS",
    },
    {
      conflictId: conflict.conflictId,
      correlationId: ekarmikaEvent.correlationId,
      eventId: ekarmikaEvent.eventId,
    },
  );
}

export async function runManualReviewScenario(): Promise<ScenarioApiResponse> {
  const ubid = "UBID-KA-2026-0001";
  await prepareScenarioWorkspace([ubid]);
  const runId = buildScenarioRunId("scenario4");
  const departmentAddressLine = `51 Labour Colony Extension ${runId.slice(-4)}`;
  const swsAddressLine = `18 Integrated Services Avenue ${runId.slice(-4)}`;
  const departmentEmployeeCount = 138 + Number.parseInt(runId.slice(-2), 10) % 5;
  const swsEmployeeCount = 132 + Number.parseInt(runId.slice(-2), 10) % 5;

  const departmentSourceRequestId = `scenario-manual-review-ekarmika-${Date.now()}`;
  const departmentResult = await ingestRequest({
    changedFields: ["registeredAddress", "employeeCount"],
    correlationId: buildCorrelationId("manual-review-ekarmika"),
    operation: "UPDATE",
    payload: {
      employeeCount: departmentEmployeeCount,
      registeredAddress: buildScenarioAddress({
        district: "Bengaluru Rural",
        line1: departmentAddressLine,
        postalCode: "560059",
      }),
    },
    serviceType: "REGISTERED_ADDRESS_CHANGE",
    sourceRequestId: departmentSourceRequestId,
    sourceSystem: "EKARMIKA",
    ubid,
  });

  const swsSourceRequestId = `scenario-manual-review-sws-${Date.now()}`;
  const swsResult = await ingestRequest({
    changedFields: ["registeredAddress", "employeeCount"],
    correlationId: buildCorrelationId("manual-review-sws"),
    operation: "UPDATE",
    payload: {
      employeeCount: swsEmployeeCount,
      registeredAddress: buildScenarioAddress({
        district: "Bengaluru Urban",
        line1: swsAddressLine,
        postalCode: "560058",
      }),
    },
    serviceType: "REGISTERED_ADDRESS_CHANGE",
    sourceRequestId: swsSourceRequestId,
    sourceSystem: "SWS",
    ubid,
  });
  const [departmentRuntime, swsRuntime, conflict, reviewItem] = await Promise.all([
    waitForEventSummary(departmentResult.eventId),
    waitForEventSummary(swsResult.eventId),
    prisma.conflict.findFirst({
      where: {
        eventId: swsResult.eventId,
        resolutionStatus: "MANUAL_REVIEW_REQUIRED",
      },
      orderBy: [{ detectedAt: "desc" }],
      select: {
        authorityDecision: true,
        conflictId: true,
        eventId: true,
        resolutionStatus: true,
        reviewStatus: true,
      },
    }),
    prisma.manualReviewItem.findFirst({
      where: {
        eventId: swsResult.eventId,
      },
      orderBy: [{ openedAt: "desc" }],
      select: {
        reviewId: true,
        reviewStatus: true,
        title: true,
      },
    }),
  ]);

  assertScenario(
    conflict?.conflictId && reviewItem?.reviewId,
    "Scenario 4 did not generate the expected manual-review conflict artifacts.",
    {
      departmentEventId: departmentResult.eventId,
      swsEventId: swsResult.eventId,
    },
  );

  return buildScenarioResponse(
    "MANUAL_REVIEW",
    "Mixed-authority changes triggered a persisted manual-review queue item through the live conflict pipeline.",
    {
      auditStatuses: {
        departmentEvent: departmentRuntime.auditLogs.map((auditLog) => auditLog.status),
        swsEvent: swsRuntime.auditLogs.map((auditLog) => auditLog.status),
      },
      competingEventId: departmentResult.eventId,
      conflictId: conflict.conflictId,
      departmentAddressLine,
      departmentEmployeeCount,
      finalStatus: swsRuntime.finalStatus,
      queueStatuses: swsRuntime.queueStatuses,
      reviewItem,
      sourceRequestIds: {
        department: departmentSourceRequestId,
        sws: swsSourceRequestId,
      },
      swsAddressLine,
      swsEmployeeCount,
    },
    {
      conflictId: conflict.conflictId,
      correlationId: swsResult.correlationId,
      eventId: swsResult.eventId,
    },
  );
}

export async function runIdempotencyScenario(): Promise<ScenarioApiResponse> {
  const ubid = "UBID-KA-2026-0002";
  await prepareScenarioWorkspace([ubid]);
  const runId = buildScenarioRunId("scenario5");
  const addressLine = `77 Duplicate Guard Street ${runId.slice(-4)}`;

  const sourceRequestId = `scenario-idempotency-${Date.now()}`;
  const payload: CanonicalPayload = {
    registeredAddress: buildScenarioAddress({
      district: "Bengaluru Urban",
      line1: addressLine,
      postalCode: "560058",
    }),
  };

  const firstResult = await ingestRequest({
    changedFields: ["registeredAddress"],
    correlationId: buildCorrelationId("idempotency-first"),
    operation: "UPDATE",
    payload,
    serviceType: "REGISTERED_ADDRESS_CHANGE",
    sourceRequestId,
    sourceSystem: "SWS",
    ubid,
  });
  const secondCorrelationId = buildCorrelationId("idempotency-second");
  const secondResult = await ingestRequest({
    changedFields: ["registeredAddress"],
    correlationId: secondCorrelationId,
    operation: "UPDATE",
    payload,
    serviceType: "REGISTERED_ADDRESS_CHANGE",
    sourceRequestId,
    sourceSystem: "SWS",
    ubid,
  });

  assertScenario(
    secondResult.duplicate,
    "Scenario 5 did not mark the second submission as a duplicate.",
    {
      firstResult,
      secondResult,
    },
  );

  const runtime = await waitForEventSummary(firstResult.eventId);
  const duplicateEventRecord = await prisma.canonicalEvent.findFirst({
    where: {
      correlationId: secondCorrelationId,
    },
    select: {
      eventId: true,
      status: true,
    },
  });
  const [originalQueueJobs, duplicateQueueJobs] = await Promise.all([
    prisma.queueJob.findMany({
      where: {
        eventId: firstResult.eventId,
      },
      select: {
        jobId: true,
        status: true,
        targetSystem: true,
      },
    }),
    duplicateEventRecord
      ? prisma.queueJob.findMany({
          where: {
            eventId: duplicateEventRecord.eventId,
          },
          select: {
            jobId: true,
          },
        })
      : Promise.resolve([]),
  ]);

  assertScenario(
    duplicateQueueJobs.length === 0,
    "Scenario 5 unexpectedly created queue jobs for the duplicate event record.",
    {
      duplicateEventRecord,
      duplicateQueueJobs,
    },
  );

  return buildScenarioResponse(
    "IDEMPOTENCY",
    "Idempotency check accepted the first request and rejected the duplicate submission.",
    {
      addressLine,
      auditStatuses: runtime.auditLogs.map((auditLog) => auditLog.status),
      duplicateEventRecord,
      duplicateResult: secondResult,
      firstResult,
      originalQueueJobs,
      sourceRequestId,
    },
    {
      correlationId: firstResult.correlationId,
      eventId: firstResult.eventId,
    },
  );
}

export async function runFailureRetryScenario(): Promise<ScenarioApiResponse> {
  const ubid = "UBID-KA-2026-0001";
  await prepareScenarioWorkspace([ubid]);
  const runId = buildScenarioRunId("scenario6");
  const managerName = buildScenarioPersonName("Kavya Menon", runId);

  scheduleSimulatedWriteFailure({
    reason: "Scenario runner intentionally failed the first e-Karmika write attempt.",
    remainingFailures: 1,
    targetSystem: "EKARMIKA",
    ubid,
  });

  const sourceRequestId = `scenario-failure-retry-${Date.now()}`;
  const ingestResult = await ingestRequest({
    changedFields: ["authorizedSignatory"],
    correlationId: buildCorrelationId("failure-retry"),
    operation: "UPDATE",
    payload: {
      authorizedSignatory: {
        name: managerName,
      },
    },
    serviceType: "AUTHORIZED_SIGNATORY_CHANGE",
    sourceRequestId,
    sourceSystem: "SWS",
    ubid,
  });

  const runtime = await waitForEventSummary(
    ingestResult.eventId,
    FAILURE_RETRY_WAIT_TIMEOUT_MS,
  );
  const deadLetterCount = await prisma.deadLetterJob.count({
    where: {
      eventId: ingestResult.eventId,
    },
  });
  const targetQueueJob = runtime.queueStatuses.find(
    (queueJob) => queueJob.targetSystem === "EKARMIKA",
  );
  const writeFailedAudit = runtime.auditLogs.find(
    (auditLog) =>
      auditLog.status === "WRITE_FAILED" && auditLog.targetSystem === "EKARMIKA",
  );
  const retryScheduledAudit = runtime.auditLogs.find(
    (auditLog) =>
      auditLog.status === "RETRY_SCHEDULED" && auditLog.targetSystem === "EKARMIKA",
  );
  const writeSucceededAudit = runtime.auditLogs.find(
    (auditLog) =>
      ["WRITE_SUCCEEDED", "COMPLETED"].includes(auditLog.status) &&
      auditLog.targetSystem === "EKARMIKA",
  );

  assertScenario(
    Boolean(writeFailedAudit),
    "Scenario 6 did not emit the expected WRITE_FAILED audit entry for e-Karmika.",
    runtime.auditLogs,
  );
  assertScenario(
    Boolean(retryScheduledAudit),
    "Scenario 6 did not emit the expected RETRY_SCHEDULED audit entry for e-Karmika.",
    runtime.auditLogs,
  );
  assertScenario(
    Boolean(writeSucceededAudit),
    "Scenario 6 did not emit the expected WRITE_SUCCEEDED audit entry after retry.",
    runtime.auditLogs,
  );
  assertScenario(
    deadLetterCount === 0,
    "Scenario 6 unexpectedly moved the job to the dead-letter queue.",
    {
      deadLetterCount,
      eventId: ingestResult.eventId,
    },
  );

  return buildScenarioResponse(
    "FAILURE_RETRY",
    "Controlled e-Karmika write failure retried successfully without producing a dead-letter record.",
    {
      auditStatuses: runtime.auditLogs.map((auditLog) => ({
        status: auditLog.status,
        targetSystem: auditLog.targetSystem,
      })),
      deadLetterCount,
      failedAttempt: writeFailedAudit?.metadata,
      finalStatus: runtime.finalStatus,
      managerName,
      queueJob: targetQueueJob,
      retryStatus: retryScheduledAudit?.metadata,
      sourceRequestId,
      successStatus: writeSucceededAudit?.metadata,
    },
    {
      correlationId: ingestResult.correlationId,
      eventId: ingestResult.eventId,
    },
  );
}

async function countPersistentRuntimeData() {
  const [
    canonicalEvents,
    auditLogs,
    conflicts,
    queueJobs,
    manualReviewItems,
    deadLetterJobs,
    departmentSnapshots,
    idempotencyKeys,
  ] = await Promise.all([
    prisma.canonicalEvent.count(),
    prisma.auditLog.count(),
    prisma.conflict.count(),
    prisma.queueJob.count(),
    prisma.manualReviewItem.count(),
    prisma.deadLetterJob.count(),
    prisma.departmentSnapshot.count(),
    prisma.idempotencyKey.count(),
  ]);

  return {
    auditLogs,
    canonicalEvents,
    conflicts,
    deadLetterJobs,
    departmentSnapshots,
    idempotencyKeys,
    manualReviewItems,
    queueJobs,
  };
}

async function primePersistentDemoTraffic() {
  const scenarioResults = [
    await runSwsToDepartmentsScenario(),
    await runDepartmentToSwsScenario(),
    await runConflictScenario(),
    await runManualReviewScenario(),
    await runIdempotencyScenario(),
    await runFailureRetryScenario(),
  ];

  return {
    runtimeSummary: await countPersistentRuntimeData(),
    scenarios: scenarioResults.map((result) => ({
      correlationId: result.correlationId,
      eventId: result.eventId,
      message: result.message,
      scenario: result.scenario,
      success: result.success,
    })),
  };
}

export async function resetScenarioDemoData(): Promise<ScenarioApiResponse> {
  await prepareScenarioDemoState();
  const liveTraffic = await primePersistentDemoTraffic();

  return buildScenarioResponse(
    "RESET_DEMO",
    "Demo data was reset and live scenario traffic was replayed through the K-Sync pipeline to repopulate the persisted dashboard state.",
    {
      restoredRecords: {
        businesses: demoSeedBusinesses.length,
        mockEkarmikaRecords: demoSeedBusinesses.filter((business) => business.labourRegNo)
          .length,
        mockEsurakshateRecords: demoSeedBusinesses.filter(
          (business) => business.factoryLicenseNo,
        ).length,
        mockSwsRecords: demoSeedBusinesses.length,
        ubidRegistryRows:
          demoSeedBusinesses.length +
          demoSeedBusinesses.filter((business) => business.labourRegNo).length +
          demoSeedBusinesses.filter((business) => business.factoryLicenseNo).length,
      },
      restoredRuntimeData: liveTraffic.runtimeSummary,
      replayedScenarios: liveTraffic.scenarios,
    },
  );
}
