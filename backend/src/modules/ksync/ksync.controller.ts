import { Request, Response } from "express";

import { buildSuccessResponse } from "../../common/utils/apiResponse";
import { getEventById, getKsyncStatus, ingestRequest, listEvents } from "./ksync.service";

export async function getKsyncStatusHandler(_request: Request, response: Response) {
  response
    .status(200)
    .json(buildSuccessResponse(await getKsyncStatus(), "K-Sync core module is available."));
}

export async function ingestRequestHandler(request: Request, response: Response) {
  response
    .status(202)
    .json(
      buildSuccessResponse(
        await ingestRequest(request.body),
        "K-Sync ingest request accepted.",
      ),
    );
}

export async function listEventsHandler(_request: Request, response: Response) {
  response
    .status(200)
    .json(buildSuccessResponse(await listEvents(), "Canonical events loaded."));
}

export async function getEventByIdHandler(request: Request, response: Response) {
  const { eventId } = request.params as { eventId: string };

  response
    .status(200)
    .json(
      buildSuccessResponse(
        await getEventById(eventId),
        `Canonical event ${eventId} loaded.`,
      ),
    );
}
