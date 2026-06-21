import { deleteShortUrlDao, findShortUrl, findShortUrlbySlug } from "../dao/shortUrl.js";
import { cacheUrl, deleteCachedUrl, getCachedUrl } from "../dao/url.redis.js";
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
import { recordClick } from "../utils/analytics.js";
import { getCountry } from "../utils/geo.js";
import crypto from "crypto";
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
    res.status(200).json({ short_url: process.env.BASE_URL + id });
  } else {
    const id = await createShortUrlwithoutUserService(url);
    await addUrlToBloom(id);
    res.status(200).json({ short_url: process.env.BASE_URL + id });
  }
}, "Create Short url");

export const redirectFromShortUrl = tryCatch(async (req, res, next) => {
  const { shortId } = req.params;
  const mightExists = await checkIfExistinBloom(shortId);
  if (Number(mightExists) === 0) {
    throw new NotFoundError("Short URL not found");
  }
  const cached = await getCachedUrl(shortId);
  let fullUrl = cached;

  if (!cached) {
    const shortUrl = await findShortUrl(shortId);
    if (!shortUrl || !shortUrl.isActive) {
      throw new NotFoundError("Short URL not found");
    }
    fullUrl = shortUrl.full_url;
    cacheUrl(shortId, fullUrl);
  }
  if (!isValidRedirectUrl(fullUrl)) {
    throw new ValidationError("Invalid redirect URL");
  }
  return res.send(buildRedirectPage(shortId, encodeURIComponent(fullUrl)));
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
  res.status(200).json({ message: "Short URL deleted successfully" });
}, "Delete short url");

export const trackClick = tryCatch(async (req, res) => {
  const { shortId } = req.params;
  const shortUrl = await findShortUrlbySlug(shortId);
  const ua = new UAParser(req.headers["user-agent"]).getResult();
  const ip = req.ip || req.headers["x-forwarded-for"]?.split(",")[0];
  // const country = getCountry(ip);
  const country = "IN";
  let referer = "direct";
  try {
    if (req.headers.referer) {
      referer = new URL(req.headers.referer).hostname;
    }
  } catch {}
  const visitorHash = crypto
    .createHash("sha256")
    .update(`${ip}:${req.headers["user-agent"]}`)
    .digest("hex");
  // await incrementClicks(shortId);
  await recordClick(shortUrl._id.toString(), ua, visitorHash, country, referer);
  res.sendStatus(204);
}, "Track click");
