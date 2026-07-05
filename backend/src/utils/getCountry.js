import { getGeoReader } from "../config/geoip.config.js";
import { isIP } from "net";

const isPrivateOrLocal = (ip) => {
  if (!ip) return true;
  if (ip === "127.0.0.1" || ip === "::1") return true;
  if (ip.startsWith("10.") || ip.startsWith("192.168.")) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)) return true;
  return false;
};

export const getCountry = async (rawIp) => {
  try {
    if (!rawIp || !isIP(rawIp)) return "XX";
    if (isPrivateOrLocal(rawIp)) return "XX"; // dev/local traffic

    const reader = await getGeoReader();
    const result = reader.country(rawIp);
    return result?.country?.isoCode || "XX";
  } catch (err) {
    return "XX";
  }
};