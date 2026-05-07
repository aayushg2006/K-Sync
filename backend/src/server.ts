import env from "./config/env";
import { API_DOCS_PATH, APP_NAME } from "./config/constants";
import app from "./app";
import { startPollingScheduler } from "./modules/polling/poller.scheduler";
import { startQueueWorkers } from "./modules/queues/workers";

startQueueWorkers();
startPollingScheduler();

app.listen(env.PORT, () => {
  console.info(`${APP_NAME} is running at http://localhost:${env.PORT}`);
  console.info(`Swagger docs available at http://localhost:${env.PORT}${API_DOCS_PATH}`);
});
