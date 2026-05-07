import { z } from "zod";

import { ubidSchema } from "./ksync.schemas";

export const pollableSystemNameSchema = z.enum(["EKARMIKA", "ESURAKSHATE"]);

export const pollingRunParamsSchema = z.object({
  systemName: pollableSystemNameSchema,
  ubid: ubidSchema,
});

