import { Job } from "bullmq";

import { QueueJobPayload } from "../queue.service";
import { getAdapterForTargetSystem } from "../../adapters/adapter.registry";
import { processWriteJob } from "./processor.shared";
import { AppError } from "../../../common/errors/AppError";
import { ERROR_CODES } from "../../../common/errors/errorCodes";

export async function processDepartmentWriteJob(job: Job<QueueJobPayload>) {
  const adapter = getAdapterForTargetSystem(job.data.targetSystem);

  if (!adapter || (adapter.targetSystem !== "EKARMIKA" && adapter.targetSystem !== "ESURAKSHATE")) {
    throw new AppError({
      code: ERROR_CODES.BAD_REQUEST,
      details: {
        targetSystem: job.data.targetSystem,
      },
      message: `No department adapter is registered for target system ${job.data.targetSystem}.`,
      statusCode: 400,
    });
  }

  return processWriteJob(job, adapter);
}
