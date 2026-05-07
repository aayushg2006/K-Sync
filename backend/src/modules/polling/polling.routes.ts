import { Router } from "express";

import { validateRequest } from "../../common/middleware/validateRequest";
import {
  pollingRunParamsSchema,
} from "../../validation/polling.schemas";
import {
  listSnapshotsHandler,
  runPollingHandler,
  runSinglePollingHandler,
} from "./polling.controller";

export const pollingRouter = Router();

pollingRouter.post("/run", runPollingHandler);
pollingRouter.post(
  "/run/:systemName/:ubid",
  validateRequest({ params: pollingRunParamsSchema }),
  runSinglePollingHandler,
);
pollingRouter.get("/snapshots", listSnapshotsHandler);

