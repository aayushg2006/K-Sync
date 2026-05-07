import type { PaginatedResponse } from "./api.types";
import type { ManualReviewItem } from "./conflict.types";
import type { ServiceType, SystemName } from "./event.types";

export interface DashboardMetrics {
  totalEvents: number;
  successfulSyncs: number;
  failedWrites: number;
  conflictsDetected: number;
  duplicateRequestsBlocked: number;
  pendingManualReviews: number;
  dlqJobs: number;
  queueJobs: number;
}

export interface HealthStatus {
  status: string;
  message?: string;
}

export interface SystemHealth {
  mockSws: HealthStatus;
  mockEkarmika: HealthStatus;
  mockEsurakshate: HealthStatus;
  database: HealthStatus;
  redis: HealthStatus;
  queue: HealthStatus;
}

export interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
}

export interface QueueStatus {
  redis: HealthStatus;
  queue: HealthStatus;
  bullmq?: {
    departmentWriteQueue?: QueueStats;
    swsWriteQueue?: QueueStats;
    pollingQueue?: QueueStats;
    retryQueue?: QueueStats;
  };
  queueJobStatusCounts: Record<string, number>;
  deadLetterJobCount: number;
}

export interface AuthorityMatrixRule {
  fieldPath: string;
  version: number;
  serviceType?: ServiceType;
  authoritativeSystem: SystemName;
  fallbackSystem?: SystemName;
  targetSystem?: SystemName;
  manualReviewRequired: boolean;
  status: string;
  ruleConfig?: Record<string, unknown>;
  notes?: string;
}

export interface ConflictListResponse extends PaginatedResponse<import("./conflict.types").ConflictRecord> {
  manualReviewItems: ManualReviewItem[];
}
