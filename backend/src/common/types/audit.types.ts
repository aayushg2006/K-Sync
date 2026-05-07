import { AuditStage, EventStatus, OperationType, ServiceType, SystemName } from "./system.types";

export interface AuditLogInput {
  auditId?: string;
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
}
