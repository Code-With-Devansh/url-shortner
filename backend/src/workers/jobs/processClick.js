import { UAParser } from "ua-parser-js";
import crypto from "crypto";
import { saveClickToRedis, minuteOf } from "../../cache/clickBucket.redis.js";
import { getCountry } from "../../utils/getCountry.js";
export const processClick = async (data) => {
  const { urlId, ip, userAgent, referer, timestamp } = data;
  const ua = new UAParser(userAgent).getResult();
  const country = await getCountry(ip);
  const visitorHash = crypto
    .createHash("sha256")
    .update(`${ip}:${userAgent}`)
    .digest("hex");
  await saveClickToRedis(
    urlId,
    ua,
    visitorHash,
    country,
    referer,
    timestamp
  );
};
