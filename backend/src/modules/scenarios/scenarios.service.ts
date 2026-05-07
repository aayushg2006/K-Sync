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
      "WRITE_SUCCEEDED",
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

async function restoreBusinesses() {
  await prisma.business.deleteMany();

  await prisma.business.createMany({
    data: demoSeedBusinesses.map((business) => ({
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

async function restoreRegistry() {
  await prisma.ubidRegistry.deleteMany();

  const registryRows: Prisma.UbidRegistryCreateManyInput[] = [];

  for (const business of demoSeedBusinesses) {
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

async function restoreMockRecords() {
  await prisma.mockEkarmikaRecord.deleteMany();
  await prisma.mockEsurakshateRecord.deleteMany();
  await prisma.mockSwsRecord.deleteMany();

  await prisma.mockSwsRecord.createMany({
    data: demoSeedBusinesses.map((business) => ({
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

  const ekarmikaBusinesses = demoSeedBusinesses.filter((business) => business.labourRegNo);
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

  const esurakshateBusinesses = demoSeedBusinesses.filter(
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
  await prepareScenarioDemoState();

  const sourceRequestId = `scenario-sws-address-${Date.now()}`;
  const correlationId = buildCorrelationId("sws-address");
  const payload: CanonicalPayload = {
    registeredAddress: buildScenarioAddress({
      district: "Bengaluru Urban",
      line1: "Plot 44, Peenya Industrial Area",
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
    ubid: "UBID-KA-2026-0001",
  });
  const runtime = await waitForEventSummary(ingestResult.eventId);
  const [ekarmikaRecord, esurakshateRecord] = await Promise.all([
    getEstablishmentByLabourRegNo("LAB-KA-2026-0001"),
    getFactoryByLicenseNo("FAC-KA-2026-0001"),
  ]);

  assertScenario(
    ekarmikaRecord.addressFull?.includes("Plot 44, Peenya Industrial Area"),
    "Scenario 1 did not update mock e-Karmika with the propagated address.",
    {
      addressFull: ekarmikaRecord.addressFull,
      eventId: ingestResult.eventId,
    },
  );
  assertScenario(
    esurakshateRecord.factoryAddress?.includes("Plot 44, Peenya Industrial Area"),
    "Scenario 1 did not update mock e-Surakshate with the propagated address.",
    {
      eventId: ingestResult.eventId,
      factoryAddress: esurakshateRecord.factoryAddress,
    },
  );

  return buildScenarioResponse(
    "SWS_TO_DEPARTMENTS",
    "SWS address change propagated to both department systems through the existing K-Sync pipeline.",
    {
      auditStatuses: runtime.auditLogs.map((auditLog) => auditLog.status),
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
  await prepareScenarioDemoState();

  const ubid = "UBID-KA-2026-0001";
  const baseline = await ensurePollingBaseline("ESURAKSHATE", ubid);

  await manuallyUpdateFactory({
    changedFields: ["authorizedSignatory"],
    correlationId: buildCorrelationId("department-to-sws"),
    operation: "UPDATE",
    payload: {
      authorizedSignatory: {
        name: "Meera Rao",
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
    getFactoryByLicenseNo("FAC-KA-2026-0001"),
  ]);

  assertScenario(
    swsBusiness.authorizedSignatory?.name === "Meera Rao",
    "Scenario 2 did not sync Meera Rao back into mock SWS.",
    {
      authorizedSignatory: swsBusiness.authorizedSignatory,
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
  await prepareScenarioDemoState();

  const ubid = "UBID-KA-2026-0001";
  const baseline = await ensurePollingBaseline("EKARMIKA", ubid);

  await manuallyUpdateEstablishment({
    changedFields: ["registeredAddress"],
    correlationId: buildCorrelationId("conflict-ekarmika"),
    operation: "UPDATE",
    payload: {
      registeredAddress: buildScenarioAddress({
        district: "Bengaluru Rural",
        line1: "92 Competing Labour Layout",
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
        line1: "11 Authority Matrix Road",
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
      explanation,
      involvedEventIds: {
        ekarmikaEventId: ekarmikaEvent.eventId,
        swsEventId: swsResult.eventId,
      },
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

export async function runIdempotencyScenario(): Promise<ScenarioApiResponse> {
  await prepareScenarioDemoState();

  const sourceRequestId = `scenario-idempotency-${Date.now()}`;
  const payload: CanonicalPayload = {
    registeredAddress: buildScenarioAddress({
      district: "Bengaluru Urban",
      line1: "77 Duplicate Guard Street",
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
    ubid: "UBID-KA-2026-0001",
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
    ubid: "UBID-KA-2026-0001",
  });

  assertScenario(
    secondResult.duplicate,
    "Scenario 4 did not mark the second submission as a duplicate.",
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
    "Scenario 4 unexpectedly created queue jobs for the duplicate event record.",
    {
      duplicateEventRecord,
      duplicateQueueJobs,
    },
  );

  return buildScenarioResponse(
    "IDEMPOTENCY",
    "Idempotency check accepted the first request and rejected the duplicate submission.",
    {
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
  await prepareScenarioDemoState();

  scheduleSimulatedWriteFailure({
    reason: "Scenario runner intentionally failed the first e-Karmika write attempt.",
    remainingFailures: 1,
    targetSystem: "EKARMIKA",
    ubid: "UBID-KA-2026-0001",
  });

  const sourceRequestId = `scenario-failure-retry-${Date.now()}`;
  const ingestResult = await ingestRequest({
    changedFields: ["registeredAddress"],
    correlationId: buildCorrelationId("failure-retry"),
    operation: "UPDATE",
    payload: {
      registeredAddress: buildScenarioAddress({
        district: "Bengaluru Urban",
        line1: "130 Retry Success Park",
        postalCode: "560058",
      }),
    },
    serviceType: "REGISTERED_ADDRESS_CHANGE",
    sourceRequestId,
    sourceSystem: "SWS",
    ubid: "UBID-KA-2026-0001",
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
  const ekarmikaQueueJob = runtime.queueStatuses.find(
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
    "Scenario 5 did not emit the expected WRITE_FAILED audit entry for e-Karmika.",
    runtime.auditLogs,
  );
  assertScenario(
    Boolean(retryScheduledAudit),
    "Scenario 5 did not emit the expected RETRY_SCHEDULED audit entry for e-Karmika.",
    runtime.auditLogs,
  );
  assertScenario(
    Boolean(writeSucceededAudit),
    "Scenario 5 did not emit the expected WRITE_SUCCEEDED audit entry after retry.",
    runtime.auditLogs,
  );
  assertScenario(
    deadLetterCount === 0,
    "Scenario 5 unexpectedly moved the job to the dead-letter queue.",
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
      queueJob: ekarmikaQueueJob,
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

export async function resetScenarioDemoData(): Promise<ScenarioApiResponse> {
  await prepareScenarioDemoState();

  return buildScenarioResponse(
    "RESET_DEMO",
    "Demo data, queue state, snapshots, and mock system records were restored to the deterministic seed baseline.",
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
    },
  );
}
