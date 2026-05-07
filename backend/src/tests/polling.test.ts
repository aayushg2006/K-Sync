import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import app from "../app";
import { swsWriteQueue } from "../config/queues";
import prisma from "../config/prisma";
import { buildFactoryXml } from "../modules/mock-esurakshate/esurakshate.xml";
import { processSwsWriteJob } from "../modules/queues/processors/sws-write.processor";

const TEST_PREFIX = `TEST-POLLING-${Date.now()}`;
const TEST_UBID = "UBID-KA-2026-0003";
const FACTORY_LICENSE_NO = "FAC-KA-2026-0003";
const SEEDED_MANAGER_NAME = "Divya Narasimha";
const SEEDED_ADDRESS = "5 Hebbal Industrial Estate, Unit 7, Mysuru, Karnataka, 570016";
const UPDATED_MANAGER_NAME = `Polling Manager ${TEST_PREFIX}`;
const SEEDED_LAST_MODIFIED = new Date("2026-05-01T09:30:00.000Z");

function buildEsurakshateRawPayload(managerName: string) {
  return {
    BusinessName: "Mysuru Advanced Components LLP",
    FactoryAddress: SEEDED_ADDRESS,
    FactoryLicenseNo: FACTORY_LICENSE_NO,
    ManagerName: managerName,
    PowerCapacityHP: 54,
    Ubid: TEST_UBID,
    WorkerLimit: 120,
  };
}

function buildEsurakshateSnapshotXml(managerName: string) {
  return buildFactoryXml({
    FactorySnapshot: {
      BusinessName: "Mysuru Advanced Components LLP",
      FactoryAddress: SEEDED_ADDRESS,
      FactoryLicenseNo: FACTORY_LICENSE_NO,
      LastModified: SEEDED_LAST_MODIFIED.toISOString(),
      ManagerName: managerName,
      PowerCapacityHP: 54,
      Ubid: TEST_UBID,
      WorkerLimit: 120,
    },
  });
}

async function resetSeededRecords() {
  await prisma.mockSwsRecord.update({
    where: { ubid: TEST_UBID },
    data: {
      authorizedSignatory: {
        designation: "Operations Head",
        email: "divya.narasimha@example.com",
        mobile: "9000000003",
        name: SEEDED_MANAGER_NAME,
      },
      businessName: "Mysuru Advanced Components LLP",
      employeeCount: 92,
      factoryLicenseNo: FACTORY_LICENSE_NO,
      labourRegNo: null,
      lastModifiedAt: SEEDED_LAST_MODIFIED,
      licenseExpiry: "2027-08-15",
      powerCapacityHP: 54,
      rawPayload: {
        authorizedSignatory: {
          designation: "Operations Head",
          email: "divya.narasimha@example.com",
          mobile: "9000000003",
          name: SEEDED_MANAGER_NAME,
        },
        businessId: "SWS-BIZ-2026-0003",
        businessName: "Mysuru Advanced Components LLP",
        employeeCount: 92,
        factoryLicenseNo: FACTORY_LICENSE_NO,
        licenseExpiry: "2027-08-15",
        pan: "SYNTH9012C",
        powerCapacityHP: 54,
        registeredAddress: {
          city: "Mysuru",
          line1: "5 Hebbal Industrial Estate",
          line2: "Unit 7",
          postalCode: "570016",
          state: "Karnataka",
        },
        workerLimit: 120,
      },
      registeredAddress: {
        city: "Mysuru",
        line1: "5 Hebbal Industrial Estate",
        line2: "Unit 7",
        postalCode: "570016",
        state: "Karnataka",
      },
      sourceRequestId: "SWS-SEED-0003",
      workerLimit: 120,
    },
  });

  await prisma.mockEsurakshateRecord.update({
    where: { factoryLicenseNo: FACTORY_LICENSE_NO },
    data: {
      businessName: "Mysuru Advanced Components LLP",
      factoryAddress: SEEDED_ADDRESS,
      lastModifiedAt: SEEDED_LAST_MODIFIED,
      managerName: SEEDED_MANAGER_NAME,
      powerCapacityHP: 54,
      rawPayload: buildEsurakshateRawPayload(SEEDED_MANAGER_NAME),
      snapshotXml: buildEsurakshateSnapshotXml(SEEDED_MANAGER_NAME),
      workerLimit: 120,
    },
  });
}

