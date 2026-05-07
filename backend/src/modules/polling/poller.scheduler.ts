import env from "../../config/env";
import {
  pollAllKnownDepartmentRecords,
} from "./polling.service";

const pollerGlobal = globalThis as typeof globalThis & {
  pollingIntervalHandle?: NodeJS.Timeout;
};

export function startPollingScheduler() {
  if (!env.ENABLE_POLLER) {
    console.info("[poller] scheduler disabled because ENABLE_POLLER is false");
    return;
  }

  if (pollerGlobal.pollingIntervalHandle) {
    return;
  }

  const intervalMs = env.POLLER_INTERVAL_SECONDS * 1000;
  const intervalHandle = setInterval(() => {
    void pollAllKnownDepartmentRecords().catch((error) => {
      console.warn(`[poller] scheduled polling run failed: ${(error as Error).message}`);
    });
  }, intervalMs);

  intervalHandle.unref?.();
  pollerGlobal.pollingIntervalHandle = intervalHandle;

  console.info(`[poller] scheduler started with interval ${env.POLLER_INTERVAL_SECONDS}s`);
}

export function stopPollingScheduler() {
  if (!pollerGlobal.pollingIntervalHandle) {
    return;
  }

  clearInterval(pollerGlobal.pollingIntervalHandle);
  pollerGlobal.pollingIntervalHandle = undefined;
}

