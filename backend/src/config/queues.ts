import { Queue, WorkerOptions } from "bullmq";

import env from "./env";
import { redisConnection } from "./redis";
import {
  DEPARTMENT_WRITE_QUEUE,
  POLLING_QUEUE,
  RETRY_QUEUE,
  SWS_WRITE_QUEUE,
} from "../modules/queues/queue.names";

const sharedQueueOptions = {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: env.QUEUE_MAX_ATTEMPTS,
    backoff: {
      delay: 5000,
      type: "ksync-staged",
    },
    removeOnComplete: 100,
    removeOnFail: 100,
  },
} as const;

export const QUEUE_BACKOFF_DELAYS_MS = [5000, 15000, 30000] as const;
export const QUEUE_BACKOFF_STRATEGY = "ksync-staged";

export const departmentWriteQueue = new Queue(DEPARTMENT_WRITE_QUEUE, sharedQueueOptions);
export const swsWriteQueue = new Queue(SWS_WRITE_QUEUE, sharedQueueOptions);
export const pollingQueue = new Queue(POLLING_QUEUE, sharedQueueOptions);
export const retryQueue = new Queue(RETRY_QUEUE, sharedQueueOptions);

export function createWorkerOptions(workerName: string): WorkerOptions {
  return {
    connection: redisConnection,
    concurrency: 1,
    name: workerName,
    settings: {
      backoffStrategy: (attemptsMade, type) => {
        if (type !== QUEUE_BACKOFF_STRATEGY) {
          return 0;
        }

        const delayIndex = Math.min(
          Math.max(attemptsMade - 1, 0),
          QUEUE_BACKOFF_DELAYS_MS.length - 1,
        );

        return QUEUE_BACKOFF_DELAYS_MS[delayIndex];
      },
    },
  };
}
