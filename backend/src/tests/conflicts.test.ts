import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import app from "../app";
import prisma from "../config/prisma";
import { redisConnection } from "../config/redis";

const TEST_PREFIX = `TEST-CONFLICTS-${Date.now()}`;
const TEST_UBID = "UBID-KA-2026-0002";
const HOLDING_PEN_KEY = `ksync:holding-pen:${TEST_UBID}:registeredAddress`;

function buildEkarmikaAddressPayload(testCase: string) {
  return {
    changedFields: ["registeredAddress"],
    correlationId: `${TEST_PREFIX}-CORR-EK-${testCase}`,
    operation: "UPDATE",
    payload: {
      registeredAddress: {
        city: "Mysuru",
        line1: `14 Labour Circle ${TEST_PREFIX}-${testCase}`,
        postalCode: "570001",
        state: "Karnataka",
      },
    },
    serviceType: "REGISTERED_ADDRESS_CHANGE",
    sourceSystem: "EKARMIKA",
    ubid: TEST_UBID,
  } as const;
}

function buildSwsAddressPayload(testCase: string) {
  return {
    changedFields: ["registeredAddress"],
    correlationId: `${TEST_PREFIX}-CORR-SWS-${testCase}`,
    operation: "UPDATE",
    payload: {
      registeredAddress: {
        city: "Mysuru",
        line1: `99 Authority Avenue ${TEST_PREFIX}-${testCase}`,
        postalCode: "570001",
        state: "Karnataka",
      },
    },
    serviceType: "REGISTERED_ADDRESS_CHANGE",
    sourceRequestId: `${TEST_PREFIX}-REQ-SWS-${testCase}`,
    sourceSystem: "SWS",
    ubid: TEST_UBID,
  } as const;
}

async function clearHoldingPen() {
  try {
    await redisConnection.del(HOLDING_PEN_KEY);
  } catch {
    // Redis cleanup is best-effort for tests.
  }
}

async function cleanupTestData() {
  await prisma.manualReviewItem.deleteMany({
    where: {
      correlationId: {
        startsWith: `${TEST_PREFIX}-CORR-`,
      },
    },
  });

  await prisma.conflict.deleteMany({
    where: {
      correlationId: {
        startsWith: `${TEST_PREFIX}-CORR-`,
      },
    },
  });

  await prisma.queueJob.deleteMany({
    where: {
      correlationId: {
        startsWith: `${TEST_PREFIX}-CORR-`,
      },
    },
  });

  await prisma.auditLog.deleteMany({
    where: {
      correlationId: {
        startsWith: `${TEST_PREFIX}-CORR-`,
      },
    },
  });

  await prisma.idempotencyKey.deleteMany({
    where: {
      OR: [
        {
          sourceRequestId: {
            startsWith: `${TEST_PREFIX}-REQ-`,
          },
        },
        {
          eventId: {
            in: (
              await prisma.canonicalEvent.findMany({
                where: {
                  correlationId: {
                    startsWith: `${TEST_PREFIX}-CORR-`,
                  },
                },
                select: {
                  eventId: true,
                },
              })
            ).map((event) => event.eventId),
          },
        },
      ],
    },
  });

  await prisma.canonicalEvent.deleteMany({
    where: {
      correlationId: {
        startsWith: `${TEST_PREFIX}-CORR-`,
      },
    },
  });

  await clearHoldingPen();
}

describe.sequential("conflict resolution flow", () => {
  beforeAll(async () => {
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  it("auto-resolves registered address conflicts in favor of SWS over EKARMIKA", async () => {
    const ekarmikaPayload = buildEkarmikaAddressPayload("AUTO-WIN");
    const swsPayload = buildSwsAddressPayload("AUTO-WIN");

    const firstResponse = await request(app)
      .post("/api/ksync/ingest")
      .send(ekarmikaPayload)
      .expect(202);
    const secondResponse = await request(app)
      .post("/api/ksync/ingest")
      .send(swsPayload)
      .expect(202);

    expect(firstResponse.body.success).toBe(true);
    expect(firstResponse.body.data.duplicate).toBe(false);
    expect(firstResponse.body.data.status).toBe("TARGET_NOT_APPLICABLE");

    expect(secondResponse.body.success).toBe(true);
    expect(secondResponse.body.data.duplicate).toBe(false);
    expect(secondResponse.body.data.status).toBe("QUEUED");

    const losingEvent = await prisma.canonicalEvent.findUnique({
      where: {
        eventId: firstResponse.body.data.eventId as string,
      },
      select: {
        status: true,
      },
    });

    expect(losingEvent?.status).toBe("SUPERSEDED");

    const conflicts = await prisma.conflict.findMany({
      where: {
        correlationId: swsPayload.correlationId,
      },
      orderBy: {
        detectedAt: "desc",
      },
      select: {
        conflictId: true,
        conflictingFields: true,
        resolutionStatus: true,
      },
    });

    expect(conflicts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          resolutionStatus: "AUTO_RESOLVED",
        }),
      ]),
    );
    expect(conflicts[0]?.conflictingFields).toEqual(
      expect.arrayContaining(["registeredAddress"]),
    );

    const auditLogsResponse = await request(app)
      .get(`/api/audit/${swsPayload.correlationId}`)
      .expect(200);

    expect(auditLogsResponse.body.success).toBe(true);
    expect(auditLogsResponse.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: "CONFLICT_DETECTED" }),
        expect.objectContaining({ status: "CONFLICT_RESOLVED" }),
      ]),
    );

    const conflictsListResponse = await request(app)
      .get("/api/conflicts")
      .expect(200);
    expect(conflictsListResponse.body.success).toBe(true);
    expect(conflictsListResponse.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          conflictId: conflicts[0]?.conflictId,
        }),
      ]),
    );

    const conflictDetailResponse = await request(app)
      .get(`/api/conflicts/${encodeURIComponent(conflicts[0]!.conflictId)}`)
      .expect(200);
    expect(conflictDetailResponse.body.success).toBe(true);
    expect(conflictDetailResponse.body.data.conflictId).toBe(conflicts[0]?.conflictId);
  });
});
