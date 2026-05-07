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

export const factoryLicenseNoParamsSchema = z.object({
  factoryLicenseNo: nonEmptyStringSchema,
});

export const esurakshateManualUpdateSchema = z
  .object({
    sourceSystem: z.literal("ESURAKSHATE"),
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

export const esurakshateAmendmentSchema = z
  .object({
    businessName: nonEmptyStringSchema.optional(),
    employeeCount: z.number().int().nonnegative().optional(),
    factoryAddress: nonEmptyStringSchema.optional(),
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

export const esurakshateSnapshotQuerySchema = z.object({
  format: z.enum(["json", "xml"]).optional(),
  requestedAt: isoDateTimeSchema.optional(),
});
