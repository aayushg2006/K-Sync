import { QueueJobStatus, QueueJob as QueueJobRecordModel, Prisma } from "@prisma/client";
import { Job, JobsOptions } from "bullmq";
import { nanoid } from "nanoid";

import env from "../../config/env";
import {
  departmentWriteQueue,
  pollingQueue,
  retryQueue,
  swsWriteQueue,
} from "../../config/queues";
import prisma from "../../config/prisma";
import { SystemName } from "../../common/types/system.types";
import {
  DEPARTMENT_WRITE_QUEUE,
  POLLING_QUEUE,
  RETRY_QUEUE,
  SWS_WRITE_QUEUE,
} from "./queue.names";

export interface QueueJobPayload {
  correlationId?: string;
  eventId: string;
  metadata?: Record<string, unknown>;
  sourceSystem?: SystemName;
  targetSystem: SystemName;
  ubid?: string;
}

export interface QueueStats {
  active: number;
  completed: number;
  delayed: number;
  failed: number;
  paused: number;
  waiting: number;
}

export interface QueueStatsSummary {
  departmentWriteQueue: QueueStats;
  pollingQueue: QueueStats;
  retryQueue: QueueStats;
  swsWriteQueue: QueueStats;
}

const QUEUE_BACKOFF_DELAYS_MS = [5000, 15000, 30000] as const;

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function normalizeError(error: unknown) {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      stack: error.stack,
    };
  }

  return {
    message: "Unknown queue processing error.",
  };
}

function buildJobOptions(jobName: string, overrides?: JobsOptions): JobsOptions {
  return {
    jobId: overrides?.jobId,
    ...overrides,
    backoff: overrides?.backoff ?? {
      delay: QUEUE_BACKOFF_DELAYS_MS[0],
      type: "ksync-staged",
    },
    attempts: overrides?.attempts ?? env.QUEUE_MAX_ATTEMPTS,
    removeOnComplete: overrides?.removeOnComplete ?? 100,
    removeOnFail: overrides?.removeOnFail ?? 100,
  };
}

function buildQueueJobId(queueName: string, eventId: string, targetSystem: SystemName) {
  return `${queueName}:${eventId}:${targetSystem}`;
}

function getRetryDelayMs(failedAttempt: number) {
  const delayIndex = Math.min(
    Math.max(failedAttempt - 1, 0),
    QUEUE_BACKOFF_DELAYS_MS.length - 1,
  );

  return QUEUE_BACKOFF_DELAYS_MS[delayIndex];
}

async function loadEventForQueue(eventId: string) {
  return prisma.canonicalEvent.findUnique({
    where: { eventId },
    select: {
      correlationId: true,
      eventId: true,
      sourceSystem: true,
      ubid: true,
    },
  });
}

async function upsertQueueJobRecord(
  job: Job<QueueJobPayload>,
  queueName: string,
  status: QueueJobStatus,
) {
  const payload = job.data;
  const event = await loadEventForQueue(payload.eventId);

  await prisma.queueJob.upsert({
    where: {
      jobId: String(job.id),
    },
    create: {
      attemptsMade: job.attemptsMade,
      correlationId: payload.correlationId ?? event?.correlationId ?? null,
      eventId: payload.eventId,
      jobId: String(job.id),
      maxAttempts:
        typeof job.opts.attempts === "number"
          ? job.opts.attempts
          : env.QUEUE_MAX_ATTEMPTS,
      metadata: payload.metadata ? toJsonValue(payload.metadata) : undefined,
      payload: toJsonValue(payload),
      queueName,
      scheduledFor: new Date(),
      sourceSystem: payload.sourceSystem ?? event?.sourceSystem ?? null,
      status,
      targetSystem: payload.targetSystem,
      ubid: payload.ubid ?? event?.ubid ?? null,
    },
    update: {
      attemptsMade: job.attemptsMade,
      correlationId: payload.correlationId ?? event?.correlationId ?? null,
      eventId: payload.eventId,
      maxAttempts:
        typeof job.opts.attempts === "number"
          ? job.opts.attempts
          : env.QUEUE_MAX_ATTEMPTS,
      metadata: payload.metadata ? toJsonValue(payload.metadata) : undefined,
      payload: toJsonValue(payload),
      queueName,
      scheduledFor: new Date(),
      sourceSystem: payload.sourceSystem ?? event?.sourceSystem ?? null,
      status,
      targetSystem: payload.targetSystem,
      ubid: payload.ubid ?? event?.ubid ?? null,
    },
  });
}

