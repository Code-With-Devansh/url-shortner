import { ShortUrlSchema } from "../models/shortUrl.model.js";
import { conflictError } from "../utils/appError.js";

export const saveShortUrl = async (url, id, userId) => {
  try {
    const newShortUrl = new ShortUrlSchema({
      full_url: url,
      short_url: id,
    });
    if (userId) {
      newShortUrl.user = userId;
    }
    await newShortUrl.save();
  } catch (err) {
    if (err.code === 11000) {
      throw new conflictError("duplicate Short Url");
    } else {
      throw err;
    }
  }
};

export const findShortUrl = async (shortId) => {
  const shortUrl = await ShortUrlSchema.findOne({ short_url: shortId });
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


export const queryShortUrls = async (query, search) => {
  const {filter, sort, limit} = query;
  let mongooseQuery = ShortUrlSchema.find(filter).sort(sort).limit(limit).lean();
  if (search) {
    mongooseQuery = mongooseQuery.select({ score: { $meta: "textScore" } });
  }
  return await mongooseQuery;
}

export const findShortUrlByIdForUser = async (id, userId) => {
  return ShortUrlSchema.findOne({ _id: id, user: userId }).lean();
};
 