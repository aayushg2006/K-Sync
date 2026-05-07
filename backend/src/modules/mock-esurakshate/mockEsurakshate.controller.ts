import { Request, Response } from "express";

import { buildSuccessResponse } from "../../common/utils/apiResponse";
import {
  amendFactoryByLicenseNo,
  buildFactorySnapshot,
  getFactoryByLicenseNo,
  getMockEsurakshateStatus,
  manuallyUpdateFactory,
} from "./mockEsurakshate.service";

export async function getMockEsurakshateStatusHandler(_request: Request, response: Response) {
  response
    .status(200)
    .json(buildSuccessResponse(await getMockEsurakshateStatus(), "Mock e-Surakshate module is available."));
}

export async function getFactoryHandler(request: Request, response: Response) {
  const { factoryLicenseNo } = request.params as { factoryLicenseNo: string };

  response
    .status(200)
    .json(
      buildSuccessResponse(
        await getFactoryByLicenseNo(factoryLicenseNo),
        `Mock e-Surakshate factory ${factoryLicenseNo} loaded.`,
      ),
    );
}

export async function amendFactoryHandler(request: Request, response: Response) {
  const { factoryLicenseNo } = request.params as { factoryLicenseNo: string };

  response
    .status(200)
    .json(
      buildSuccessResponse(
        await amendFactoryByLicenseNo(factoryLicenseNo, request.body),
        `Mock e-Surakshate factory ${factoryLicenseNo} amended.`,
      ),
    );
}

export async function manualUpdateFactoryHandler(request: Request, response: Response) {
  response
    .status(200)
    .json(
      buildSuccessResponse(
        await manuallyUpdateFactory(request.body),
        "Mock e-Surakshate manual update applied.",
      ),
    );
}

export async function getFactorySnapshotHandler(request: Request, response: Response) {
  const { factoryLicenseNo } = request.params as { factoryLicenseNo: string };
  const { format } = request.query as { format?: "json" | "xml" };
  const snapshot = await buildFactorySnapshot(factoryLicenseNo);

  if (format === "xml") {
    response.setHeader("Content-Type", "application/xml");
    response.status(200).send(snapshot.snapshotXml);
    return;
  }

  response.status(200).json(
    buildSuccessResponse(
      {
        factoryLicenseNo,
        snapshotXml: snapshot.snapshotXml,
      },
      `Mock e-Surakshate snapshot ${factoryLicenseNo} generated.`,
    ),
  );
}
