import { Router } from "express";

import { validateRequest } from "../../common/middleware/validateRequest";
import { swsBusinessParamsSchema, swsBusinessUpdateSchema, swsServiceRequestSchema } from "../../validation/sws.schemas";
import {
  createMockSwsServiceRequestHandler,
  getMockSwsBusinessHandler,
  getMockSwsStatusHandler,
  listMockSwsBusinessesHandler,
  updateMockSwsBusinessHandler,
} from "./mockSws.controller";

export const mockSwsRouter = Router();

mockSwsRouter.get("/", getMockSwsStatusHandler);
mockSwsRouter.post(
  "/service-request",
  validateRequest({ body: swsServiceRequestSchema }),
  createMockSwsServiceRequestHandler,
);
mockSwsRouter.get("/businesses", listMockSwsBusinessesHandler);
mockSwsRouter.get(
  "/business/:ubid",
  validateRequest({ params: swsBusinessParamsSchema }),
  getMockSwsBusinessHandler,
);
mockSwsRouter.put(
  "/business/:ubid",
  validateRequest({ body: swsBusinessUpdateSchema, params: swsBusinessParamsSchema }),
  updateMockSwsBusinessHandler,
);
