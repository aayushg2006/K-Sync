import { Request, Response } from "express";

import { buildSuccessResponse } from "../../common/utils/apiResponse";
import {
  amendEstablishmentByLabourRegNo,
  getEstablishmentByLabourRegNo,
  getMockEkarmikaStatus,
  listEkarmikaChanges,
  manuallyUpdateEstablishment,
} from "./mockEkarmika.service";

export async function getMockEkarmikaStatusHandler(_request: Request, response: Response) {
  response.status(200).json(buildSuccessResponse(await getMockEkarmikaStatus(), "Mock e-Karmika module is available."));
}

export async function getEstablishmentHandler(request: Request, response: Response) {
  const { labourRegNo } = request.params as { labourRegNo: string };

  response
    .status(200)
    .json(
      buildSuccessResponse(
        await getEstablishmentByLabourRegNo(labourRegNo),
        `Mock e-Karmika establishment ${labourRegNo} loaded.`,
      ),
    );
}

export async function amendEstablishmentHandler(request: Request, response: Response) {
  const { labourRegNo } = request.params as { labourRegNo: string };

  response
    .status(200)
    .json(
      buildSuccessResponse(
        await amendEstablishmentByLabourRegNo(labourRegNo, request.body),
        `Mock e-Karmika establishment ${labourRegNo} amended.`,
      ),
    );
}

export async function manualUpdateEstablishmentHandler(request: Request, response: Response) {
  response
    .status(200)
    .json(buildSuccessResponse(await manuallyUpdateEstablishment(request.body), "Mock e-Karmika manual update applied."));
}

export async function listEkarmikaChangesHandler(request: Request, response: Response) {
  const { updated_since: updatedSince } = request.query as { updated_since?: string };

  response
    .status(200)
    .json(buildSuccessResponse(await listEkarmikaChanges({ updatedSince }), "Mock e-Karmika changes loaded."));
}
