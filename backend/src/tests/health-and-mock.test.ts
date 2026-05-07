import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";

import app from "../app";
import prisma from "../config/prisma";

describe("health and mock API smoke tests", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("returns 200 from GET /health", async () => {
    const response = await request(app).get("/health").expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({
        status: "ok",
      }),
    );
  });

  it("returns the seeded SWS business for UBID-KA-2026-0001", async () => {
    const response = await request(app)
      .get("/api/mock/sws/business/UBID-KA-2026-0001")
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data).toEqual(
      expect.objectContaining({
        businessName: "Pragati Precision Works Pvt Ltd",
        ubid: "UBID-KA-2026-0001",
      }),
    );
  });
});
