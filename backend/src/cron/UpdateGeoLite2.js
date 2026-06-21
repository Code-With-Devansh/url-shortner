import logger from "../logger/index.js";
import { downloadDatabase, loadReader } from "./jobs/UpdateGeoLite2.js";
const jobLogger = logger.child({
  service: "cron",
  job: "geoLite2 Database Update",
  runId: crypto.randomUUID(),
});
const start = Date.now();
try {
  await downloadDatabase();
  await loadReader();
  jobLogger.info(
    { durationMs: Date.now() - start },
    "[geo] Database updated successfully",
  );
} catch (err) {
  jobLogger.error({ err, durationMs: Date.now() - start }, "job failed");
}
