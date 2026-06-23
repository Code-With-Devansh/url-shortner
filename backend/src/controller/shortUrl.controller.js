import { deleteShortUrlDao, findShortUrlbySlug } from "../dao/shortUrl.js";
import { cacheUrl, deleteCachedUrl } from "../dao/url.redis.js";
import urlSchema from "../schema/url.schema.js";
import { UAParser } from "ua-parser-js";
import {
  createShortUrlwithoutUserService,
  createShortUrlWithUserService,
} from "../services/shortUrl.service.js";
import { NotFoundError, ValidationError } from "../utils/appError.js";
import {
  generateValidationErrors,
  isValidRedirectUrl,
} from "../utils/helper.js";
import { buildRedirectPage } from "../utils/redirectPage.js";
import tryCatch from "../utils/tryCatch.js";
import { incrementClicks } from "../dao/clicks.redis.js";
import {
  addUrlToBloom,
  checkIfExistinBloom,
} from "../dao/redirectBloom.redis.js";
// import { recordClick } from "../utils/analytics.js";
import { getCountry } from "../utils/geo.js";
import crypto from "crypto";
import { withCache } from "../utils/withCache.js";
import { urlCacheKey, URL_CACHE_TTL } from "../utils/cacheKeys.js";
import { toCreateShortUrlDTO, toDeleteShortUrlDTO } from "../dto/shortUrl.dto.js";
import { recordClick } from "../services/analytics.service.js";
export const createShortUrl = tryCatch(async (req, res, next) => {
  const { url } = req.body;
  const validated = urlSchema
    .pick({ full_url: true })
    .safeParse({ full_url: url });
  if (!validated.success) {
    throw new ValidationError(generateValidationErrors(validated));
  }
  if (req.user) {
    const slug = req.body.slug;
    if (slug && slug.length > 0) {
      const validated = urlSchema
        .pick({ short_url: true })
        .safeParse({ short_url: slug });
      if (!validated.success) {
        throw new ValidationError(generateValidationErrors(validated));
      }
    }
    const id = await createShortUrlWithUserService(url, req.user._id, slug);
    await addUrlToBloom(id);
    res.status(200).json(toCreateShortUrlDTO(process.env.BASE_URL, id));
  } else {
    const id = await createShortUrlwithoutUserService(url);
    await addUrlToBloom(id);
    res.status(200).json(toCreateShortUrlDTO(process.env.BASE_URL, id));
  }
}, "Create Short url");

export const redirectFromShortUrl = tryCatch(async (req, res, next) => {
  const { shortId } = req.params;
  const mightExists = await checkIfExistinBloom(shortId);
  if (Number(mightExists) === 0) {
    throw new NotFoundError("Short URL not found");
  }

  const shortUrlData = await withCache(
    urlCacheKey(shortId),
    URL_CACHE_TTL,
    async () => {
      const shortUrl = await findShortUrlbySlug(shortId);
      if (!shortUrl || !shortUrl.isActive) {
        return null;
      }
      return {
        id: shortUrl._id,
        full_url: shortUrl.full_url,
        isActive: shortUrl.isActive,
      };
    },
  );

  if (!shortUrlData) {
    throw new NotFoundError("Short URL not found");
  }

  if (!isValidRedirectUrl(shortUrlData.full_url)) {
    throw new ValidationError("Invalid redirect URL");
  }
  await recordClick(shortUrlData.id, 3, req)
  return res.send(buildRedirectPage(shortId, encodeURIComponent(shortUrlData.full_url)));
}, "Redirect from short url");

export const deleteShortUrl = tryCatch(async (req, res, next) => {
  const { id } = req.params;
  const shortUrl = await deleteShortUrlDao(id, req.user._id);
  if (!shortUrl) {
    throw new NotFoundError(
      "Short URL not found or you don't have permission to delete it",
    );
  }
  await deleteCachedUrl(id);
  res.status(200).json(toDeleteShortUrlDTO());
}, "Delete short url");

