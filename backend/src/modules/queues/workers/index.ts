import {
  closeDepartmentWriteWorker,
  getDepartmentWriteWorker,
} from "./department-write.worker";
import { closeSwsWriteWorker, getSwsWriteWorker } from "./sws-write.worker";

const workerBootstrapGlobal = globalThis as typeof globalThis & {
  queueWorkersStarted?: boolean;
};

export function startQueueWorkers() {
  if (workerBootstrapGlobal.queueWorkersStarted) {
    return;
  }

  getDepartmentWriteWorker();
  getSwsWriteWorker();

  workerBootstrapGlobal.queueWorkersStarted = true;
  console.info("[queue-workers] department and SWS workers started");
}

export async function stopQueueWorkers() {
  if (!workerBootstrapGlobal.queueWorkersStarted) {
    return;
  }

  await Promise.all([
    closeDepartmentWriteWorker(),
    closeSwsWriteWorker(),
  ]);

  workerBootstrapGlobal.queueWorkersStarted = false;
  console.info("[queue-workers] department and SWS workers stopped");
}
