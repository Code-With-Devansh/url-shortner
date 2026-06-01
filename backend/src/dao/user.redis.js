
import redis from '../config/redis.config.js'

const PREFIX = "refresh:";

export const cacheRefreshToken = async(userid, refreshToken)=>{
    return await redis.set(PREFIX + userid, refreshToken, {
        EX:60*60*24*20
    })
}

export const getCachedRefreshToken = async(id)=>{
    return await redis.get(PREFIX + id);
}

export const delCachedRefreshToken = async(id)=>{
    return await redis.del(PREFIX + id);
}