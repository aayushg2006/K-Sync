import { Router } from "express";

import { validateRequest } from "../../common/middleware/validateRequest";
import {
  esurakshateAmendmentSchema,
  esurakshateManualUpdateSchema,
  esurakshateSnapshotQuerySchema,
  factoryLicenseNoParamsSchema,
} from "../../validation/esurakshate.schemas";
import {
  amendFactoryHandler,
  getFactoryHandler,
  getFactorySnapshotHandler,
  getMockEsurakshateStatusHandler,
  manualUpdateFactoryHandler,
} from "./mockEsurakshate.controller";

export const mockEsurakshateRouter = Router();

mockEsurakshateRouter.get("/", getMockEsurakshateStatusHandler);
mockEsurakshateRouter.get(
  "/factories/:factoryLicenseNo",
  validateRequest({ params: factoryLicenseNoParamsSchema }),
  getFactoryHandler,
);
mockEsurakshateRouter.put(
  "/factories/:factoryLicenseNo/amendment",
  validateRequest({
    body: esurakshateAmendmentSchema,
    params: factoryLicenseNoParamsSchema,
  }),
  amendFactoryHandler,
);
mockEsurakshateRouter.post(
  "/manual-update",
  validateRequest({ body: esurakshateManualUpdateSchema }),
  manualUpdateFactoryHandler,
);
mockEsurakshateRouter.get(
  "/snapshot/:factoryLicenseNo",
  validateRequest({
    params: factoryLicenseNoParamsSchema,
    query: esurakshateSnapshotQuerySchema,
  }),
  getFactorySnapshotHandler,
);
