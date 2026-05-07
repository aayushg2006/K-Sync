import { createHash } from "node:crypto";

import { nanoid } from "nanoid";

import { CanonicalEvent, CanonicalPayload } from "../../common/types/event.types";
import { OperationType, ServiceType, SystemName } from "../../common/types/system.types";

interface CreateCanonicalEventInput {
  changedFields: CanonicalEvent["changedFields"];
  correlationId?: string;
  operation: OperationType;
  payload: CanonicalPayload;
  serviceType: ServiceType;
  sourceRequestId?: string;
  sourceSystem: SystemName;
  ubid: string;
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }

  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((accumulator, key) => {
        accumulator[key] = sortValue((value as Record<string, unknown>)[key]);
        return accumulator;
      }, {});
  }

  return value;
}

export function computeNormalizedPayloadHash(payload: CanonicalPayload): string {
  const normalizedPayload = JSON.stringify(sortValue(payload));

  return createHash("sha256").update(normalizedPayload).digest("hex");
}

export function createCanonicalEvent(input: CreateCanonicalEventInput): CanonicalEvent {
  const receivedAt = new Date().toISOString();

  return {
    eventId: `EVT-${nanoid(12)}`,
    correlationId: input.correlationId ?? `CORR-${nanoid(12)}`,
    sourceSystem: input.sourceSystem,
    sourceRequestId: input.sourceRequestId,
    ubid: input.ubid,
    serviceType: input.serviceType,
    operation: input.operation,
    changedFields: input.changedFields,
    payload: input.payload,
    normalizedPayloadHash: computeNormalizedPayloadHash(input.payload),
    receivedAt,
    status: "RECEIVED",
  };
}
