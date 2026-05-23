
import redis from '../config/redis.config.js'

const PREFIX = "clicks:";

export const incrementClicks = async(shortId)=>{
    console.log(PREFIX + shortId, "Incremented")
    await redis.incr(PREFIX + shortId);
}

export const getClickKeys = async()=>{
    return await redis.keys(PREFIX + "*")
}

export const getKeyAndDel = async(key)=>{
    return await redis.GETDEL(key);
}