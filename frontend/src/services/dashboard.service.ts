import { api, unwrapApiResponse } from "@/lib/api";
import type {
  AuthorityMatrixRule,
  DashboardMetrics,
  QueueStatus,
  SystemHealth,
} from "@/types/dashboard.types";

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  return unwrapApiResponse(api.get("/api/dashboard/metrics"));
}

export async function getSystemHealth(): Promise<SystemHealth> {
  return unwrapApiResponse(api.get("/api/dashboard/system-health"));
}

export async function getQueueStatus(): Promise<QueueStatus> {
  return unwrapApiResponse(api.get("/api/dashboard/queue-status"));
}

export async function getAuthorityMatrix(): Promise<AuthorityMatrixRule[]> {
  return unwrapApiResponse(api.get("/api/dashboard/authority-matrix"));
}
