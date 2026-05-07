import { z } from "zod";

import {
  canonicalPayloadSchema,
  changedFieldsSchema,
  isoDateTimeSchema,
  nonEmptyStringSchema,
  operationTypeSchema,
  serviceTypeSchema,
  ubidSchema,
  validatePayloadAlignment,
} from "./ksync.schemas";

export const swsBusinessParamsSchema = z.object({
  ubid: ubidSchema,
});

export const swsServiceRequestSchema = z
  .object({
    sourceSystem: z.literal("SWS"),
    sourceRequestId: nonEmptyStringSchema,
    correlationId: nonEmptyStringSchema,
    ubid: ubidSchema,
    serviceType: serviceTypeSchema,
    operation: operationTypeSchema,
    changedFields: changedFieldsSchema,
    payload: canonicalPayloadSchema,
    requestedAt: isoDateTimeSchema.optional(),
  })
  .superRefine(({ changedFields, payload }, context) => {
    validatePayloadAlignment(payload, changedFields, context);
  });

export const swsBusinessUpdateSchema = z
  .object({
    businessName: nonEmptyStringSchema.optional(),
    payload: canonicalPayloadSchema.optional(),
    sourceRequestId: nonEmptyStringSchema.optional(),
  })
  .superRefine(({ businessName, payload, sourceRequestId }, context) => {
    const hasPayloadUpdate = payload ? Object.values(payload).some((value) => value !== undefined) : false;

    if (!businessName && !sourceRequestId && !hasPayloadUpdate) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one business update field is required.",
        path: ["payload"],
      });
    }
  });
