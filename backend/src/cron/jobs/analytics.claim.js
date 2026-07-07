import redis from "../../config/redis.config.js";
import { ANALYTICS_DUE_ZSET, activeSetKeyForUrl } from "../../cache/clickBucket.redis.js";

export async function claimKey(key) {
  const processingKey = `processing:${key}`;
  // key shape: analytics:<urlId>:<date>:<HH:MM>
  const urlId = key.split(":")[1];

  const claimed = await redis.claimAnalyticsKey(
    key,
    processingKey,
    ANALYTICS_DUE_ZSET,
    "processing:active",
    activeSetKeyForUrl(urlId),
  );
  if (claimed === 0) {
    return null;
  }


  return processingKey;
}