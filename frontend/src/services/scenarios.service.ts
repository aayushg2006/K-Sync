import { api, normalizeApiError } from "@/lib/api";

export interface ScenarioRunResult {
  success: true;
  scenario: string;
  message: string;
  correlationId?: string;
  eventId?: string;
  conflictId?: string;
  details: Record<string, unknown>;
}

export type DemoResetResult = ScenarioRunResult;

async function runScenario(
  scenario: string,
  path: string,
): Promise<ScenarioRunResult> {
  try {
    const response = await api.post<ScenarioRunResult>(path);
    return response.data;
  } catch (error) {
    throw normalizeApiError(error);
  }
}

export function runSwsToDepartmentsScenario(): Promise<ScenarioRunResult> {
  return runScenario("SWS_TO_DEPARTMENTS", "/api/ksync/run-scenario/sws-to-departments");
}

export function runDepartmentToSwsScenario(): Promise<ScenarioRunResult> {
  return runScenario("DEPARTMENT_TO_SWS", "/api/ksync/run-scenario/department-to-sws");
}

export function runConflictScenario(): Promise<ScenarioRunResult> {
  return runScenario("CONFLICT", "/api/ksync/run-scenario/conflict");
}

export function runManualReviewScenario(): Promise<ScenarioRunResult> {
  return runScenario("MANUAL_REVIEW", "/api/ksync/run-scenario/manual-review");
}

export function runIdempotencyScenario(): Promise<ScenarioRunResult> {
  return runScenario("IDEMPOTENCY", "/api/ksync/run-scenario/idempotency");
}

export function runFailureRetryScenario(): Promise<ScenarioRunResult> {
  return runScenario("FAILURE_RETRY", "/api/ksync/run-scenario/failure-retry");
}

export async function resetDemo(): Promise<DemoResetResult> {
  try {
    const response = await api.post<DemoResetResult>("/api/ksync/reset-demo");
    return response.data;
  } catch (error) {
    throw normalizeApiError(error);
  }
}
