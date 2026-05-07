import { z } from "zod";

import { auditStageSchema, eventStatusSchema, nonEmptyStringSchema, ubidSchema } from "./ksync.schemas";

export const auditCorrelationParamsSchema = z.object({
  correlationId: nonEmptyStringSchema,
});

export const auditLogsQuerySchema = z.object({
  correlationId: nonEmptyStringSchema.optional(),
  eventId: nonEmptyStringSchema.optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  stage: auditStageSchema.optional(),
  status: eventStatusSchema.optional(),
  ubid: ubidSchema.optional(),
});