export async function addDepartmentWriteJob(
  eventId: string,
  targetSystem: SystemName,
  options?: JobsOptions,
): Promise<Job<QueueJobPayload>> {
  const event = await loadEventForQueue(eventId);

  const payload: QueueJobPayload = {
    correlationId: event?.correlationId,
    eventId,
    sourceSystem: event?.sourceSystem,
    targetSystem,
    ubid: event?.ubid,
  };
  const job = await departmentWriteQueue.add(
    "department-write",
    payload,
    buildJobOptions("department-write", {
      ...options,
      jobId:
        options?.jobId ??
        buildQueueJobId(DEPARTMENT_WRITE_QUEUE, eventId, targetSystem),
    }),
  );

  await upsertQueueJobRecord(job, DEPARTMENT_WRITE_QUEUE, QueueJobStatus.QUEUED);

  return job;
}

export async function addSwsWriteJob(
  eventId: string,
  options?: JobsOptions,
): Promise<Job<QueueJobPayload>> {
  const event = await loadEventForQueue(eventId);
  const payload: QueueJobPayload = {
    correlationId: event?.correlationId,
    eventId,
    sourceSystem: event?.sourceSystem,
    targetSystem: "SWS",
    ubid: event?.ubid,
  };
  const job = await swsWriteQueue.add(
    "sws-write",
    payload,
    buildJobOptions("sws-write", {
      ...options,
      jobId: options?.jobId ?? buildQueueJobId(SWS_WRITE_QUEUE, eventId, "SWS"),
    }),
  );

  await upsertQueueJobRecord(job, SWS_WRITE_QUEUE, QueueJobStatus.QUEUED);

  return job;
}

export async function addPollingJob(
  payload: QueueJobPayload,
  options?: JobsOptions,
): Promise<Job<QueueJobPayload>> {
  const job = await pollingQueue.add(
    "polling",
    payload,
    buildJobOptions("polling", options),
  );
  await upsertQueueJobRecord(job, POLLING_QUEUE, QueueJobStatus.QUEUED);
  return job;
}

export async function markQueueJobProcessing(
  job: Job<QueueJobPayload>,
  metadata?: Record<string, unknown>,
) {
  await prisma.queueJob.updateMany({
    where: {
      jobId: String(job.id),
    },
    data: {
      attemptsMade: job.attemptsMade + 1,
      metadata: metadata ? toJsonValue(metadata) : undefined,
      scheduledFor: null,
      startedAt: new Date(),
      status: QueueJobStatus.PROCESSING,
    },
  });
}

export async function markQueueJobCompleted(
  job: Job<QueueJobPayload>,
  result: unknown,
  metadata?: Record<string, unknown>,
) {
  await prisma.queueJob.updateMany({
    where: {
      jobId: String(job.id),
    },
    data: {
      attemptsMade: job.attemptsMade + 1,
      completedAt: new Date(),
      metadata: metadata ? toJsonValue(metadata) : undefined,
      result: toJsonValue(result),
      status: QueueJobStatus.COMPLETED,
    },
  });
}

export async function markQueueJobRetryScheduled(
  job: Job<QueueJobPayload>,
  error: unknown,
  delayMs: number,
  metadata?: Record<string, unknown>,
) {
  await prisma.queueJob.updateMany({
    where: {
      jobId: String(job.id),
    },
    data: {
      attemptsMade: job.attemptsMade + 1,
      error: toJsonValue(normalizeError(error)),
      metadata: metadata ? toJsonValue(metadata) : undefined,
      scheduledFor: new Date(Date.now() + delayMs),
      status: QueueJobStatus.RETRY_SCHEDULED,
    },
  });
}

