import redis from "../config/redis.config.js";

export const reserveBloom = async () => {
  try {
    await redis.call("BF.RESERVE", "urls:bloom", "0.01", "1000000");
  } catch (err) {
    // already exists
  }
};

export const addUrlToBloom = async (shortUrl) => {
  return await redis.call("BF.ADD", "urls:bloom", shortUrl);
};

export const checkIfExistinBloom = async (shortUrl) => {
  return await redis.call("BF.EXISTS", "urls:bloom", shortUrl);
};
