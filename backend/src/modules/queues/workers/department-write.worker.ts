import { Worker } from "bullmq";

import { createWorkerOptions } from "../../../config/queues";
import { DEPARTMENT_WRITE_QUEUE } from "../queue.names";
import { processDepartmentWriteJob } from "../processors/department-write.processor";

const workerGlobal = globalThis as typeof globalThis & {
  departmentWriteWorker?: Worker;
};

export function getDepartmentWriteWorker() {
  if (!workerGlobal.departmentWriteWorker) {
    const worker = new Worker(
      DEPARTMENT_WRITE_QUEUE,
      async (job) => {
        console.info(
          `[department-write-worker] processing job ${job.id} for ${job.data.targetSystem}`,
        );

        return processDepartmentWriteJob(job);
      },
      createWorkerOptions("department-write-worker"),
    );

    worker.on("completed", (job) => {
      console.info(
        `[department-write-worker] completed job ${job.id ?? "unknown"} for ${job.data.targetSystem}`,
      );
    });

    worker.on("failed", (job, error) => {
      console.warn(
        `[department-write-worker] job ${job?.id ?? "unknown"} failed: ${error.message}`,
      );
    });

    workerGlobal.departmentWriteWorker = worker;
  }

  return workerGlobal.departmentWriteWorker;
}

export async function closeDepartmentWriteWorker() {
  if (!workerGlobal.departmentWriteWorker) {
    return;
  }

  await workerGlobal.departmentWriteWorker.close();
  workerGlobal.departmentWriteWorker = undefined;
}
