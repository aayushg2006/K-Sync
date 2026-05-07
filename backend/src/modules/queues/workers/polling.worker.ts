import { Worker } from "bullmq";

import { redisConnection } from "../../../config/redis";
import { POLLING_QUEUE } from "../queue.names";

export const pollingWorker = new Worker(
  POLLING_QUEUE,
  async (job) => {
    console.info(`[polling-worker] received job ${job.id}`, job.data);

    return {
      jobId: job.id,
      queue: POLLING_QUEUE,
      status: "placeholder-success",
    };
  },
  {
    connection: redisConnection,
  },
);

pollingWorker.on("failed", (job, error) => {
  console.warn(`[polling-worker] job ${job?.id ?? "unknown"} failed: ${error.message}`);
});
