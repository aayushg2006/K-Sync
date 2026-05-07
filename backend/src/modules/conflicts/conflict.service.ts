import {
  ConflictResolutionStatus,
  Prisma,
  ReviewStatus,
} from "@prisma/client";
import { nanoid } from "nanoid";

import { AppError } from "../../common/errors/AppError";
import { ERROR_CODES } from "../../common/errors/errorCodes";
import { AuditLogInput } from "../../common/types/audit.types";
import {
  CanonicalEvent,
  CanonicalPayload,
  CanonicalPayloadField,
} from "../../common/types/event.types";
import { EventStatus, SystemName } from "../../common/types/system.types";
import prisma from "../../config/prisma";
import { writeAuditLog } from "../audit/audit.service";
import {
  AuthorityRuleRecord,
  getAuthorityRule,
} from "./authority-matrix.service";
import {
  CanonicalFieldPath,
  getCanonicalFieldPathsForEvent,
} from "./canonical-field-paths";
import { addToHoldingPen, checkForConflicts } from "./holding-pen.service";

export interface ConflictApiRecord {
  authorityDecision?: Record<string, unknown>;
  conflictId: string;
  conflictingFields: string[];
  correlationId: string;
  detectedAt: string;
  eventId: string;
  metadata?: Record<string, unknown>;
  notes?: string;
  outcome: "MERGED" | "PENDING_REVIEW" | "REJECTED" | "SOURCE_ACCEPTED" | "TARGET_ACCEPTED";
  resolutionStatus: ConflictResolutionStatus;
  reviewStatus?: ReviewStatus;
  reviewedAt?: string;
  reviewedBy?: string;
  serviceType: CanonicalEvent["serviceType"];
  sourcePayload: CanonicalPayload;
  sourceSystem: CanonicalEvent["sourceSystem"];
  targetPayload: CanonicalPayload;
  targetSystem: SystemName;
  ubid: string;
}

export interface ConflictReviewInput {
  action?: "APPROVED" | "REJECTED";
  notes?: string;
  outcome?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  reviewerId?: string;
}

export interface ConflictReplayResult {
  conflictId: string;
  replayed: false;
  reviewStatus?: ReviewStatus;
  status: "NOT_IMPLEMENTED";
}

export interface ConflictDetectionResult {
  conflictIds: string[];
  status: EventStatus;
  shouldContinue: boolean;
  superseded: boolean;
}

interface ConflictCandidateGroup {
  competingEvent: CanonicalEvent;
  fieldPaths: CanonicalFieldPath[];
}

interface FieldDecision {
  authoritativeSystem: SystemName;
  fallbackSystem?: SystemName;
  fieldPath: CanonicalFieldPath;
  reason: string;
  winner: "CURRENT" | "OTHER" | "MANUAL";
}

type CandidateOutcome = "CURRENT_LOSES" | "CURRENT_WINS" | "MANUAL_REVIEW_REQUIRED";

type CanonicalEventRow = {
  changedFields: Prisma.JsonValue;
  correlationId: string;
  eventId: string;
  metadata: Prisma.JsonValue | null;
  normalizedPayloadHash: string;
  operation: CanonicalEvent["operation"];
  payload: Prisma.JsonValue;
  receivedAt: Date;
  serviceType: CanonicalEvent["serviceType"];
  sourceRequestId: string | null;
  sourceSystem: CanonicalEvent["sourceSystem"];
  status: EventStatus;
  ubid: string;
};

type ConflictRow = {
  authorityDecision: Prisma.JsonValue | null;
  conflictId: string;
  conflictingFields: Prisma.JsonValue;
  correlationId: string;
  detectedAt: Date;
  eventId: string;
  metadata: Prisma.JsonValue | null;
  notes: string | null;
  resolutionStatus: ConflictResolutionStatus;
  reviewStatus: ReviewStatus | null;
  reviewedAt: Date | null;
  reviewedBy: string | null;
  serviceType: CanonicalEvent["serviceType"];
  sourcePayload: Prisma.JsonValue;
  sourceSystem: CanonicalEvent["sourceSystem"];
  targetPayload: Prisma.JsonValue;
  targetSystem: SystemName;
  ubid: string;
};

