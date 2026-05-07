import { afterEach, describe, expect, it } from "vitest";

import {
  clearSimulatedWriteFailures,
  consumeSimulatedWriteFailure,
  scheduleSimulatedWriteFailure,
} from "../modules/scenarios/failure-simulation.service";

describe("failure simulation service", () => {
  afterEach(() => {
    clearSimulatedWriteFailures();
  });

  it("fails the configured target only for the configured number of attempts", () => {
    scheduleSimulatedWriteFailure({
      reason: "intentional test failure",
      remainingFailures: 1,
      targetSystem: "EKARMIKA",
      ubid: "UBID-KA-2026-0001",
    });

    expect(
      consumeSimulatedWriteFailure("EKARMIKA", "UBID-KA-2026-0001"),
    ).toBe("intentional test failure");
    expect(
      consumeSimulatedWriteFailure("EKARMIKA", "UBID-KA-2026-0001"),
    ).toBeNull();
    expect(
      consumeSimulatedWriteFailure("ESURAKSHATE", "UBID-KA-2026-0001"),
    ).toBeNull();
  });
});
