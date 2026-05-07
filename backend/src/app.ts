import cors from "cors";
import express from "express";

import { AppError } from "./common/errors/AppError";
import { ERROR_CODES } from "./common/errors/errorCodes";
import { errorHandler } from "./common/middleware/errorHandler";
import { requestLogger } from "./common/middleware/requestLogger";
import env from "./config/env";
import { API_PREFIX, APP_NAME } from "./config/constants";
import { setupSwagger } from "./docs/swagger";
import { auditRouter } from "./modules/audit/audit.routes";
import { conflictsRouter } from "./modules/conflicts/conflicts.routes";
import { dashboardRouter } from "./modules/dashboard/dashboard.routes";
import { ksyncRouter } from "./modules/ksync/ksync.routes";
import { mockEkarmikaRouter } from "./modules/mock-ekarmika/mockEkarmika.routes";
import { mockEsurakshateRouter } from "./modules/mock-esurakshate/mockEsurakshate.routes";
import { mockSwsRouter } from "./modules/mock-sws/mockSws.routes";
import { pollingRouter } from "./modules/polling/polling.routes";

const app = express();
const allowedOrigins = new Set(env.allowedCorsOrigins);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      callback(null, false);
    },
  }),
);
app.use(express.json());
app.use(requestLogger);

app.get("/health", (_request, response) => {
  response.status(200).json({
    status: "ok",
    service: APP_NAME,
  });
});

setupSwagger(app);

app.use(`${API_PREFIX}/mock/sws`, mockSwsRouter);
app.use(`${API_PREFIX}/mock/ekarmika`, mockEkarmikaRouter);
app.use(`${API_PREFIX}/mock/esurakshate`, mockEsurakshateRouter);
app.use(`${API_PREFIX}/ksync`, ksyncRouter);
app.use(`${API_PREFIX}/audit`, auditRouter);
app.use(`${API_PREFIX}/conflicts`, conflictsRouter);
app.use(`${API_PREFIX}/dashboard`, dashboardRouter);
app.use(`${API_PREFIX}/polling`, pollingRouter);

app.use((_request, _response, next) => {
  next(
    new AppError({
      code: ERROR_CODES.NOT_FOUND,
      message: "Requested route was not found.",
      statusCode: 404,
    }),
  );
});

app.use(errorHandler);

export default app;