function clone<T>(value: T): T {
  return structuredClone(value);
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function parseJsonArray<T>(value: Prisma.JsonValue | null): T[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return clone(value as T[]);
}

function parseJsonObject<T>(value: Prisma.JsonValue | null): T | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }

  return clone(value as T);
}

function toCanonicalEvent(record: CanonicalEventRow): CanonicalEvent {
  return {
    changedFields: parseJsonArray<CanonicalPayloadField>(record.changedFields),
    correlationId: record.correlationId,
    eventId: record.eventId,
    normalizedPayloadHash: record.normalizedPayloadHash,
    operation: record.operation,
    payload: clone(record.payload as CanonicalPayload),
    receivedAt: record.receivedAt.toISOString(),
    serviceType: record.serviceType,
    sourceRequestId: record.sourceRequestId ?? undefined,
    sourceSystem: record.sourceSystem,
    status: record.status,
    ubid: record.ubid,
  };
}

function deriveConflictOutcome(
  sourceSystem: SystemName,
  targetSystem: SystemName,
  resolutionStatus: ConflictResolutionStatus,
  reviewStatus?: ReviewStatus,
): ConflictApiRecord["outcome"] {
  if (reviewStatus === ReviewStatus.REJECTED) {
    return "REJECTED";
  }

  if (resolutionStatus === ConflictResolutionStatus.MANUAL_REVIEW_REQUIRED) {
    return "PENDING_REVIEW";
  }

  if (resolutionStatus === ConflictResolutionStatus.SUPERSEDED) {
    return "TARGET_ACCEPTED";
  }

  if (resolutionStatus === ConflictResolutionStatus.AUTO_RESOLVED) {
    return sourceSystem === targetSystem ? "MERGED" : "SOURCE_ACCEPTED";
  }

  return "PENDING_REVIEW";
}

function toConflictApiRecord(record: ConflictRow): ConflictApiRecord {
  return {
    authorityDecision: parseJsonObject<Record<string, unknown>>(record.authorityDecision),
    conflictId: record.conflictId,
    conflictingFields: parseJsonArray<string>(record.conflictingFields),
    correlationId: record.correlationId,
    detectedAt: record.detectedAt.toISOString(),
    eventId: record.eventId,
    metadata: parseJsonObject<Record<string, unknown>>(record.metadata),
    notes: record.notes ?? undefined,
    outcome: deriveConflictOutcome(
      record.sourceSystem,
      record.targetSystem,
      record.resolutionStatus,
      record.reviewStatus ?? undefined,
    ),
    resolutionStatus: record.resolutionStatus,
    reviewStatus: record.reviewStatus ?? undefined,
    reviewedAt: record.reviewedAt?.toISOString(),
    reviewedBy: record.reviewedBy ?? undefined,
    serviceType: record.serviceType,
    sourcePayload: clone(record.sourcePayload as CanonicalPayload),
    sourceSystem: record.sourceSystem,
    targetPayload: clone(record.targetPayload as CanonicalPayload),
    targetSystem: record.targetSystem,
    ubid: record.ubid,
  };
}

function buildAuditEntry(
  event: CanonicalEvent,
  status: EventStatus,
  message: string,
  input: {
    metadata?: Record<string, unknown>;
    targetSystem?: SystemName;
  },
): AuditLogInput {
  return {
    correlationId: event.correlationId,
    eventId: event.eventId,
    message,
    metadata: input.metadata,
    operation: event.operation,
    recordedAt: new Date().toISOString(),
    serviceType: event.serviceType,
    sourceRequestId: event.sourceRequestId,
    sourceSystem: event.sourceSystem,
    stage: "CONFLICT_REVIEW",
    status,
    targetSystem: input.targetSystem,
    ubid: event.ubid,
  };
}

