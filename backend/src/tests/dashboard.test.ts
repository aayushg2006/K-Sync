import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import app from "../app";
import prisma from "../config/prisma";

async function resetDashboardBaseline() {
  await request(app).post("/api/ksync/reset-demo").expect(200);
}

describe.sequential("dashboard baseline data", () => {
  beforeAll(async () => {
    await resetDashboardBaseline();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("restores a populated dashboard baseline through reset-demo", async () => {
    const response = await request(app).post("/api/ksync/reset-demo").expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.details.restoredRuntimeData).toEqual(
      expect.objectContaining({
        auditLogs: expect.any(Number),
        canonicalEvents: 9,
        conflicts: 2,
        deadLetterJobs: 0,
        manualReviewItems: 1,
        queueJobs: expect.any(Number),
      }),
    );
    expect(response.body.details.replayedScenarios).toHaveLength(6);
  });

  it("returns persisted dashboard metrics with more than one event", async () => {
    const response = await request(app).get("/api/dashboard/metrics").expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.totalEvents).toBeGreaterThanOrEqual(9);
    expect(response.body.data.successfulSyncs).toBeGreaterThanOrEqual(3);
    expect(response.body.data.failedWrites).toBeGreaterThanOrEqual(1);
    expect(response.body.data.conflictsDetected).toBeGreaterThanOrEqual(2);
    expect(response.body.data.duplicateRequestsBlocked).toBeGreaterThanOrEqual(1);
    expect(response.body.data.pendingManualReviews).toBeGreaterThanOrEqual(1);
    expect(response.body.data.queueJobs).toBeGreaterThanOrEqual(5);
    expect(response.body.data.dlqJobs).toBe(0);
  });

  it("returns recent events, audit logs, and review queue data from the baseline", async () => {
    const [eventsResponse, auditResponse, conflictsResponse] = await Promise.all([
      request(app).get("/api/dashboard/events?limit=5&page=1"),
      request(app).get("/api/dashboard/audit?limit=5&page=1"),
      request(app).get("/api/dashboard/conflicts?limit=5&page=1"),
    ]);

    expect(eventsResponse.status).toBe(200);
    expect(eventsResponse.body.data.total).toBeGreaterThanOrEqual(9);
    expect(eventsResponse.body.data.items).toHaveLength(5);
    expect(eventsResponse.body.data.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: "MANUAL_REVIEW_REQUIRED",
        }),
      ]),
    );

    expect(auditResponse.status).toBe(200);
    expect(auditResponse.body.data.total).toBeGreaterThanOrEqual(15);
    expect(auditResponse.body.data.items).toHaveLength(5);

    expect(conflictsResponse.status).toBe(200);
    expect(conflictsResponse.body.data.total).toBeGreaterThanOrEqual(2);
    expect(conflictsResponse.body.data.manualReviewItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          reviewStatus: "OPEN",
        }),
      ]),
    );
  });
});
