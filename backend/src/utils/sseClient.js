import redis from "../config/redis.config.js";
import logger from "../logger/index.js";

const clients = new Map(); 

const CHANNEL = "sse:notify";
const subscriber = redis.duplicate();

subscriber.on("error", (err) =>
  logger.error({ err }, "[sse] subscriber connection error"),
);

subscriber.subscribe(CHANNEL, (err) => {
  if (err) {
    logger.error({ err }, "[sse] failed to subscribe to notify channel");
  } else {
    logger.info({ channel: CHANNEL }, "[sse] subscribed to notify channel");
  }
});

subscriber.on("message", (channel, raw) => {
  if (channel !== CHANNEL) return;

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch (err) {
    logger.error({ err }, "[sse] failed to parse pub/sub message");
    return;
  }

  const { userId, event, data } = payload;
  const res = clients.get(userId);
  // normal case, not an error: this message is for a user whose SSE
  // connection (if any) is held by a DIFFERENT process, not this one.
  // Every process subscribes to the same channel and gets every message,
  // so most processes will see most messages and just have nothing to
  // do with them - that's expected, not a bug.
  if (!res) return;

  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
   if (event === "verified") {
    clients.delete(userId);
    res.end();
  }
});


export const addClient = (userId, res) => clients.set(userId, res);
export const removeClient = (userId) => clients.delete(userId);

export const notifyClient = async (userId, event, data) => {
  try {
    await redis.publish(CHANNEL, JSON.stringify({ userId, event, data }));
  } catch (err) {
    logger.error({ err, userId, event }, "[sse] failed to publish notify event");
  }
};