import { CanonicalPayload } from "./event.types";
import { ServiceType, SystemName } from "./system.types";

export const CONFLICT_OUTCOMES = [
  "PENDING_REVIEW",
  "SOURCE_ACCEPTED",
  "TARGET_ACCEPTED",
  "MERGED",
  "REJECTED",
] as const;

export type ConflictOutcome = (typeof CONFLICT_OUTCOMES)[number];

export interface ConflictRecord {
  conflictId: string;
  eventId: string;
  correlationId: string;
  ubid: string;
  serviceType: ServiceType;
  sourceSystem: SystemName;
  targetSystem: SystemName;
  conflictingFields: string[];
  sourcePayload: CanonicalPayload;
  targetPayload: CanonicalPayload;
  detectedAt: string;
  outcome: ConflictOutcome;
  reviewedBy?: string;
  reviewedAt?: string;
  notes?: string;
}

export interface AuthorityMatrixRule {
  fieldPath: string;
  authoritativeSystem: SystemName;
  fallbackSystem?: SystemName;
  manualReviewRequired: boolean;
  serviceType?: ServiceType;
}
