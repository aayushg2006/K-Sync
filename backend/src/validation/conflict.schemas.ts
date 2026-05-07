import { z } from "zod";

import { CONFLICT_OUTCOMES } from "../common/types/conflict.types";
import {
  isoDateTimeSchema,
  nonEmptyStringSchema,
} from "./ksync.schemas";

const legacyConflictOutcomeSchema = z.enum(CONFLICT_OUTCOMES);
const conflictReviewActionSchema = z.enum(["APPROVED", "REJECTED"]);

export const conflictIdParamsSchema = z.object({
  conflictId: nonEmptyStringSchema,
});

export const conflictReviewSchema = z
  .object({
    action: conflictReviewActionSchema.optional(),
    notes: z.string().trim().max(1000).optional(),
    outcome: legacyConflictOutcomeSchema.optional(),
    reviewedAt: isoDateTimeSchema.optional(),
    reviewedBy: nonEmptyStringSchema.optional(),
    reviewerId: nonEmptyStringSchema.optional(),
  })
  .superRefine((value, context) => {
    if (!value.action && !value.outcome) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide either action or outcome for conflict review.",
        path: ["action"],
      });
    }

    if (!value.reviewedBy && !value.reviewerId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A reviewer identity is required.",
        path: ["reviewedBy"],
      });
    }
  });

export const conflictReplaySchema = z.object({
  notes: z.string().trim().max(1000).optional(),
  requestedBy: nonEmptyStringSchema.optional(),
});
