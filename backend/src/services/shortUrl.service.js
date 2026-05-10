import { findShortUrl, findShortUrlbySlug, saveShortUrl } from "../dao/shortUrl.js";
import { ShortUrlSchema } from "../models/shortUrl.model.js";
import { generateShortUrl } from "../utils/helper.js";
import { AppError, conflictError } from "../utils/appError.js";
import { cacheUrl } from "../dao/url.redis.js";


export const createShortUrlwithoutUserService = async(url) => {
    const id = generateShortUrl(7);
    if(!id){
      throw new Error("Failed to generate short URL", 500); 
    }
    cacheUrl(id, url)
    await saveShortUrl(url,id);
    return id;
};
export const createShortUrlWithUserService = async (url, userId, slug = null) => {
  const id = slug ? slug : generateShortUrl(7);
  const exists = await findShortUrlbySlug(id);
  if(exists){
    throw new conflictError("Custom short URL already exists");
  }
  cacheUrl(id, url)
  await saveShortUrl(url, id, userId);
  return id;
};
