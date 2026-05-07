import { Router } from "express";

import {
  runFailureRetryScenarioHandler,
  runConflictScenarioHandler,
  runDepartmentToSwsScenarioHandler,
  runIdempotencyScenarioHandler,
  runSwsToDepartmentsScenarioHandler,
} from "./scenarios.controller";

export const scenariosRouter = Router();

scenariosRouter.post("/sws-to-departments", runSwsToDepartmentsScenarioHandler);
scenariosRouter.post("/department-to-sws", runDepartmentToSwsScenarioHandler);
scenariosRouter.post("/departments-to-sws", runDepartmentToSwsScenarioHandler);
scenariosRouter.post("/conflict", runConflictScenarioHandler);
scenariosRouter.post("/idempotency", runIdempotencyScenarioHandler);
scenariosRouter.post("/failure-retry", runFailureRetryScenarioHandler);
