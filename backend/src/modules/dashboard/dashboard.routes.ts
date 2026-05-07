import { Router } from "express";

import { validateRequest } from "../../common/middleware/validateRequest";
import {
  dashboardAuditQuerySchema,
  dashboardConflictsQuerySchema,
  dashboardEventIdParamsSchema,
  dashboardEventsQuerySchema,
  dashboardUbidParamsSchema,
} from "../../validation/dashboard.schemas";
import {
  getAuthorityMatrixHandler,
  getBusinessComparisonHandler,
  getDashboardAuditHandler,
  getDashboardConflictListHandler,
  getDashboardEventByIdHandler,
  getDashboardEventsHandler,
  getDashboardMetricsHandler,
  getDashboardQueueStatusHandler,
  getDashboardStatusHandler,
  getDashboardSystemHealthHandler,
} from "./dashboard.controller";

export const dashboardRouter = Router();

dashboardRouter.get("/", getDashboardStatusHandler);
dashboardRouter.get("/metrics", getDashboardMetricsHandler);
dashboardRouter.get("/system-health", getDashboardSystemHealthHandler);
dashboardRouter.get(
  "/business-comparison/:ubid",
  validateRequest({ params: dashboardUbidParamsSchema }),
  getBusinessComparisonHandler,
);
dashboardRouter.get(
  "/events",
  validateRequest({ query: dashboardEventsQuerySchema }),
  getDashboardEventsHandler,
);
dashboardRouter.get(
  "/events/:eventId",
  validateRequest({ params: dashboardEventIdParamsSchema }),
  getDashboardEventByIdHandler,
);
dashboardRouter.get(
  "/audit",
  validateRequest({ query: dashboardAuditQuerySchema }),
  getDashboardAuditHandler,
);
dashboardRouter.get(
  "/conflicts",
  validateRequest({ query: dashboardConflictsQuerySchema }),
  getDashboardConflictListHandler,
);
dashboardRouter.get("/queue-status", getDashboardQueueStatusHandler);
dashboardRouter.get("/authority-matrix", getAuthorityMatrixHandler);
