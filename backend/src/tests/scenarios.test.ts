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
    const response = await request(app)
      .post("/api/ksync/run-scenario/sws-to-departments")
      .expect(202);

    expect(response.body.success).toBe(true);
    expect(response.body.scenario).toBe("SWS_TO_DEPARTMENTS");
    expect(response.body.correlationId).toBeTruthy();
    expect(response.body.eventId).toBeTruthy();
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

  it("returns duplicate detection for Scenario 4", async () => {
    const response = await request(app)
      .post("/api/ksync/run-scenario/idempotency")
      .expect(202);

    expect(response.body.success).toBe(true);
    expect(response.body.scenario).toBe("IDEMPOTENCY");
    expect(response.body.details.firstResult.duplicate).toBe(false);
    expect(response.body.details.duplicateResult.duplicate).toBe(true);
  });
});