async function cleanupTestData() {
  const testEvents = await prisma.canonicalEvent.findMany({
    where: {
      correlationId: {
        startsWith: `${TEST_PREFIX}-`,
      },
    },
    select: {
      eventId: true,
    },
  });
  const eventIds = testEvents.map((event) => event.eventId);

  await prisma.manualReviewItem.deleteMany({
    where: {
      OR: [
        {
          correlationId: {
            startsWith: `${TEST_PREFIX}-`,
          },
        },
        ...(eventIds.length > 0 ? [{ eventId: { in: eventIds } }] : []),
      ],
    },
  });

  await prisma.conflict.deleteMany({
    where: {
      OR: [
        {
          correlationId: {
            startsWith: `${TEST_PREFIX}-`,
          },
        },
        ...(eventIds.length > 0 ? [{ eventId: { in: eventIds } }] : []),
      ],
    },
  });

  await prisma.deadLetterJob.deleteMany({
    where: {
      OR: [
        {
          correlationId: {
            startsWith: `${TEST_PREFIX}-`,
          },
        },
        ...(eventIds.length > 0 ? [{ eventId: { in: eventIds } }] : []),
      ],
    },
  });

  await prisma.queueJob.deleteMany({
    where: {
      OR: [
        {
          correlationId: {
            startsWith: `${TEST_PREFIX}-`,
          },
        },
        ...(eventIds.length > 0 ? [{ eventId: { in: eventIds } }] : []),
      ],
    },
  });

  await prisma.auditLog.deleteMany({
    where: {
      correlationId: {
        startsWith: `${TEST_PREFIX}-`,
      },
    },
  });

  await prisma.idempotencyKey.deleteMany({
    where: {
      OR: [
        {
          sourceRequestId: {
            startsWith: `${TEST_PREFIX}-`,
          },
        },
        ...(eventIds.length > 0 ? [{ eventId: { in: eventIds } }] : []),
      ],
    },
  });

  await prisma.canonicalEvent.deleteMany({
    where: {
      correlationId: {
        startsWith: `${TEST_PREFIX}-`,
      },
    },
  });

  await prisma.departmentSnapshot.deleteMany({
    where: {
      systemName: "ESURAKSHATE",
      ubid: TEST_UBID,
    },
  });

  await resetSeededRecords();
}

describe.sequential("polling discovery flow", () => {
  beforeAll(async () => {
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  it("saves a baseline snapshot and propagates direct e-Surakshate manager updates to SWS", async () => {
    const baselineResponse = await request(app)
      .post(`/api/polling/run/ESURAKSHATE/${TEST_UBID}`)
      .expect(202);

    expect(baselineResponse.body.success).toBe(true);
    expect(baselineResponse.body.data.baselinesSaved).toBe(1);
    expect(baselineResponse.body.data.eventsCreated).toBe(0);

    const snapshotsResponse = await request(app)
      .get("/api/polling/snapshots")
      .expect(200);

    expect(snapshotsResponse.body.success).toBe(true);
    expect(snapshotsResponse.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          localIdentifier: FACTORY_LICENSE_NO,
          systemName: "ESURAKSHATE",
          ubid: TEST_UBID,
        }),
      ]),
    );

    await request(app)
      .post("/api/mock/esurakshate/manual-update")
      .send({
        changedFields: ["authorizedSignatory"],
        correlationId: `${TEST_PREFIX}-MANUAL-ESURAKSHATE`,
        operation: "UPDATE",
        payload: {
          authorizedSignatory: {
            name: UPDATED_MANAGER_NAME,
          },
        },
        serviceType: "AUTHORIZED_SIGNATORY_CHANGE",
        sourceSystem: "ESURAKSHATE",
        ubid: TEST_UBID,
      })
      .expect(200);

    const pollingResponse = await request(app)
      .post(`/api/polling/run/ESURAKSHATE/${TEST_UBID}`)
      .expect(202);

    expect(pollingResponse.body.success).toBe(true);
    expect(pollingResponse.body.data.eventsCreated).toBe(1);
    expect(pollingResponse.body.data.summaries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "EVENT_CREATED",
          serviceType: "AUTHORIZED_SIGNATORY_CHANGE",
          systemName: "ESURAKSHATE",
          ubid: TEST_UBID,
        }),
      ]),
    );

    const createdEventSummary = pollingResponse.body.data.summaries.find(
      (summary: { action?: string; serviceType?: string }) =>
        summary.action === "EVENT_CREATED" &&
        summary.serviceType === "AUTHORIZED_SIGNATORY_CHANGE",
    );
    expect(createdEventSummary).toBeDefined();

    const createdEvent = await prisma.canonicalEvent.findUnique({
      where: {
        eventId: createdEventSummary.eventId as string,
      },
      select: {
        eventId: true,
        serviceType: true,
        sourceSystem: true,
        status: true,
      },
    });

    expect(createdEvent).toEqual(
      expect.objectContaining({
        eventId: createdEventSummary.eventId,
        serviceType: "AUTHORIZED_SIGNATORY_CHANGE",
        sourceSystem: "ESURAKSHATE",
      }),
    );

    const swsQueueJobRecord = await prisma.queueJob.findFirst({
      where: {
        eventId: createdEventSummary.eventId as string,
        targetSystem: "SWS",
      },
      select: {
        jobId: true,
      },
    });

    expect(swsQueueJobRecord?.jobId).toBeDefined();

    const swsQueueJob = await swsWriteQueue.getJob(swsQueueJobRecord!.jobId);
    expect(swsQueueJob).not.toBeNull();

    await processSwsWriteJob(swsQueueJob!);

    const swsBusinessResponse = await request(app)
      .get(`/api/mock/sws/business/${TEST_UBID}`)
      .expect(200);

    expect(swsBusinessResponse.body.success).toBe(true);
    expect(swsBusinessResponse.body.data.authorizedSignatory.name).toBe(
      UPDATED_MANAGER_NAME,
    );
  });
});
