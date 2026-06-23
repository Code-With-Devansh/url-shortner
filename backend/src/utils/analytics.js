import { saveClickToRedis } from "../dao/clickBucket.redis.js";

const RETENTION_DAYS = 90; // 3 months

// export async function recordClick(urlId, ua, visitorHash, country, referer) {
//   const date = new Date().toISOString().split("T")[0];
//   const hour = new Date().getHours().toString().padStart(2, "0");
//   await saveClickToRedis(urlId, ua, visitorHash, country, referer, date, hour);
// }
