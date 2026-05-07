import { Request, Response } from "express";

import { buildSuccessResponse } from "../../common/utils/apiResponse";
import {
  getPollingSnapshots,
  pollAllKnownDepartmentRecords,
  pollSingleDepartmentRecord,
} from "./polling.service";
import { PollableSystemName } from "./diff.service";

export async function runPollingHandler(_request: Request, response: Response) {
  response.status(202).json(
    buildSuccessResponse(
      await pollAllKnownDepartmentRecords(),
      "Polling run completed for all known department records.",
    ),
  );
}

export async function runSinglePollingHandler(request: Request, response: Response) {
  const { systemName, ubid } = request.params as {
    systemName: PollableSystemName;
    ubid: string;
  };

  response.status(202).json(
    buildSuccessResponse(
      await pollSingleDepartmentRecord(systemName, ubid),
      `Polling run completed for ${systemName} ${ubid}.`,
    ),
  );
}

export async function listSnapshotsHandler(_request: Request, response: Response) {
  response.status(200).json(
    buildSuccessResponse(
      await getPollingSnapshots(),
      "Department snapshots loaded.",
    ),
  );
}

