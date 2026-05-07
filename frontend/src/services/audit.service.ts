import { api, unwrapApiResponse } from "@/lib/api";
import type { PaginatedResponse } from "@/types/api.types";
import type { AuditLog, AuditStage } from "@/types/audit.types";
import type { EventStatus, SystemName } from "@/types/event.types";

export interface AuditLogQueryParams {
  correlationId?: string;
  eventId?: string;
  stage?: AuditStage;
  sourceSystem?: SystemName;
  targetSystem?: SystemName;
  ubid?: string;
  limit?: number;
  page?: number;
}

export function getAuditByCorrelationId(correlationId: string): Promise<AuditLog[]> {
  return unwrapApiResponse(api.get(`/api/audit/correlation/${encodeURIComponent(correlationId)}`));
}

export function getAuditLogs(params?: AuditLogQueryParams): Promise<PaginatedResponse<AuditLog>> {
  return unwrapApiResponse(api.get("/api/dashboard/audit", { params }));
}
