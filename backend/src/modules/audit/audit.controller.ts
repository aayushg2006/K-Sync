import { Request, Response } from "express";

import { buildSuccessResponse } from "../../common/utils/apiResponse";
import { getAuditByCorrelationId, getAuditLogs, getAuditStatus } from "./audit.service";

export async function getAuditStatusHandler(_request: Request, response: Response) {
  response
    .status(200)
    .json(buildSuccessResponse(await getAuditStatus(), "Audit module is available."));
}

export async function getAuditLogsHandler(request: Request, response: Response) {
  response
    .status(200)
    .json(buildSuccessResponse(await getAuditLogs(request.query), "Audit logs loaded."));
}

export async function getAuditByCorrelationIdHandler(request: Request, response: Response) {
  const { correlationId } = request.params as { correlationId: string };

  response
    .status(200)
    .json(
      buildSuccessResponse(
        await getAuditByCorrelationId(correlationId),
        `Audit logs for correlation ${correlationId} loaded.`,
      ),
    );
}
