import { ServiceType, SystemName } from "../../common/types/system.types";

export function createPrimaryIdempotencyKey(sourceSystem: SystemName, sourceRequestId: string): string {
  return `${sourceSystem}:${sourceRequestId}`;
}

export function createFallbackIdempotencyKey(
  sourceSystem: SystemName,
  ubid: string,
  serviceType: ServiceType,
  payloadHash: string,
): string {
  return `${sourceSystem}:${ubid}:${serviceType}:${payloadHash}`;
}
