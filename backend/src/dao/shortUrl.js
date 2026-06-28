import { ShortUrlSchema } from "../models/shortUrl.model.js";
import { conflictError } from "../utils/appError.js";
import { ErrorCodes } from "../utils/errorCodes.js";

export const saveShortUrl = async (url, id, userId) => {
  try {
    const newShortUrl = new ShortUrlSchema({
      full_url: url,
      short_url: id,
    });
    if (userId) {
      newShortUrl.user = userId;
    }
    return await newShortUrl.save();
  } catch (err) {
    if (err.code === 11000) {
      throw new conflictError("duplicate Short Url", ErrorCodes.URL_SLUG_TAKEN);
    } else {
      throw err;
    }
  }
};

export const findShortUrl = async (id) => {
  const shortUrl = await ShortUrlSchema.findOne({ _id: id });
  return shortUrl;
};

export const findShortUrlbySlug = async (slug) => {
  const shortUrl = await ShortUrlSchema.findOne({ short_url: slug });
  return shortUrl;
};

export const deleteShortUrlDao = async (id, userId) => {
  const shortUrl = await ShortUrlSchema.findOneAndDelete({
    _id: id,
    user: userId,
  });
  return shortUrl;
};


export const queryShortUrls = ({ filter, sort, limit }) => {
    return ShortUrlSchema.find(filter)
        .sort(sort)
        .limit(limit);
};

export const findShortUrlByIdForUser = async (id, userId) => {
  return ShortUrlSchema.findOne({ _id: id, user: userId }).lean();
};
 

export const searchShortUrls = (pipeline) =>
    ShortUrlSchema.aggregate(pipeline);