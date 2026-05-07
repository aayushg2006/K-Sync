import { Worker } from "bullmq";

import { redisConnection } from "../../../config/redis";
import { RETRY_QUEUE } from "../queue.names";

export const retryWorker = new Worker(
  RETRY_QUEUE,
  async (job) => {
    console.info(`[retry-worker] received job ${job.id}`, job.data);

    return {
      jobId: job.id,
      queue: RETRY_QUEUE,
      status: "placeholder-success",
    };
  },
  {
    connection: redisConnection,
  },
);

retryWorker.on("failed", (job, error) => {
  console.warn(`[retry-worker] job ${job?.id ?? "unknown"} failed: ${error.message}`);
});
