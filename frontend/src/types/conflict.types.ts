import type { CanonicalPayload, CanonicalPayloadField, ServiceType, SystemName } from "./event.types";

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
  conflictingFields: CanonicalPayloadField[];
  sourcePayload: CanonicalPayload;
  targetPayload: CanonicalPayload;
  detectedAt: string;
  outcome: ConflictOutcome;
  resolutionStatus?: string;
  reviewStatus?: string;
  explanation?: string;
  winningEventId?: string;
  losingEventId?: string;
  authorityDecision?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  reviewedBy?: string;
  reviewedAt?: string;
  notes?: string;
}

export interface ManualReviewItem {
  reviewId: string;
  reviewStatus: string;
  reviewType: string;
  eventId?: string;
  conflictId?: string;
  jobId?: string;
  correlationId?: string;
  ubid?: string;
  sourceSystem?: SystemName;
  targetSystem?: SystemName;
  title: string;
  summary?: string;
  payload?: Record<string, unknown>;
  resolutionPayload?: Record<string, unknown>;
  reviewerNotes?: string;
  assignedTo?: string;
  openedAt: string;
  reviewedAt?: string;
  closedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConflictReviewRequest {
  reviewerId?: string;
  reviewedBy?: string;
  action?: "APPROVED" | "REJECTED";
  outcome?: ConflictOutcome;
  notes?: string;
  reviewedAt?: string;
}
