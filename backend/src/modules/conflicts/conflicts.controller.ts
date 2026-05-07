import { Request, Response } from "express";

import { buildSuccessResponse } from "../../common/utils/apiResponse";
import {
  getConflictById,
  listConflicts,
  replayConflict,
  reviewConflict,
} from "./conflict.service";

export async function listConflictsHandler(_request: Request, response: Response) {
  response
    .status(200)
    .json(buildSuccessResponse(await listConflicts(), "Conflicts loaded."));
}

export async function getConflictByIdHandler(request: Request, response: Response) {
  const { conflictId } = request.params as { conflictId: string };

  response.status(200).json(
    buildSuccessResponse(
      await getConflictById(conflictId),
      `Conflict ${conflictId} loaded.`,
    ),
  );
}

export async function reviewConflictHandler(request: Request, response: Response) {
  const { conflictId } = request.params as { conflictId: string };

  response.status(200).json(
    buildSuccessResponse(
      await reviewConflict(conflictId, request.body),
      `Conflict ${conflictId} reviewed.`,
    ),
  );
}

export async function replayConflictHandler(request: Request, response: Response) {
  const { conflictId } = request.params as { conflictId: string };

  response.status(202).json(
    buildSuccessResponse(
      await replayConflict(conflictId),
      `Replay request recorded for conflict ${conflictId}.`,
    ),
  );
}
