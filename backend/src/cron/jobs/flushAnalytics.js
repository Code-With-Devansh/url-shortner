import { claimKey } from "./analytics.claim.js";
import { flushClaimedKey } from "./flushClaimedKey.js";
import { isBucketDueForFlush } from "../../cache/clickBucket.redis.js";

export async function flushAnalyticsKey(key) {
  const [, , date, hh, mm] = key.split(":");
  const minute = `${hh}:${mm}`;
  if (!isBucketDueForFlush(date, minute)) return null;

  const processingKey = await claimKey(key);
  if (!processingKey) return null;

  return flushClaimedKey(processingKey);
}