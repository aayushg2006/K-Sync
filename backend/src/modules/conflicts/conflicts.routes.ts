import { Router } from "express";

import { validateRequest } from "../../common/middleware/validateRequest";
import {
  conflictIdParamsSchema,
  conflictReplaySchema,
  conflictReviewSchema,
} from "../../validation/conflict.schemas";
import {
  getConflictByIdHandler,
  listConflictsHandler,
  replayConflictHandler,
  reviewConflictHandler,
} from "./conflicts.controller";

export const conflictsRouter = Router();

conflictsRouter.get("/", listConflictsHandler);
conflictsRouter.get(
  "/:conflictId",
  validateRequest({ params: conflictIdParamsSchema }),
  getConflictByIdHandler,
);
conflictsRouter.post(
  "/:conflictId/review",
  validateRequest({
    body: conflictReviewSchema,
    params: conflictIdParamsSchema,
  }),
  reviewConflictHandler,
);
conflictsRouter.post(
  "/:conflictId/replay",
  validateRequest({
    body: conflictReplaySchema,
    params: conflictIdParamsSchema,
  }),
  replayConflictHandler,
);
