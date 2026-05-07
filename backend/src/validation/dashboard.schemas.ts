import { z } from "zod";

import {
  auditStageSchema,
  eventStatusSchema,
  nonEmptyStringSchema,
  serviceTypeSchema,
  systemNameSchema,
  ubidSchema,
} from "./ksync.schemas";

const paginationSchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(20),
  page: z.coerce.number().int().positive().default(1),
});

export const dashboardUbidParamsSchema = z.object({
  ubid: ubidSchema,
});

export const dashboardEventIdParamsSchema = z.object({
  eventId: nonEmptyStringSchema,
});

export const dashboardEventsQuerySchema = paginationSchema.extend({
  sourceSystem: systemNameSchema.optional(),
  serviceType: serviceTypeSchema.optional(),
  status: eventStatusSchema.optional(),
  ubid: ubidSchema.optional(),
});

export const dashboardAuditQuerySchema = paginationSchema.extend({
  correlationId: nonEmptyStringSchema.optional(),
  eventId: nonEmptyStringSchema.optional(),
  sourceSystem: systemNameSchema.optional(),
  stage: auditStageSchema.optional(),
  targetSystem: systemNameSchema.optional(),
  ubid: ubidSchema.optional(),
});

export const dashboardConflictsQuerySchema = paginationSchema.extend({
  resolutionStatus: z
    .enum([
      "AUTO_RESOLVED",
      "SUPERSEDED",
      "MANUAL_REVIEW_REQUIRED",
      "REPLAYED_AFTER_REVIEW",
      "REJECTED_AFTER_REVIEW",
      "PENDING",
    ])
    .optional(),
  ubid: ubidSchema.optional(),
});
