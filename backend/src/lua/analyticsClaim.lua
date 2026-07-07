-- KEYS[1] = analytics:key                 (the raw minute-bucket hash key)
-- KEYS[2] = processing:key                (renamed target)
-- KEYS[3] = analytics:due                 (global due-time ZSET)
-- KEYS[4] = processing:active             (ZSET, in-flight bookkeeping)
-- KEYS[5] = analytics:active:<urlId>       (per-URL active-bucket SET)
--


local now = redis.call("TIME")
local millis = now[1] * 1000 + math.floor(now[2] / 1000)
local ok = pcall(redis.call, "RENAME", KEYS[1], KEYS[2])
if not ok then
    return 0
end
redis.call("ZREM", KEYS[3], KEYS[1])
redis.call("SREM", KEYS[5], KEYS[1])
redis.call("ZADD", KEYS[4], millis, KEYS[2])

return 1