import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import app from "../app";
import prisma from "../config/prisma";

const TEST_PREFIX = "TEST-KSYNC";
const TEST_RUN_PREFIX = `${TEST_PREFIX}-${Date.now()}`;

function buildIngestPayload(testCase: string) {
  const correlationId = `${TEST_RUN_PREFIX}-CORR-${testCase}`;
  const sourceRequestId = `${TEST_RUN_PREFIX}-REQ-${testCase}`;

  return {
    changedFields: ["registeredAddress"],
    correlationId,
    operation: "UPDATE",
    payload: {
      registeredAddress: {
        city: "Bengaluru",
        line1: `42 Test Lane ${TEST_RUN_PREFIX}-${testCase}`,
        postalCode: "560025",
        state: "Karnataka",
      },
    },
    serviceType: "REGISTERED_ADDRESS_CHANGE",
    sourceRequestId,
    sourceSystem: "SWS",
    ubid: "UBID-KA-2026-0001",
  } as const;
}

async function cleanupTestData() {
  await prisma.deadLetterJob.deleteMany({
    where: {
      OR: [
        { correlationId: { startsWith: `${TEST_RUN_PREFIX}-CORR-` } },
        { eventId: { startsWith: `${TEST_RUN_PREFIX}-` } },
      ],
    },
  });

  await prisma.queueJob.deleteMany({
    where: {
      OR: [
        { correlationId: { startsWith: `${TEST_RUN_PREFIX}-CORR-` } },
        { eventId: { startsWith: `${TEST_RUN_PREFIX}-` } },
      ],
    },
  });

  await prisma.auditLog.deleteMany({
    where: {
      OR: [
        { correlationId: { startsWith: `${TEST_RUN_PREFIX}-CORR-` } },
        { sourceRequestId: { startsWith: `${TEST_RUN_PREFIX}-REQ-` } },
      ],
    },
  });

  await prisma.idempotencyKey.deleteMany({
    where: {
      sourceRequestId: {
        startsWith: `${TEST_RUN_PREFIX}-REQ-`,
      },
    },
  });

  await prisma.canonicalEvent.deleteMany({
    where: {
      OR: [
        { correlationId: { startsWith: `${TEST_RUN_PREFIX}-CORR-` } },
        { sourceRequestId: { startsWith: `${TEST_RUN_PREFIX}-REQ-` } },
      ],
    },
  });
}

describe.sequential("ksync prisma flow", () => {
  beforeAll(async () => {
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  it("creates a canonical event and audit logs during ingest", async () => {
    const payload = buildIngestPayload("CREATE-AUDIT");
    const response = await request(app)
      .post("/api/ksync/ingest")
      .send(payload)
      .expect(202);

    expect(response.body.success).toBe(true);
    expect(response.body.data.duplicate).toBe(false);
    expect(response.body.data.status).toBe("QUEUED");

    const event = await prisma.canonicalEvent.findUnique({
      where: {
        eventId: response.body.data.eventId as string,
      },
    });

    expect(event).not.toBeNull();
    expect(event?.correlationId).toBe(payload.correlationId);
    expect(
      [
        "QUEUED",
        "TRANSLATED",
        "WRITE_ATTEMPTED",
        "WRITE_SUCCEEDED",
        "COMPLETED",
      ],
    ).toContain(event?.status);

    const queueJobs = await prisma.queueJob.findMany({
      where: {
        eventId: response.body.data.eventId as string,
      },
      orderBy: {
        targetSystem: "asc",
      },
    });

    expect(queueJobs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          targetSystem: "EKARMIKA",
        }),
        expect.objectContaining({
          targetSystem: "ESURAKSHATE",
        }),
      ]),
    );
    expect(
      queueJobs.every((queueJob) =>
        [
          "QUEUED",
          "PROCESSING",
          "COMPLETED",
          "RETRY_SCHEDULED",
          "DLQ_MOVED",
        ].includes(queueJob.status),
      ),
    ).toBe(true);

    const auditLogsResponse = await request(app)
      .get(`/api/audit/${payload.correlationId}`)
      .expect(200);

    expect(auditLogsResponse.body.success).toBe(true);
    expect(auditLogsResponse.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: "RECEIVED" }),
        expect.objectContaining({ status: "IDEMPOTENCY_ACCEPTED" }),
        expect.objectContaining({ status: "ROUTED" }),
        expect.objectContaining({ status: "QUEUED" }),
      ]),
    );
  });

  it("detects duplicate sourceRequestId submissions", async () => {
    const firstPayload = buildIngestPayload("DUPLICATE");
    const secondPayload = {
      ...firstPayload,
      correlationId: `${TEST_RUN_PREFIX}-CORR-DUPLICATE-SECOND`,
    };

    const firstResponse = await request(app)
      .post("/api/ksync/ingest")
      .send(firstPayload)
      .expect(202);
    const secondResponse = await request(app)
      .post("/api/ksync/ingest")
      .send(secondPayload)
      .expect(202);

    expect(firstResponse.body.data.duplicate).toBe(false);
    expect(secondResponse.body.data.duplicate).toBe(true);
    expect(secondResponse.body.data.eventId).toBe(firstResponse.body.data.eventId);
  });

  it("routes UBID-KA-2026-0001 to EKARMIKA and ESURAKSHATE for SWS address changes", async () => {
    const payload = buildIngestPayload("ROUTING");
    const response = await request(app)
      .post("/api/ksync/ingest")
      .send(payload)
      .expect(202);

    expect(response.body.data.duplicate).toBe(false);
    expect(response.body.data.targets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          localIdentifier: "LAB-KA-2026-0001",
          targetSystem: "EKARMIKA",
        }),
        expect.objectContaining({
          localIdentifier: "FAC-KA-2026-0001",
          targetSystem: "ESURAKSHATE",
        }),
      ]),
    );
    expect(
      response.body.data.targets.some(
        (target: { targetSystem?: string }) => target.targetSystem === "SWS",
      ),
    ).toBe(false);
  });
});
