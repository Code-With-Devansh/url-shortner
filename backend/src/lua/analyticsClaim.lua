-- KEYS[1] = analytics:key
-- KEYS[2] = processing:key
-- KEYS[3] = analytics:active
-- KEYS[4] = processing:active
--


local now = redis.call("TIME")
local millis = now[1] * 1000 + math.floor(now[2] / 1000)
local ok = pcall(redis.call, "RENAME", KEYS[1], KEYS[2])
if not ok then
    return 0
end
redis.call("SREM", KEYS[3], KEYS[1])
redis.call("ZADD", KEYS[4], millis, KEYS[2])

return 1