// src/cron/queueMetricsPoller.js (or wherever your BullMQ queues are instantiated)
import { queueDepth } from "../config/metrics.js";

// Pass in your existing Queue instances (clickQueue, emailQueue, etc).
// Call startQueueMetricsPolling(queues) once at app startup.
export function startQueueMetricsPolling(queues, intervalMs = 10000) {
  setInterval(async () => {
    for (const queue of queues) {
      try {
        const counts = await queue.getJobCounts(
          "waiting", "active", "completed", "failed", "delayed"
        );
        for (const [state, count] of Object.entries(counts)) {
          queueDepth.set({ queue: queue.name, state }, count);
        }
      } catch (err) {
        // don't let a metrics poll failure take down the app
      }
    }
  }, intervalMs).unref();
}