async function loadCanonicalEventOrThrow(eventId: string): Promise<CanonicalEvent> {
  const event = await prisma.canonicalEvent.findUnique({
    where: { eventId },
    select: {
      changedFields: true,
      correlationId: true,
      eventId: true,
      metadata: true,
      normalizedPayloadHash: true,
      operation: true,
      payload: true,
      receivedAt: true,
      serviceType: true,
      sourceRequestId: true,
      sourceSystem: true,
      status: true,
      ubid: true,
    },
  });

  if (!event) {
    throw new AppError({
      code: ERROR_CODES.NOT_FOUND,
      message: `Canonical event ${eventId} was not found for conflict processing.`,
      statusCode: 404,
    });
  }

  return toCanonicalEvent(event);
}

async function updateCanonicalEventStatus(
  eventId: string,
  status: EventStatus,
  metadata?: Record<string, unknown>,
) {
  const existingRecord = await prisma.canonicalEvent.findUnique({
    where: { eventId },
    select: {
      metadata: true,
    },
  });
  const existingMetadata =
    parseJsonObject<Record<string, unknown>>(existingRecord?.metadata ?? null) ?? {};

  await prisma.canonicalEvent.update({
    where: { eventId },
    data: {
      metadata: metadata
        ? toJsonValue({
            ...existingMetadata,
            ...metadata,
          })
        : undefined,
      status,
    },
  });
}

async function getConflictCandidateGroups(
  event: CanonicalEvent,
): Promise<ConflictCandidateGroup[]> {
  const rawCandidates = await checkForConflicts(event);

  if (rawCandidates.length === 0) {
    return [];
  }

  const groupedFieldPaths = new Map<string, Set<CanonicalFieldPath>>();

  for (const candidate of rawCandidates) {
    const existingFieldPaths = groupedFieldPaths.get(candidate.eventId) ?? new Set();
    existingFieldPaths.add(candidate.fieldPath);
    groupedFieldPaths.set(candidate.eventId, existingFieldPaths);
  }

  const competingEvents = await prisma.canonicalEvent.findMany({
    where: {
      eventId: {
        in: Array.from(groupedFieldPaths.keys()),
      },
    },
    select: {
      changedFields: true,
      correlationId: true,
      eventId: true,
      metadata: true,
      normalizedPayloadHash: true,
      operation: true,
      payload: true,
      receivedAt: true,
      serviceType: true,
      sourceRequestId: true,
      sourceSystem: true,
      status: true,
      ubid: true,
    },
  });

  return competingEvents
    .map((competingEvent) => ({
      competingEvent: toCanonicalEvent(competingEvent),
      fieldPaths: Array.from(groupedFieldPaths.get(competingEvent.eventId) ?? []),
    }))
    .filter(
      (candidate) =>
        candidate.fieldPaths.length > 0 &&
        candidate.competingEvent.sourceSystem !== event.sourceSystem &&
        candidate.competingEvent.status !== "SUPERSEDED",
    );
}

