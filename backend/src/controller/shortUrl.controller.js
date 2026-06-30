
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
import {
  addUrlToBloom,
  checkIfExistinBloom,
} from "../dao/redirectBloom.redis.js";
import { getCountry } from "../utils/geo.js";
import { withCache, withStampedeProtection } from "../utils/withCache.js";
import { urlCacheKey, URL_CACHE_TTL } from "../utils/cacheKeys.js";
import {
  toCreateShortUrlDTO,
  toDeleteShortUrlDTO,
} from "../dto/shortUrl.dto.js";
import { recordClick } from "../services/analytics.service.js";
import { ErrorCodes } from "../utils/errorCodes.js";
import logger from "../logger/index.js";
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
    res.status(200).json(toCreateShortUrlDTO(process.env.BASE_URL, id, url));
  } else {
    const id = await createShortUrlwithoutUserService(url);
    await addUrlToBloom(id);
    res.status(200).json(toCreateShortUrlDTO(process.env.BASE_URL, id, url));
  }
}, "Create Short url");

export const redirectFromShortUrl = tryCatch(async (req, res, next) => {
  const { shortId } = req.params;
  const mightExists = await checkIfExistinBloom(shortId);
  if (Number(mightExists) === 0) {
    throw new NotFoundError("Short URL not found", ErrorCodes.URL_NOT_FOUND);
  }
  // Reachable here despite the bloom check above in two cases: a bloom
  // false-positive (expected, rare, by design), or a slug that's in the
  // bloom filter but was later deactivated/deleted. withCache now caches
  // that `null` result too (negative caching), but with a short TTL of
  // its own — NOT the 24h URL_CACHE_TTL used for real hits — so a
  // recently-deactivated or not-yet-existing slug doesn't stay stuck
  // behind a stale "not found" for a full day.
   const NOT_FOUND_CACHE_TTL = 60;

  const shortUrlData = await withStampedeProtection(
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
    // Short lock-wait: this is the redirect hot path. If another replica
    // is already refilling this key, 150ms of polling is cheap insurance
    // against a duplicate Mongo query — but past that, just do the lookup
    // ourselves rather than make a visitor wait on it.
    { lockWaitMs: 150, negativeTtlSeconds: NOT_FOUND_CACHE_TTL },
  );

  if (!shortUrlData) {
    throw new NotFoundError("Short URL not found", ErrorCodes.URL_NOT_FOUND);
  }

  if (!isValidRedirectUrl(shortUrlData.full_url)) {
    throw new ValidationError(
      { full_url: "Invalid redirect URL" },
      ErrorCodes.URL_INVALID_TARGET,
    );
  }
  try {
    await recordClick(shortUrlData.id, 3, req);
  } catch {
    logger.warn("Failed to record click for short URL: " + shortId);
  }
  return res.send(
    buildRedirectPage(shortId, encodeURIComponent(shortUrlData.full_url)),
  );
}, "Redirect from short url");

export const deleteShortUrl = tryCatch(async (req, res, next) => {
  const { id } = req.params;
  const shortUrl = await deleteShortUrlDao(id, req.user._id);
  if (!shortUrl) {
    throw new NotFoundError(
      "Short URL not found or you don't have permission to delete it",
      ErrorCodes.URL_NOT_FOUND_OR_FORBIDDEN,
    );
  }
  await deleteCachedUrl(id);
  res.status(200).json(toDeleteShortUrlDTO());
}, "Delete short url");
