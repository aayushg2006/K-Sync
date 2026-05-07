import type { EventStatus, OperationType, ServiceType, SystemName } from "./event.types";

export const AUDIT_STAGES = [
  "INGESTION",
  "VALIDATION",
  "NORMALIZATION",
  "ROUTING",
  "CONFLICT_REVIEW",
  "DELIVERY",
] as const;

export type AuditStage = (typeof AUDIT_STAGES)[number];

export interface AuditLog {
  auditId: string;
  eventId: string;
  correlationId: string;
  ubid: string;
  sourceSystem: SystemName;
  targetSystem?: SystemName;
  serviceType: ServiceType;
  operation: OperationType;
  stage: AuditStage;
  status: EventStatus;
  message: string;
  sourceRequestId?: string;
  metadata?: Record<string, unknown>;
  recordedAt: string;
  createdAt?: string;
}