function resolveFieldDecision(
  currentEvent: CanonicalEvent,
  competingEvent: CanonicalEvent,
  rule: AuthorityRuleRecord,
): FieldDecision {
  if (rule.manualReviewRequired) {
    return {
      authoritativeSystem: rule.authoritativeSystem,
      fallbackSystem: rule.fallbackSystem,
      fieldPath: rule.fieldPath,
      reason: "Authority Matrix rule requires manual review.",
      winner: "MANUAL",
    };
  }

  if (currentEvent.sourceSystem === competingEvent.sourceSystem) {
    return {
      authoritativeSystem: rule.authoritativeSystem,
      fallbackSystem: rule.fallbackSystem,
      fieldPath: rule.fieldPath,
      reason: "Both events came from the same source system. Latest event wins deterministically.",
      winner:
        new Date(currentEvent.receivedAt).getTime() >=
        new Date(competingEvent.receivedAt).getTime()
          ? "CURRENT"
          : "OTHER",
    };
  }

  if (currentEvent.sourceSystem === rule.authoritativeSystem) {
    return {
      authoritativeSystem: rule.authoritativeSystem,
      fallbackSystem: rule.fallbackSystem,
      fieldPath: rule.fieldPath,
      reason: `${currentEvent.sourceSystem} is authoritative for ${rule.fieldPath}.`,
      winner: "CURRENT",
    };
  }

  if (competingEvent.sourceSystem === rule.authoritativeSystem) {
    return {
      authoritativeSystem: rule.authoritativeSystem,
      fallbackSystem: rule.fallbackSystem,
      fieldPath: rule.fieldPath,
      reason: `${competingEvent.sourceSystem} is authoritative for ${rule.fieldPath}.`,
      winner: "OTHER",
    };
  }

  if (rule.fallbackSystem) {
    if (currentEvent.sourceSystem === rule.fallbackSystem) {
      return {
        authoritativeSystem: rule.authoritativeSystem,
        fallbackSystem: rule.fallbackSystem,
        fieldPath: rule.fieldPath,
        reason: `${currentEvent.sourceSystem} matched the fallback system for ${rule.fieldPath}.`,
        winner: "CURRENT",
      };
    }

    if (competingEvent.sourceSystem === rule.fallbackSystem) {
      return {
        authoritativeSystem: rule.authoritativeSystem,
        fallbackSystem: rule.fallbackSystem,
        fieldPath: rule.fieldPath,
        reason: `${competingEvent.sourceSystem} matched the fallback system for ${rule.fieldPath}.`,
        winner: "OTHER",
      };
    }
  }

  return {
    authoritativeSystem: rule.authoritativeSystem,
    fallbackSystem: rule.fallbackSystem,
    fieldPath: rule.fieldPath,
    reason: "No deterministic winner could be selected from the Authority Matrix rule.",
    winner: "MANUAL",
  };
}

async function buildFieldDecisions(
  currentEvent: CanonicalEvent,
  competingEvent: CanonicalEvent,
  fieldPaths: CanonicalFieldPath[],
) {
  return Promise.all(
    fieldPaths.map(async (fieldPath) =>
      resolveFieldDecision(
        currentEvent,
        competingEvent,
        await getAuthorityRule(fieldPath),
      ),
    ),
  );
}

function deriveCandidateOutcome(fieldDecisions: FieldDecision[]): CandidateOutcome {
  if (fieldDecisions.some((decision) => decision.winner === "MANUAL")) {
    return "MANUAL_REVIEW_REQUIRED";
  }

  const winners = new Set(fieldDecisions.map((decision) => decision.winner));

  if (winners.size > 1) {
    return "MANUAL_REVIEW_REQUIRED";
  }

  return winners.has("OTHER") ? "CURRENT_LOSES" : "CURRENT_WINS";
}

async function createConflictRecord(
  currentEvent: CanonicalEvent,
  candidate: ConflictCandidateGroup,
  fieldDecisions: FieldDecision[],
  resolutionStatus: ConflictResolutionStatus,
  reviewStatus?: ReviewStatus,
) {
  return prisma.conflict.create({
    data: {
      authorityDecision: toJsonValue({
        competingEventId: candidate.competingEvent.eventId,
        fieldDecisions,
        reviewedAt: resolutionStatus === ConflictResolutionStatus.MANUAL_REVIEW_REQUIRED
          ? null
          : new Date().toISOString(),
      }),
      conflictId: `CF-${nanoid(12)}`,
      conflictingFields: toJsonValue(candidate.fieldPaths),
      correlationId: currentEvent.correlationId,
      detectedAt: new Date(),
      eventId: currentEvent.eventId,
      metadata: toJsonValue({
        competingCorrelationId: candidate.competingEvent.correlationId,
        competingEventId: candidate.competingEvent.eventId,
      }),
      resolutionStatus,
      reviewStatus: reviewStatus ?? null,
      resolvedAt:
        resolutionStatus === ConflictResolutionStatus.MANUAL_REVIEW_REQUIRED
          ? null
          : new Date(),
      serviceType: currentEvent.serviceType,
      sourcePayload: toJsonValue(currentEvent.payload),
      sourceSystem: currentEvent.sourceSystem,
      targetPayload: toJsonValue(candidate.competingEvent.payload),
      targetSystem: candidate.competingEvent.sourceSystem,
      ubid: currentEvent.ubid,
    },
    select: {
      authorityDecision: true,
      conflictId: true,
      conflictingFields: true,
      correlationId: true,
      detectedAt: true,
      eventId: true,
      metadata: true,
      notes: true,
      resolutionStatus: true,
      reviewStatus: true,
      reviewedAt: true,
      reviewedBy: true,
      serviceType: true,
      sourcePayload: true,
      sourceSystem: true,
      targetPayload: true,
      targetSystem: true,
      ubid: true,
    },
  });
}

