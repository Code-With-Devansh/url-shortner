import redis from "../../config/redis.config.js";

export async function claimKey(key) {
  const processingKey = `processing:${key}`;
  const claimed = await redis.claimAnalyticsKey(
    key,
    processingKey,
    "analytics:active",
    "processing:active",
  );
  if (claimed === 0) {
    return null;
  }


  return processingKey;
}
