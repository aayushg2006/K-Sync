import { api, unwrapApiResponse } from "@/lib/api";
import type { PaginatedResponse } from "@/types/api.types";
import type { CanonicalEvent, EventDetail, EventStatus, ServiceType, SystemName } from "@/types/event.types";

export interface EventQueryParams {
  limit?: number;
  page?: number;
  ubid?: string;
  status?: EventStatus;
  sourceSystem?: SystemName;
  serviceType?: ServiceType;
}

export function getEvents(params?: EventQueryParams): Promise<PaginatedResponse<CanonicalEvent>> {
  return unwrapApiResponse(api.get("/api/dashboard/events", { params }));
}

export function getEventById(eventId: string): Promise<EventDetail> {
  return unwrapApiResponse(api.get(`/api/dashboard/events/${encodeURIComponent(eventId)}`));
}
