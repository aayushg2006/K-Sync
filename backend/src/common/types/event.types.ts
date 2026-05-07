import { EventStatus, OperationType, ServiceType, SystemName } from "./system.types";

export const CANONICAL_PAYLOAD_FIELDS = [
  "businessName",
  "registeredAddress",
  "authorizedSignatory",
  "employeeCount",
  "workerLimit",
  "powerCapacityHP",
  "licenseExpiry",
] as const;

export type CanonicalPayloadField = (typeof CANONICAL_PAYLOAD_FIELDS)[number];

export interface RegisteredAddress {
  line1: string;
  line2?: string;
  city: string;
  district?: string;
  state: string;
  postalCode: string;
}

export interface AuthorizedSignatory {
  name: string;
  designation?: string;
  email?: string;
  mobile?: string;
}

export interface CanonicalPayload {
  businessName?: string;
  registeredAddress?: RegisteredAddress;
  authorizedSignatory?: AuthorizedSignatory;
  employeeCount?: number;
  workerLimit?: number;
  powerCapacityHP?: number;
  licenseExpiry?: string;
}

export interface CanonicalEvent {
  eventId: string;
  correlationId: string;
  sourceSystem: SystemName;
  sourceRequestId?: string;
  ubid: string;
  serviceType: ServiceType;
  operation: OperationType;
  changedFields: CanonicalPayloadField[];
  payload: CanonicalPayload;
  normalizedPayloadHash: string;
  receivedAt: string;
  status: EventStatus;
}
