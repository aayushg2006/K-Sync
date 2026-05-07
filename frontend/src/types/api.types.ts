export interface ApiErrorShape {
  code?: string;
  details?: unknown;
  message: string;
}

export interface ApiEnvelope<T> {
  success?: boolean;
  message?: string;
  data?: T;
  meta?: Record<string, unknown>;
  error?: ApiErrorShape;
}

export interface PaginatedResponse<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
}
