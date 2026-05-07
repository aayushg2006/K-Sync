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

export const labourRegNoParamsSchema = z.object({
  labourRegNo: nonEmptyStringSchema,
});

export const ekarmikaManualUpdateSchema = z
  .object({
    sourceSystem: z.literal("EKARMIKA"),
    correlationId: nonEmptyStringSchema,
    ubid: ubidSchema,
    serviceType: serviceTypeSchema,
    operation: operationTypeSchema,
    changedFields: changedFieldsSchema,
    payload: canonicalPayloadSchema,
    updatedBy: nonEmptyStringSchema.optional(),
    remarks: z.string().trim().max(500).optional(),
  })
  .superRefine(({ changedFields, payload }, context) => {
    validatePayloadAlignment(payload, changedFields, context);
  });

export const ekarmikaAmendmentSchema = z
  .object({
    addressFull: nonEmptyStringSchema.optional(),
    businessName: nonEmptyStringSchema.optional(),
    employeeCount: z.number().int().nonnegative().optional(),
    managerName: nonEmptyStringSchema.optional(),
    powerCapacityHP: z.number().positive().optional(),
    workerLimit: z.number().int().nonnegative().optional(),
  })
  .superRefine((value, context) => {
    const hasChanges = Object.values(value).some((item) => item !== undefined);

    if (!hasChanges) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one amendment field is required.",
        path: [],
      });
    }
  });

export const ekarmikaChangesQuerySchema = z.object({
  updated_since: isoDateTimeSchema.optional(),
});
