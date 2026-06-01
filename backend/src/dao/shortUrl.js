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
  if (shortUrl) {
    shortUrl.clicks += 1;
    await shortUrl.save();
  }
  return shortUrl;
};

export const findShortUrlbySlug = async (slug) => {
  const shortUrl = await ShortUrlSchema.findOne({ short_url: slug });
  return shortUrl;
};

export const getUserUrls = async (userId) => {
  const urls = await ShortUrlSchema.find({ user: userId });
  return urls;
};

export const deleteShortUrlDao = async (id, userId) => {
  const shortUrl = await ShortUrlSchema.findOneAndDelete({
    _id: id,
    user: userId,
  });
  return shortUrl;
};
