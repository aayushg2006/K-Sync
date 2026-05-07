export const SYSTEM_NAMES = ["SWS", "EKARMIKA", "ESURAKSHATE", "KSYNC"] as const;

export type SystemName = (typeof SYSTEM_NAMES)[number];

export const SERVICE_TYPES = [
  "REGISTERED_ADDRESS_CHANGE",
  "AUTHORIZED_SIGNATORY_CHANGE",
  "EMPLOYEE_COUNT_CHANGE",
  "LICENSE_EXPIRY_CHANGE",
  "POWER_CAPACITY_CHANGE",
] as const;

export type ServiceType = (typeof SERVICE_TYPES)[number];

export const OPERATION_TYPES = ["CREATE", "UPDATE", "DELETE"] as const;

export type OperationType = (typeof OPERATION_TYPES)[number];

export const EVENT_STATUSES = [
  "RECEIVED",
  "VALIDATED",
  "IDEMPOTENCY_ACCEPTED",
  "DUPLICATE_DETECTED",
  "NORMALIZED",
  "CONFLICT_CHECKED",
  "CONFLICTED",
  "CONFLICT_DETECTED",
  "CONFLICT_RESOLVED",
  "ROUTED",
  "TRANSLATED",
  "QUEUED",
  "WRITE_ATTEMPTED",
  "WRITE_SUCCEEDED",
  "WRITE_FAILED",
  "RETRY_SCHEDULED",
  "DLQ_MOVED",
  "COMPLETED",
  "FAILED",
  "MANUAL_REVIEW_REQUIRED",
  "PROPAGATED_CHANGE_CONFIRMED",
  "TARGET_NOT_APPLICABLE",
  "REGISTRATION_REQUIRED",
  "TARGET_MAPPING_MISSING",
  "SUPERSEDED",
] as const;

export type EventStatus = (typeof EVENT_STATUSES)[number];

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
  targetSystem?: SystemName;
  sourceRequestId?: string;
  ubid: string;
  serviceType: ServiceType;
  operation: OperationType;
  changedFields: CanonicalPayloadField[];
  payload: CanonicalPayload;
  normalizedPayloadHash: string;
  receivedAt: string;
  status: EventStatus;
  routeTargets?: Array<Record<string, unknown>>;
  metadata?: Record<string, unknown>;
  completedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface EventDetail {
  event: CanonicalEvent;
  auditLogs: Array<Record<string, unknown>>;
}
