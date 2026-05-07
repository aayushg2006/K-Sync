import { z } from "zod";

import { CONFLICT_OUTCOMES } from "../common/types/conflict.types";
import { CANONICAL_PAYLOAD_FIELDS } from "../common/types/event.types";
import { AUDIT_STAGES, EVENT_STATUSES, OPERATION_TYPES, SERVICE_TYPES, SYSTEM_NAMES } from "../common/types/system.types";

const ubidPattern = /^UBID-KA-\d{4}-\d{4}$/;

export const nonEmptyStringSchema = z.string().trim().min(1);

export const ubidSchema = nonEmptyStringSchema.regex(ubidPattern, {
  message: "UBID must match format UBID-KA-2026-0001.",
});

export const isoDateSchema = nonEmptyStringSchema.refine(
  (value) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)),
  {
    message: "Expected a valid ISO date string in YYYY-MM-DD format.",
  },
);

export const isoDateTimeSchema = nonEmptyStringSchema.refine(
  (value) => !Number.isNaN(Date.parse(value)),
  {
    message: "Expected a valid ISO date-time string.",
  },
);

export const systemNameSchema = z.enum(SYSTEM_NAMES);
export const serviceTypeSchema = z.enum(SERVICE_TYPES);
export const operationTypeSchema = z.enum(OPERATION_TYPES);
export const eventStatusSchema = z.enum(EVENT_STATUSES);
export const auditStageSchema = z.enum(AUDIT_STAGES);
export const conflictOutcomeSchema = z.enum(CONFLICT_OUTCOMES);
export const changedFieldSchema = z.enum(CANONICAL_PAYLOAD_FIELDS);

export const registeredAddressSchema = z
  .object({
    line1: nonEmptyStringSchema,
    line2: nonEmptyStringSchema.optional(),
    city: nonEmptyStringSchema,
    district: nonEmptyStringSchema.optional(),
    state: nonEmptyStringSchema,
    postalCode: nonEmptyStringSchema,
  })
  .strict();

export const authorizedSignatorySchema = z
  .object({
    name: nonEmptyStringSchema,
    designation: nonEmptyStringSchema.optional(),
    email: z.string().email().optional(),
    mobile: nonEmptyStringSchema.optional(),
  })
  .strict();

export const canonicalPayloadSchema = z
  .object({
    businessName: nonEmptyStringSchema.optional(),
    registeredAddress: registeredAddressSchema.optional(),
    authorizedSignatory: authorizedSignatorySchema.optional(),
    employeeCount: z.number().int().nonnegative().optional(),
    workerLimit: z.number().int().nonnegative().optional(),
    powerCapacityHP: z.number().positive().optional(),
    licenseExpiry: isoDateSchema.optional(),
  })
  .strict();

export const changedFieldsSchema = z
  .array(changedFieldSchema)
  .min(1, "At least one changed field is required.")
  .refine((value) => new Set(value).size === value.length, {
    message: "Changed fields must be unique.",
  });

function getProvidedPayloadFields(payload: z.infer<typeof canonicalPayloadSchema>) {
  return CANONICAL_PAYLOAD_FIELDS.filter((field) => payload[field] !== undefined);
}

export function validatePayloadAlignment(
  payload: z.infer<typeof canonicalPayloadSchema>,
  changedFields: z.infer<typeof changedFieldsSchema>,
  context: z.RefinementCtx,
) {
  const providedFields = getProvidedPayloadFields(payload);

  if (providedFields.length === 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Payload must include at least one supported field.",
      path: ["payload"],
    });
  }

  for (const field of changedFields) {
    if (!providedFields.includes(field)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Changed field "${field}" must be present in payload.`,
        path: ["changedFields"],
      });
    }
  }

  for (const field of providedFields) {
    if (!changedFields.includes(field)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Payload field "${field}" must be declared in changedFields.`,
        path: ["payload", field],
      });
    }
  }
}

function requireSourceRequestIdForSws(
  sourceSystem: z.infer<typeof systemNameSchema>,
  sourceRequestId: string | undefined,
  context: z.RefinementCtx,
) {
  if (sourceSystem === "SWS" && !sourceRequestId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "sourceRequestId is required for SWS service requests.",
      path: ["sourceRequestId"],
    });
  }
}

export const canonicalEventSchema = z
  .object({
    eventId: nonEmptyStringSchema,
    correlationId: nonEmptyStringSchema,
    sourceSystem: systemNameSchema,
    sourceRequestId: nonEmptyStringSchema.optional(),
    ubid: ubidSchema,
    serviceType: serviceTypeSchema,
    operation: operationTypeSchema,
    changedFields: changedFieldsSchema,
    payload: canonicalPayloadSchema,
    normalizedPayloadHash: nonEmptyStringSchema,
    receivedAt: isoDateTimeSchema,
    status: eventStatusSchema,
  })
  .superRefine(({ changedFields, payload, sourceRequestId, sourceSystem }, context) => {
    validatePayloadAlignment(payload, changedFields, context);
    requireSourceRequestIdForSws(sourceSystem, sourceRequestId, context);
  });

export const ksyncIngestSchema = z
  .object({
    correlationId: nonEmptyStringSchema.optional(),
    sourceSystem: systemNameSchema,
    sourceRequestId: nonEmptyStringSchema.optional(),
    ubid: ubidSchema,
    serviceType: serviceTypeSchema,
    operation: operationTypeSchema,
    changedFields: changedFieldsSchema,
    payload: canonicalPayloadSchema,
  })
  .superRefine(({ changedFields, payload, sourceRequestId, sourceSystem }, context) => {
    validatePayloadAlignment(payload, changedFields, context);
    requireSourceRequestIdForSws(sourceSystem, sourceRequestId, context);
  });

export const eventIdParamsSchema = z.object({
  eventId: nonEmptyStringSchema,
});
