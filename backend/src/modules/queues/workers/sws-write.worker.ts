import { Worker } from "bullmq";

import { createWorkerOptions } from "../../../config/queues";
import { SWS_WRITE_QUEUE } from "../queue.names";
import { processSwsWriteJob } from "../processors/sws-write.processor";

const workerGlobal = globalThis as typeof globalThis & {
  swsWriteWorker?: Worker;
};

export function getSwsWriteWorker() {
  if (!workerGlobal.swsWriteWorker) {
    const worker = new Worker(
      SWS_WRITE_QUEUE,
      async (job) => {
        console.info(
          `[sws-write-worker] processing job ${job.id} for ${job.data.targetSystem}`,
        );

        return processSwsWriteJob(job);
      },
      createWorkerOptions("sws-write-worker"),
    );

    worker.on("completed", (job) => {
      console.info(`[sws-write-worker] completed job ${job.id ?? "unknown"}`);
    });

    worker.on("failed", (job, error) => {
      console.warn(
        `[sws-write-worker] job ${job?.id ?? "unknown"} failed: ${error.message}`,
      );
    });

    workerGlobal.swsWriteWorker = worker;
  }

  return workerGlobal.swsWriteWorker;
}

export async function closeSwsWriteWorker() {
  if (!workerGlobal.swsWriteWorker) {
    return;
  }

  await workerGlobal.swsWriteWorker.close();
  workerGlobal.swsWriteWorker = undefined;
}
