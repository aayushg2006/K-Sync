import { Job } from "bullmq";

import { AppError } from "../../../common/errors/AppError";
import { ERROR_CODES } from "../../../common/errors/errorCodes";
import { getAdapterForTargetSystem } from "../../adapters/adapter.registry";
import { QueueJobPayload } from "../queue.service";
import { processWriteJob } from "./processor.shared";

export async function processSwsWriteJob(job: Job<QueueJobPayload>) {
  const adapter = getAdapterForTargetSystem("SWS");

  if (!adapter) {
    throw new AppError({
      code: ERROR_CODES.BAD_REQUEST,
      message: "No SWS adapter is registered for queue processing.",
      statusCode: 400,
    });
  }

  return processWriteJob(job, adapter);
}
