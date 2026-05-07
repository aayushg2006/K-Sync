import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import app from "../app";
import prisma from "../config/prisma";

async function resetDemoState() {
  await request(app).post("/api/ksync/reset-demo").expect(200);
}

describe.sequential("scenario runner APIs", () => {
  beforeAll(async () => {
    await resetDemoState();
  });

  afterAll(async () => {
    await resetDemoState();
    await prisma.$disconnect();
  });

  it("returns correlationId and targets for Scenario 1", async () => {
    const baselineMetrics = await request(app).get("/api/dashboard/metrics").expect(200);
    const response = await request(app)
      .post("/api/ksync/run-scenario/sws-to-departments")
      .expect(202);
    const updatedMetrics = await request(app).get("/api/dashboard/metrics").expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.scenario).toBe("SWS_TO_DEPARTMENTS");
    expect(response.body.correlationId).toBeTruthy();
    expect(response.body.eventId).toBeTruthy();
    expect(updatedMetrics.body.data.totalEvents).toBeGreaterThan(
      baselineMetrics.body.data.totalEvents,
    );
    expect(response.body.details.targets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          targetSystem: "EKARMIKA",
        }),
        expect.objectContaining({
          targetSystem: "ESURAKSHATE",
        }),
      ]),
    );
  });

  it("creates a fresh event for repeated Scenario 1 runs", async () => {
    const firstResponse = await request(app)
      .post("/api/ksync/run-scenario/sws-to-departments")
      .expect(202);
    const secondResponse = await request(app)
      .post("/api/ksync/run-scenario/sws-to-departments")
      .expect(202);

    expect(firstResponse.body.eventId).not.toBe(secondResponse.body.eventId);
    expect(firstResponse.body.details.addressLine).not.toBe(
      secondResponse.body.details.addressLine,
    );
  });

  it("returns duplicate detection for Scenario 4", async () => {
    const response = await request(app)
      .post("/api/ksync/run-scenario/idempotency")
      .expect(202);

    expect(response.body.success).toBe(true);
    expect(response.body.scenario).toBe("IDEMPOTENCY");
    expect(response.body.details.firstResult.duplicate).toBe(false);
    expect(response.body.details.duplicateResult.duplicate).toBe(true);
  });

  it("syncs a fresh manager name back into SWS for Scenario 2", async () => {
    const response = await request(app)
      .post("/api/ksync/run-scenario/department-to-sws")
      .expect(202);

    expect(response.body.success).toBe(true);
    expect(response.body.scenario).toBe("DEPARTMENT_TO_SWS");
    expect(response.body.details.managerName).toBeTruthy();
    expect(response.body.details.swsAuthorizedSignatoryName).toBe(
      response.body.details.managerName,
    );
  });

  it("creates a persisted manual review item for Scenario 4", async () => {
    const response = await request(app)
      .post("/api/ksync/run-scenario/manual-review")
      .expect(202);

    expect(response.body.success).toBe(true);
    expect(response.body.scenario).toBe("MANUAL_REVIEW");
    expect(response.body.conflictId).toBeTruthy();
    expect(response.body.details.reviewItem).toEqual(
      expect.objectContaining({
        reviewId: expect.any(String),
        reviewStatus: "OPEN",
      }),
    );
  });
});
