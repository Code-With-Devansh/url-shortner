import { UAParser } from "ua-parser-js";
import crypto from 'crypto'
import {saveClickToRedis} from "../../cache/clickBucket.redis.js"
import { incrementClickCountToRedis } from "../../cache/clicks.redis.js";
export const processClick = async(data) => {
  const { urlId, ip, userAgent, referer, timestamp } = data;
  const ua = new UAParser(userAgent).getResult();
  // const country = getCountry(ip);
  const country = "IN";
  const visitorHash = crypto
    .createHash("sha256")
    .update(`${ip}:${userAgent}`)
    .digest("hex");
    const dateObj = new Date(timestamp);
    const date = dateObj.toISOString().split("T")[0];
    const hour = dateObj.getHours().toString().padStart(2, "0");
    await saveClickToRedis(urlId, ua, visitorHash, country, referer, date, hour);
    await incrementClickCountToRedis(urlId);
};
