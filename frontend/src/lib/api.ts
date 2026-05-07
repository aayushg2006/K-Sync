import axios, { AxiosError, type AxiosResponse } from "axios";

import type { ApiEnvelope, ApiErrorShape } from "@/types/api.types";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080",
  headers: {
    "Content-Type": "application/json",
  },
});

function isApiEnvelope<T>(payload: ApiEnvelope<T> | T): payload is ApiEnvelope<T> {
  return typeof payload === "object" && payload !== null && ("data" in payload || "success" in payload || "error" in payload);
}

export class ApiClientError extends Error {
  code?: string;
  details?: unknown;
  status?: number;

  constructor(message: string, input?: Partial<ApiErrorShape> & { status?: number }) {
    super(message);
    this.name = "ApiClientError";
    this.code = input?.code;
    this.details = input?.details;
    this.status = input?.status;
  }
}

export function normalizeApiError(error: unknown): ApiClientError {
  if (error instanceof ApiClientError) {
    return error;
  }

  if (axios.isAxiosError(error)) {
    const payload = error.response?.data as ApiErrorShape | ApiEnvelope<unknown> | undefined;
    const envelopeError =
      payload && typeof payload === "object" && "error" in payload ? payload.error : undefined;
    const code =
      envelopeError?.code ??
      (payload && typeof payload === "object" && "code" in payload ? String(payload.code) : undefined);
    const details =
      envelopeError?.details ??
      (payload && typeof payload === "object" && "details" in payload ? payload.details : undefined);
    const message =
      envelopeError?.message ??
      (payload && typeof payload === "object" && "message" in payload
        ? String(payload.message)
        : error.message);

    return new ApiClientError(message, {
      code,
      details,
      status: error.response?.status,
    });
  }

  if (error instanceof Error) {
    return new ApiClientError(error.message);
  }

  return new ApiClientError("An unexpected API error occurred.");
}

export async function unwrapApiResponse<T>(
  request: Promise<AxiosResponse<ApiEnvelope<T> | T>>,
): Promise<T> {
  try {
    const response = await request;
    const payload = response.data;

    if (isApiEnvelope(payload)) {
      if (payload.data !== undefined) {
        return payload.data;
      }

      throw new ApiClientError(
        payload.error?.message ?? payload.message ?? "API response did not include data.",
        payload.error,
      );
    }

    return payload;
  } catch (error) {
    throw normalizeApiError(error);
  }
}
