import { api, unwrapApiResponse } from "@/lib/api";
import type { ConflictReviewRequest, ConflictRecord } from "@/types/conflict.types";
import type { ConflictListResponse } from "@/types/dashboard.types";

export interface ConflictQueryParams {
  limit?: number;
  page?: number;
  ubid?: string;
  resolutionStatus?: string;
}

export function getConflicts(params?: ConflictQueryParams): Promise<ConflictListResponse> {
  return unwrapApiResponse(api.get("/api/dashboard/conflicts", { params }));
}

export function reviewConflict(conflictId: string, payload: ConflictReviewRequest): Promise<ConflictRecord> {
  return unwrapApiResponse(api.post(`/api/conflicts/${encodeURIComponent(conflictId)}/review`, payload));
}

export function replayConflict(conflictId: string, payload?: { notes?: string; requestedBy?: string }) {
  return unwrapApiResponse(
    api.post(`/api/conflicts/${encodeURIComponent(conflictId)}/replay`, payload ?? {}),
  );
}
