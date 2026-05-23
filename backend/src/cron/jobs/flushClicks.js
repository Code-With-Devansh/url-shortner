import { getClickKeys, getKeyAndDel } from "../../dao/clicks.redis.js";
import { incrementClicks } from "../../dao/shortUrl.js";

export async function flushClicksToDB() {
  const keys = await getClickKeys();
  
  await Promise.all(keys.map(async (key) => {
    const shortId = key.split(':')[1];
    const count = await getKeyAndDel(key);
    if (count > 0) {
      await incrementClicks(shortId, count);
    }
  }));
}