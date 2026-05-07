import { Request, Response } from "express";

import { buildSuccessResponse } from "../../common/utils/apiResponse";
import {
  getAuthorityMatrix,
  getBusinessComparison,
  getDashboardAudit,
  getDashboardConflictList,
  getDashboardEventById,
  getDashboardEvents,
  getDashboardMetrics,
  getDashboardQueueStatus,
  getDashboardStatus,
  getDashboardSystemHealth,
} from "./dashboard.service";

export async function getDashboardStatusHandler(_request: Request, response: Response) {
  response
    .status(200)
    .json(buildSuccessResponse(await getDashboardStatus(), "Dashboard module is available."));
}

export async function getDashboardMetricsHandler(_request: Request, response: Response) {
  response
    .status(200)
    .json(buildSuccessResponse(await getDashboardMetrics(), "Dashboard metrics loaded"));
}

export async function getDashboardSystemHealthHandler(_request: Request, response: Response) {
  response
    .status(200)
    .json(buildSuccessResponse(await getDashboardSystemHealth(), "System health loaded"));
}

export async function getBusinessComparisonHandler(request: Request, response: Response) {
  const { ubid } = request.params as { ubid: string };

  response
    .status(200)
    .json(buildSuccessResponse(await getBusinessComparison(ubid), "Business comparison loaded"));
}

export async function getDashboardEventsHandler(request: Request, response: Response) {
  response
    .status(200)
    .json(buildSuccessResponse(await getDashboardEvents(request.query), "Events loaded"));
}

export async function getDashboardEventByIdHandler(request: Request, response: Response) {
  const { eventId } = request.params as { eventId: string };

  response
    .status(200)
    .json(buildSuccessResponse(await getDashboardEventById(eventId), `Event ${eventId} loaded`));
}

export async function getDashboardAuditHandler(request: Request, response: Response) {
  response
    .status(200)
    .json(buildSuccessResponse(await getDashboardAudit(request.query), "Audit logs loaded"));
}

export async function getDashboardConflictListHandler(request: Request, response: Response) {
  response
    .status(200)
    .json(buildSuccessResponse(await getDashboardConflictList(request.query), "Conflicts loaded"));
}

export async function getDashboardQueueStatusHandler(_request: Request, response: Response) {
  response
    .status(200)
    .json(buildSuccessResponse(await getDashboardQueueStatus(), "Queue status loaded"));
}

export async function getAuthorityMatrixHandler(_request: Request, response: Response) {
  response
    .status(200)
    .json(buildSuccessResponse(await getAuthorityMatrix(), "Authority Matrix loaded"));
}
