import { findShortUrl, findShortUrlbySlug, queryShortUrls, saveShortUrl } from "../dao/shortUrl.js";
import { ShortUrlSchema } from "../models/shortUrl.model.js";
import { generateShortUrl } from "../utils/helper.js";
import { AppError, conflictError } from "../utils/appError.js";
import { cacheUrl } from "../dao/url.redis.js";
import { encodeCursor } from "../schema/urlQuery.validator.js";


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
  const id = (slug && slug.length>0) ? slug : generateShortUrl(7);
  const exists = await findShortUrlbySlug(id);
  if(exists){
    throw new conflictError("Custom short URL already exists");
  }
  await cacheUrl(id, url)
  await saveShortUrl(url, id, userId);
  return id;
};

const buildFilter = ({ userId, search, isActive, expiryFilter, cursor, sortBy, order }) => {
  const filter = { user: userId };
 
  // ── isActive ──
  if (isActive !== undefined) {
    filter.isActive = isActive;
  }
  // ── text search ──
  // NOTE: When $text is present, MongoDB cannot use the compound { user, createdAt }
  // index simultaneously. For high-traffic apps consider Atlas Search instead.
  if (search) {
    filter.$text = { $search: search };
  }
 
  // ── cursor (keyset pagination) ──
  // We fetch `limit + 1` docs and use the extra to determine `hasMore`.
  // The cursor encodes the last doc's { id, value } so we can do:
  //   WHERE (sortField, _id) < (cursorValue, cursorId)   ← for desc
  //   WHERE (sortField, _id) > (cursorValue, cursorId)   ← for asc
  //
  // This is a compound keyset — using _id as a tiebreaker ensures stable
  // pagination even when multiple docs share the same sortBy value.
  if (cursor) {
    const gtOrLt = order === "desc" ? "$lt" : "$gt";
 
    if (sortBy === "createdAt") {
      // createdAt is colocated with _id order, so a simple _id cursor is enough
      filter._id = { [gtOrLt]: cursor.id };
    } else {
      // For clicks  we need a compound keyset:
      // either the sort value is strictly less/greater, OR
      // it's equal and we break the tie with _id
      filter.$or = [
        { [sortBy]: { [gtOrLt]: cursor.value } },
        { [sortBy]: cursor.value, _id: { [gtOrLt]: cursor.id } },
      ];
    }
  }
 
  return filter;
};
 


const buildSort = ({ sortBy, order, search }) => {
  const dir = order === "desc" ? -1 : 1;
 
  // When $text search is active, include textScore so most-relevant results
  // surface first. sortBy is still applied as secondary sort.
  if (search) {
    return { score: { $meta: "textScore" }, [sortBy]: dir, _id: dir };
  }
 
  // Always include _id as a tiebreaker — required for stable cursor pagination
  return { [sortBy]: dir, _id: dir };
};
 

export const getUserUrls = async (userId, params) => {
  const { limit, sortBy, order, cursor, search, isActive, expiryFilter } = params;
 
  const filter = buildFilter({ userId, search, isActive, expiryFilter, cursor, sortBy, order });
  const sort = buildSort({ sortBy, order, search });
  let query = {filter, sort, limit: limit+1}
 
  const docs = await queryShortUrls(query, search);
 
  const hasMore = docs.length > limit;
  const urls = hasMore ? docs.slice(0, limit) : docs;
 
  let nextCursor = null;
  if (hasMore) {
    const last = urls[urls.length - 1];
    nextCursor = encodeCursor({
      id: last._id.toString(),
      value: last[sortBy], 
    });
  }
 
  return { urls, hasMore, nextCursor };
};