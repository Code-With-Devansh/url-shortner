import { ShortUrlSchema } from "../../models/shortUrl.model.js";
import redis from '../../config/redis.config.js'
export async function flushClicksToDB() {
  const clicks = await redis.hGetAll("clicks");

  if (!Object.keys(clicks).length) {
    return;
  }

  await redis.del("clicks");

  const operations = [];

  for (const [urlId, count] of Object.entries(clicks)) {
    operations.push({
      updateOne: {
        filter: {
          _id: urlId,
        },
        update: {
          $inc: {
            clicks: Number(count),
          },
        },
      },
    });
  }

  await ShortUrlSchema.bulkWrite(operations);
}