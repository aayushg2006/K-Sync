import { Router } from "express";

import { validateRequest } from "../../common/middleware/validateRequest";
import { eventIdParamsSchema, ksyncIngestSchema } from "../../validation/ksync.schemas";
import { resetScenarioDemoDataHandler } from "../scenarios/scenarios.controller";
import { scenariosRouter } from "../scenarios/scenarios.routes";
import {
  getEventByIdHandler,
  getKsyncStatusHandler,
  ingestRequestHandler,
  listEventsHandler,
} from "./ksync.controller";

export const ksyncRouter = Router();

ksyncRouter.get("/", getKsyncStatusHandler);
ksyncRouter.use("/run-scenario", scenariosRouter);
ksyncRouter.use("/scenarios", scenariosRouter);
ksyncRouter.post("/reset-demo", resetScenarioDemoDataHandler);
ksyncRouter.post(
  "/ingest",
  validateRequest({ body: ksyncIngestSchema }),
  ingestRequestHandler,
);
ksyncRouter.get("/events", listEventsHandler);
ksyncRouter.get(
  "/events/:eventId",
  validateRequest({ params: eventIdParamsSchema }),
  getEventByIdHandler,
);
