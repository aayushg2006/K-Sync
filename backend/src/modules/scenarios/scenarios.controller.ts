import { Request, Response } from "express";

import {
  resetScenarioDemoData,
  runFailureRetryScenario,
  runConflictScenario,
  runDepartmentToSwsScenario,
  runIdempotencyScenario,
  runManualReviewScenario,
  runSwsToDepartmentsScenario,
} from "./scenarios.service";

export async function runSwsToDepartmentsScenarioHandler(
  _request: Request,
  response: Response,
) {
  response.status(202).json(await runSwsToDepartmentsScenario());
}

export async function runDepartmentToSwsScenarioHandler(
  _request: Request,
  response: Response,
) {
  response.status(202).json(await runDepartmentToSwsScenario());
}

export async function runConflictScenarioHandler(
  _request: Request,
  response: Response,
) {
  response.status(202).json(await runConflictScenario());
}

export async function runManualReviewScenarioHandler(
  _request: Request,
  response: Response,
) {
  response.status(202).json(await runManualReviewScenario());
}

export async function runIdempotencyScenarioHandler(
  _request: Request,
  response: Response,
) {
  response.status(202).json(await runIdempotencyScenario());
}

export async function runFailureRetryScenarioHandler(
  _request: Request,
  response: Response,
) {
  response.status(202).json(await runFailureRetryScenario());
}

export async function resetScenarioDemoDataHandler(
  _request: Request,
  response: Response,
) {
  response.status(200).json(await resetScenarioDemoData());
}
