import { Request, Response } from "express";

import { buildSuccessResponse } from "../../common/utils/apiResponse";
import {
  createMockSwsServiceRequest,
  getMockSwsBusinessByUbid,
  getMockSwsStatus,
  listMockSwsBusinesses,
  updateMockSwsBusiness,
} from "./mockSws.service";

export async function getMockSwsStatusHandler(_request: Request, response: Response) {
  response.status(200).json(buildSuccessResponse(await getMockSwsStatus(), "Mock SWS module is available."));
}

export async function listMockSwsBusinessesHandler(_request: Request, response: Response) {
  response
    .status(200)
    .json(buildSuccessResponse(await listMockSwsBusinesses(), "Mock SWS businesses loaded."));
}

export async function getMockSwsBusinessHandler(request: Request, response: Response) {
  const { ubid } = request.params as { ubid: string };

  response
    .status(200)
    .json(
      buildSuccessResponse(
        await getMockSwsBusinessByUbid(ubid),
        `Mock SWS business ${ubid} loaded.`,
      ),
    );
}

export async function updateMockSwsBusinessHandler(request: Request, response: Response) {
  const { ubid } = request.params as { ubid: string };

  response
    .status(200)
    .json(
      buildSuccessResponse(
        await updateMockSwsBusiness(ubid, request.body),
        `Mock SWS business ${ubid} updated.`,
      ),
    );
}

export async function createMockSwsServiceRequestHandler(request: Request, response: Response) {
  response
    .status(201)
    .json(
      buildSuccessResponse(
        await createMockSwsServiceRequest(request.body),
        "Mock SWS service request accepted.",
      ),
    );
}