async function createManualReviewItem(
  currentEvent: CanonicalEvent,
  conflictId: string,
  candidate: ConflictCandidateGroup,
) {
  return prisma.manualReviewItem.create({
    data: {
      conflictId,
      correlationId: currentEvent.correlationId,
      eventId: currentEvent.eventId,
      payload: toJsonValue({
        competingEventId: candidate.competingEvent.eventId,
        competingPayload: candidate.competingEvent.payload,
        currentPayload: currentEvent.payload,
        fieldPaths: candidate.fieldPaths,
      }),
      reviewId: `REV-${nanoid(12)}`,
      reviewType: "CONFLICT",
      sourceSystem: currentEvent.sourceSystem,
      summary: `Manual review required for ${candidate.fieldPaths.join(", ")} on ${currentEvent.ubid}.`,
      targetSystem: candidate.competingEvent.sourceSystem,
      title: `Resolve conflict ${conflictId}`,
      ubid: currentEvent.ubid,
    },
  });
}

async function writeConflictDetectedAudit(
  currentEvent: CanonicalEvent,
  candidate: ConflictCandidateGroup,
  conflictId: string,
) {
  await writeAuditLog(
    buildAuditEntry(
      currentEvent,
      "CONFLICT_DETECTED",
      `Conflict detected against ${candidate.competingEvent.sourceSystem}.`,
      {
        metadata: {
          competingEventId: candidate.competingEvent.eventId,
          competingSourceSystem: candidate.competingEvent.sourceSystem,
          conflictId,
          conflictingFields: candidate.fieldPaths,
        },
        targetSystem: candidate.competingEvent.sourceSystem,
      },
    ),
  );
}

function normalizeReviewAction(input: ConflictReviewInput): "APPROVED" | "REJECTED" {
  if (input.action) {
    return input.action;
  }

  switch (input.outcome) {
    case "REJECTED":
      return "REJECTED";
    case "MERGED":
    case "SOURCE_ACCEPTED":
    case "TARGET_ACCEPTED":
      return "APPROVED";
    default:
      throw new AppError({
        code: ERROR_CODES.BAD_REQUEST,
        message: "Review action must resolve to APPROVED or REJECTED.",
        statusCode: 400,
      });
  }
}

async function createManualReviewArtifacts(
  currentEvent: CanonicalEvent,
  candidate: ConflictCandidateGroup,
  fieldDecisions: FieldDecision[],
) {
  const conflict = await createConflictRecord(
    currentEvent,
    candidate,
    fieldDecisions,
    ConflictResolutionStatus.MANUAL_REVIEW_REQUIRED,
    ReviewStatus.OPEN,
  );

  await createManualReviewItem(currentEvent, conflict.conflictId, candidate);
  await writeConflictDetectedAudit(currentEvent, candidate, conflict.conflictId);
  await writeAuditLog(
    buildAuditEntry(
      currentEvent,
      "MANUAL_REVIEW_REQUIRED",
      `Conflict ${conflict.conflictId} requires manual review.`,
      {
        metadata: {
          conflictId: conflict.conflictId,
          conflictingFields: candidate.fieldPaths,
        },
        targetSystem: candidate.competingEvent.sourceSystem,
      },
    ),
  );

  return conflict.conflictId;
}

