import { z } from "zod";

import {
  canonicalPayloadSchema,
  changedFieldsSchema,
  nonEmptyStringSchema,
  operationTypeSchema,
  serviceTypeSchema,
  systemNameSchema,
  ubidSchema,
  validatePayloadAlignment,
} from "./ksync.schemas";

export const scenarioRunSchema = z
  .object({
    scenarioId: nonEmptyStringSchema,
    scenarioName: nonEmptyStringSchema,
    sourceSystem: systemNameSchema,
    ubid: ubidSchema,
    serviceType: serviceTypeSchema,
    operation: operationTypeSchema,
    changedFields: changedFieldsSchema,
    payload: canonicalPayloadSchema,
    dryRun: z.boolean().default(true),
  })
  .superRefine(({ changedFields, payload }, context) => {
    validatePayloadAlignment(payload, changedFields, context);
  });
