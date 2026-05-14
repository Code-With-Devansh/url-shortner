
import redis from '../config/redis.config.js'

const PREFIX = "refresh:";

export const cacheRefreshToken = async(refreshToken, userid)=>{
    await redis.set(PREFIX + userid, refreshToken, {
        EX:60*60*24*20
    })
}

export const getCachedRefreshToken = async(id)=>{
    await redis.get(PREFIX + id);
}

export const delCachedRefreshToken = async(id)=>{
    await redis.del(PREFIX + id);
}