async function createAutoResolvedArtifacts(
  currentEvent: CanonicalEvent,
  candidate: ConflictCandidateGroup,
  fieldDecisions: FieldDecision[],
  resolutionStatus: ConflictResolutionStatus,
) {
  const conflict = await createConflictRecord(
    currentEvent,
    candidate,
    fieldDecisions,
    resolutionStatus,
  );

  await writeConflictDetectedAudit(currentEvent, candidate, conflict.conflictId);

  return conflict.conflictId;
}

export async function detectAndResolve(
  event: CanonicalEvent,
): Promise<ConflictDetectionResult> {
  const candidateGroups = await getConflictCandidateGroups(event);

  if (candidateGroups.length === 0) {
    await addToHoldingPen(event);

    return {
      conflictIds: [],
      shouldContinue: true,
      status: "CONFLICT_CHECKED",
      superseded: false,
    };
  }

  const evaluatedCandidates = await Promise.all(
    candidateGroups.map(async (candidate) => {
      const fieldDecisions = await buildFieldDecisions(
        event,
        candidate.competingEvent,
        candidate.fieldPaths,
      );

      return {
        candidate,
        fieldDecisions,
        outcome: deriveCandidateOutcome(fieldDecisions),
      };
    }),
  );

  const hasManualReview = evaluatedCandidates.some(
    (candidate) => candidate.outcome === "MANUAL_REVIEW_REQUIRED",
  );
  const hasCurrentWins = evaluatedCandidates.some(
    (candidate) => candidate.outcome === "CURRENT_WINS",
  );
  const hasCurrentLoses = evaluatedCandidates.some(
    (candidate) => candidate.outcome === "CURRENT_LOSES",
  );

  if (hasManualReview || (hasCurrentWins && hasCurrentLoses)) {
    const conflictIds: string[] = [];

    for (const evaluatedCandidate of evaluatedCandidates) {
      conflictIds.push(
        await createManualReviewArtifacts(
          event,
          evaluatedCandidate.candidate,
          evaluatedCandidate.fieldDecisions,
        ),
      );
    }

    await updateCanonicalEventStatus(event.eventId, "MANUAL_REVIEW_REQUIRED", {
      conflictIds,
      conflictResolution: "MANUAL_REVIEW_REQUIRED",
    });
    await addToHoldingPen(event);

    return {
      conflictIds,
      shouldContinue: false,
      status: "MANUAL_REVIEW_REQUIRED",
      superseded: false,
    };
  }

  if (hasCurrentLoses) {
    const conflictIds: string[] = [];
    const losingCandidates = evaluatedCandidates.filter(
      (candidate) => candidate.outcome === "CURRENT_LOSES",
    );

    for (const evaluatedCandidate of losingCandidates) {
      const conflictId = await createAutoResolvedArtifacts(
        event,
        evaluatedCandidate.candidate,
        evaluatedCandidate.fieldDecisions,
        ConflictResolutionStatus.SUPERSEDED,
      );
      conflictIds.push(conflictId);
      await writeAuditLog(
        buildAuditEntry(
          event,
          "CONFLICT_RESOLVED",
          `Conflict ${conflictId} auto-resolved against the current event.`,
          {
            metadata: {
              conflictId,
              losingEventId: event.eventId,
              winningEventId: evaluatedCandidate.candidate.competingEvent.eventId,
            },
            targetSystem: evaluatedCandidate.candidate.competingEvent.sourceSystem,
          },
        ),
      );
    }

    await updateCanonicalEventStatus(event.eventId, "SUPERSEDED", {
      conflictIds,
      supersededByEventIds: losingCandidates.map(
        (candidate) => candidate.candidate.competingEvent.eventId,
      ),
    });
    await writeAuditLog(
      buildAuditEntry(
        event,
        "SUPERSEDED",
        "Current event was superseded by an authoritative conflicting event.",
        {
          metadata: {
            conflictIds,
          },
        },
      ),
    );

    return {
      conflictIds,
      shouldContinue: false,
      status: "SUPERSEDED",
      superseded: true,
    };
  }

  const conflictIds: string[] = [];

  for (const evaluatedCandidate of evaluatedCandidates) {
    const conflictId = await createAutoResolvedArtifacts(
      event,
      evaluatedCandidate.candidate,
      evaluatedCandidate.fieldDecisions,
      ConflictResolutionStatus.AUTO_RESOLVED,
    );
    conflictIds.push(conflictId);

    await updateCanonicalEventStatus(
      evaluatedCandidate.candidate.competingEvent.eventId,
      "SUPERSEDED",
      {
        supersededByEventId: event.eventId,
        supersededByConflictId: conflictId,
      },
    );
    await writeAuditLog(
      buildAuditEntry(
        evaluatedCandidate.candidate.competingEvent,
        "SUPERSEDED",
        `Event superseded by authoritative conflict resolution in favor of ${event.eventId}.`,
        {
          metadata: {
            conflictId,
            supersededByEventId: event.eventId,
          },
          targetSystem: event.sourceSystem,
        },
      ),
    );
    await writeAuditLog(
      buildAuditEntry(
        event,
        "CONFLICT_RESOLVED",
        `Conflict ${conflictId} auto-resolved in favor of the current event.`,
        {
          metadata: {
            conflictId,
            losingEventId: evaluatedCandidate.candidate.competingEvent.eventId,
            winningEventId: event.eventId,
          },
          targetSystem: evaluatedCandidate.candidate.competingEvent.sourceSystem,
        },
      ),
    );
  }

  await updateCanonicalEventStatus(event.eventId, "CONFLICT_RESOLVED", {
    conflictIds,
    conflictResolution: "CURRENT_WINS",
  });
  await addToHoldingPen(event);

  return {
    conflictIds,
    shouldContinue: true,
    status: "CONFLICT_RESOLVED",
    superseded: false,
  };
}

