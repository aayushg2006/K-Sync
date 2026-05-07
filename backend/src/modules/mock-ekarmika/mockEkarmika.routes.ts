import { Router } from "express";

import { validateRequest } from "../../common/middleware/validateRequest";
import {
  ekarmikaAmendmentSchema,
  ekarmikaChangesQuerySchema,
  ekarmikaManualUpdateSchema,
  labourRegNoParamsSchema,
} from "../../validation/ekarmika.schemas";
import {
  amendEstablishmentHandler,
  getEstablishmentHandler,
  getMockEkarmikaStatusHandler,
  listEkarmikaChangesHandler,
  manualUpdateEstablishmentHandler,
} from "./mockEkarmika.controller";

export const mockEkarmikaRouter = Router();

mockEkarmikaRouter.get("/", getMockEkarmikaStatusHandler);
mockEkarmikaRouter.get(
  "/establishments/:labourRegNo",
  validateRequest({ params: labourRegNoParamsSchema }),
  getEstablishmentHandler,
);
mockEkarmikaRouter.put(
  "/establishments/:labourRegNo/amendment",
  validateRequest({ body: ekarmikaAmendmentSchema, params: labourRegNoParamsSchema }),
  amendEstablishmentHandler,
);
mockEkarmikaRouter.post(
  "/manual-update",
  validateRequest({ body: ekarmikaManualUpdateSchema }),
  manualUpdateEstablishmentHandler,
);
mockEkarmikaRouter.get("/changes", validateRequest({ query: ekarmikaChangesQuerySchema }), listEkarmikaChangesHandler);