export async function markQueueJobFailed(
  job: Job<QueueJobPayload>,
  error: unknown,
  metadata?: Record<string, unknown>,
) {
  await prisma.queueJob.updateMany({
    where: {
      jobId: String(job.id),
    },
    data: {
      attemptsMade: job.attemptsMade + 1,
      error: toJsonValue(normalizeError(error)),
      metadata: metadata ? toJsonValue(metadata) : undefined,
      status: QueueJobStatus.FAILED,
    },
  });
}

export async function moveQueueJobToDeadLetter(
  job: Job<QueueJobPayload>,
  error: unknown,
  metadata?: Record<string, unknown>,
) {
  const queueJobRecord = await prisma.queueJob.findUnique({
    where: {
      jobId: String(job.id),
    },
    select: {
      correlationId: true,
      eventId: true,
      payload: true,
      queueName: true,
      sourceSystem: true,
      targetSystem: true,
      ubid: true,
    },
  });

  await prisma.deadLetterJob.create({
    data: {
      correlationId: queueJobRecord?.correlationId ?? job.data.correlationId ?? null,
      dlqId: `DLQ-${nanoid(12)}`,
      error: toJsonValue(normalizeError(error)),
      eventId: queueJobRecord?.eventId ?? job.data.eventId,
      jobId: String(job.id),
      metadata: metadata ? toJsonValue(metadata) : undefined,
      movedAt: new Date(),
      payload: toJsonValue(queueJobRecord?.payload ?? job.data),
      queueName: queueJobRecord?.queueName ?? "unknown-queue",
      sourceSystem: queueJobRecord?.sourceSystem ?? job.data.sourceSystem ?? null,
      status: QueueJobStatus.DLQ_MOVED,
      targetSystem: queueJobRecord?.targetSystem ?? job.data.targetSystem,
      ubid: queueJobRecord?.ubid ?? job.data.ubid ?? null,
    },
  });

  await prisma.queueJob.updateMany({
    where: {
      jobId: String(job.id),
    },
    data: {
      attemptsMade: job.attemptsMade + 1,
      error: toJsonValue(normalizeError(error)),
      metadata: metadata ? toJsonValue(metadata) : undefined,
      status: QueueJobStatus.DLQ_MOVED,
    },
  });
}

export async function getQueueRecordsForEvent(eventId: string) {
  return prisma.queueJob.findMany({
    where: { eventId },
    select: {
      status: true,
      targetSystem: true,
    },
  });
}

export function getRetryDelayForAttempt(failedAttempt: number) {
  return getRetryDelayMs(failedAttempt);
}

async function getSingleQueueStats(
  queue: typeof departmentWriteQueue,
): Promise<QueueStats> {
  const counts = await queue.getJobCounts(
    "waiting",
    "active",
    "completed",
    "failed",
    "delayed",
    "paused",
  );

  return {
    active: counts.active ?? 0,
    completed: counts.completed ?? 0,
    delayed: counts.delayed ?? 0,
    failed: counts.failed ?? 0,
    paused: counts.paused ?? 0,
    waiting: counts.waiting ?? 0,
  };
}

export async function getQueueStats(): Promise<QueueStatsSummary> {
  const [departmentWrite, swsWrite, polling, retry] = await Promise.all([
    getSingleQueueStats(departmentWriteQueue),
    getSingleQueueStats(swsWriteQueue),
    getSingleQueueStats(pollingQueue),
    getSingleQueueStats(retryQueue),
  ]);

  return {
    departmentWriteQueue: departmentWrite,
    pollingQueue: polling,
    retryQueue: retry,
    swsWriteQueue: swsWrite,
  };
}