export async function listConflicts(): Promise<ConflictApiRecord[]> {
  const conflicts = await prisma.conflict.findMany({
    orderBy: [{ detectedAt: "desc" }, { createdAt: "desc" }],
    select: {
      authorityDecision: true,
      conflictId: true,
      conflictingFields: true,
      correlationId: true,
      detectedAt: true,
      eventId: true,
      metadata: true,
      notes: true,
      resolutionStatus: true,
      reviewStatus: true,
      reviewedAt: true,
      reviewedBy: true,
      serviceType: true,
      sourcePayload: true,
      sourceSystem: true,
      targetPayload: true,
      targetSystem: true,
      ubid: true,
    },
  });

  return conflicts.map((conflict) => toConflictApiRecord(conflict));
}

export async function getConflictById(conflictId: string): Promise<ConflictApiRecord> {
  const conflict = await prisma.conflict.findUnique({
    where: { conflictId },
    select: {
      authorityDecision: true,
      conflictId: true,
      conflictingFields: true,
      correlationId: true,
      detectedAt: true,
      eventId: true,
      metadata: true,
      notes: true,
      resolutionStatus: true,
      reviewStatus: true,
      reviewedAt: true,
      reviewedBy: true,
      serviceType: true,
      sourcePayload: true,
      sourceSystem: true,
      targetPayload: true,
      targetSystem: true,
      ubid: true,
    },
  });

  if (!conflict) {
    throw new AppError({
      code: ERROR_CODES.NOT_FOUND,
      message: `Conflict ${conflictId} was not found.`,
      statusCode: 404,
    });
  }

  return toConflictApiRecord(conflict);
}

