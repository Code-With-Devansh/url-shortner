import { deleteShortUrlDao, findShortUrl } from "../dao/shortUrl.js";
import { cacheUrl, deleteCachedUrl, getCachedUrl } from "../dao/url.redis.js";
import urlSchema from "../schema/url.schema.js";
import {
  createShortUrlwithoutUserService,
  createShortUrlWithUserService,
} from "../services/shortUrl.service.js";
import { NotFoundError, ValidationError } from "../utils/appError.js";
import { generateValidationErrors } from "../utils/helper.js";
import { buildRedirectPage } from "../utils/redirectPage.js";
import tryCatch from "../utils/tryCatch.js";
import { incrementClicks } from "../dao/clicks.redis.js";

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
    const validated = urlSchema
      .pick({ short_url: true })
      .safeParse({ short_url: slug });
    const id = await createShortUrlWithUserService(url, req.user._id, slug);
    res.status(200).json({ short_url: process.env.BASE_URL + id });
  } else {
    const id = await createShortUrlwithoutUserService(url);
    res.status(200).json({ short_url: process.env.BASE_URL + id });
  }
}, "Create Short url");

export const redirectFromShortUrl = tryCatch(async (req, res, next) => {
  const { shortId } = req.params;
  const cached = await getCachedUrl(shortId);
  let fullUrl = cached;

  if (!cached) {
    const shortUrl = await findShortUrl(shortId);
    if (!shortUrl || !shortUrl.isactive) {
      throw new NotFoundError("Short URL not found");
    }
    fullUrl = shortUrl.full_url;
    cacheUrl(shortId, fullUrl);
  }
  return res.send(buildRedirectPage(shortId, fullUrl));
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
  await incrementClicks(shortId);
  res.sendStatus(204);
}, "Track click");
