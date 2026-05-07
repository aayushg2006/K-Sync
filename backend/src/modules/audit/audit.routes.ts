import { Router } from "express";

import { validateRequest } from "../../common/middleware/validateRequest";
import {
  getAuditByCorrelationIdHandler,
  getAuditLogsHandler,
  getAuditStatusHandler,
} from "./audit.controller";
import {
  auditCorrelationParamsSchema,
  auditLogsQuerySchema,
} from "../../validation/audit.schemas";

export const auditRouter = Router();

auditRouter.get("/", getAuditStatusHandler);
auditRouter.get(
  "/logs",
  validateRequest({ query: auditLogsQuerySchema }),
  getAuditLogsHandler,
);
auditRouter.get(
  "/correlation/:correlationId",
  validateRequest({ params: auditCorrelationParamsSchema }),
  getAuditByCorrelationIdHandler,
);
auditRouter.get(
  "/:correlationId",
  validateRequest({ params: auditCorrelationParamsSchema }),
  getAuditByCorrelationIdHandler,
);