export async function reviewConflict(
  conflictId: string,
  input: ConflictReviewInput,
): Promise<ConflictApiRecord> {
  const conflict = await prisma.conflict.findUnique({
    where: { conflictId },
    select: {
      authorityDecision: true,
      conflictId: true,
      conflictingFields: true,
      correlationId: true,
      detectedAt: true,
      eventId: true,
      metadata: true,
      notes: true,
      resolutionStatus: true,
      reviewStatus: true,
      reviewedAt: true,
      reviewedBy: true,
      serviceType: true,
      sourcePayload: true,
      sourceSystem: true,
      targetPayload: true,
      targetSystem: true,
      ubid: true,
    },
  });

  if (!conflict) {
    throw new AppError({
      code: ERROR_CODES.NOT_FOUND,
      message: `Conflict ${conflictId} was not found.`,
      statusCode: 404,
    });
  }

  if (
    conflict.resolutionStatus !== ConflictResolutionStatus.MANUAL_REVIEW_REQUIRED ||
    (conflict.reviewStatus !== null &&
      conflict.reviewStatus !== ReviewStatus.OPEN &&
      conflict.reviewStatus !== ReviewStatus.IN_REVIEW)
  ) {
    throw new AppError({
      code: ERROR_CODES.BAD_REQUEST,
      message: `Conflict ${conflictId} is not awaiting manual review.`,
      statusCode: 409,
    });
  }

  const action = normalizeReviewAction(input);
  const reviewedBy = input.reviewedBy ?? input.reviewerId;

  if (!reviewedBy) {
    throw new AppError({
      code: ERROR_CODES.BAD_REQUEST,
      message: "A reviewer identity is required to review a conflict.",
      statusCode: 400,
    });
  }

  const reviewedAt = input.reviewedAt ? new Date(input.reviewedAt) : new Date();
  const nextResolutionStatus =
    action === "REJECTED"
      ? ConflictResolutionStatus.REJECTED_AFTER_REVIEW
      : conflict.resolutionStatus;

  const updatedConflict = await prisma.conflict.update({
    where: { conflictId },
    data: {
      notes: input.notes ?? conflict.notes,
      resolutionStatus: nextResolutionStatus,
      reviewStatus: action,
      reviewedAt,
      reviewedBy,
      resolvedAt: action === "REJECTED" ? reviewedAt : undefined,
    },
    select: {
      authorityDecision: true,
      conflictId: true,
      conflictingFields: true,
      correlationId: true,
      detectedAt: true,
      eventId: true,
      metadata: true,
      notes: true,
      resolutionStatus: true,
      reviewStatus: true,
      reviewedAt: true,
      reviewedBy: true,
      serviceType: true,
      sourcePayload: true,
      sourceSystem: true,
      targetPayload: true,
      targetSystem: true,
      ubid: true,
    },
  });

  await prisma.manualReviewItem.updateMany({
    where: {
      conflictId,
    },
    data: {
      closedAt: action === "REJECTED" ? reviewedAt : undefined,
      resolutionPayload: toJsonValue({
        action,
        notes: input.notes,
      }),
      reviewStatus: action,
      reviewedAt,
      reviewerNotes: input.notes,
    },
  });

  const reviewedEvent = await loadCanonicalEventOrThrow(conflict.eventId);

  await updateCanonicalEventStatus(
    reviewedEvent.eventId,
    action === "REJECTED" ? "SUPERSEDED" : "CONFLICT_RESOLVED",
    action === "REJECTED"
      ? {
          rejectedAfterReview: true,
          rejectedConflictId: conflictId,
        }
      : {
          approvedAfterReview: true,
          approvedConflictId: conflictId,
        },
  );

  await writeAuditLog(
    buildAuditEntry(
      reviewedEvent,
      action === "REJECTED" ? "SUPERSEDED" : "CONFLICT_RESOLVED",
      `Conflict ${conflictId} review marked ${action}.`,
      {
        metadata: {
          action,
          conflictId,
          notes: input.notes,
          reviewedBy,
        },
        targetSystem: conflict.targetSystem,
      },
    ),
  );

  return toConflictApiRecord(updatedConflict);
}

export async function replayConflict(
  conflictId: string,
): Promise<ConflictReplayResult> {
  const conflict = await prisma.conflict.findUnique({
    where: { conflictId },
    select: {
      conflictId: true,
      reviewStatus: true,
    },
  });

  if (!conflict) {
    throw new AppError({
      code: ERROR_CODES.NOT_FOUND,
      message: `Conflict ${conflictId} was not found.`,
      statusCode: 404,
    });
  }

  return {
    conflictId,
    replayed: false,
    reviewStatus: conflict.reviewStatus ?? undefined,
    status: "NOT_IMPLEMENTED",
  };
}
