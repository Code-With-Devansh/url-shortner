import {
  findShortUrl,
  findShortUrlbySlug,
  queryShortUrls,
  saveShortUrl,
  searchShortUrls,
} from "../dao/shortUrl.js";
import { ShortUrlSchema } from "../models/shortUrl.model.js";
import { generateShortUrl } from "../utils/helper.js";
import { AppError, conflictError } from "../utils/appError.js";
import { cacheUrl } from "../cache/url.redis.js";
import { encodeCursor } from "../schema/urlQuery.validator.js";
import { ErrorCodes } from "../utils/errorCodes.js";
import mongoose from "mongoose";
import config from "../config/index.js";

const USE_ATLAS_SEARCH = config.useAtlasSearch === "true";
const APP_DOMAIN = new URL(config.app.baseUrl).host;

const prepareSearchQuery = (rawQuery, domain) => {
  const pattern = new RegExp(
    `https?:\\/\\/(www\\.)?${domain.replace(/\./g, "\\.")}\\/?`,
    "i",
  );
  const stripped = rawQuery.replace(pattern, "").trim();
  return stripped.length > 0 ? stripped : rawQuery;
};


export const createShortUrlwithoutUserService = async (url) => {
  const id = await generateShortUrl();
  if (!id) {
    throw new Error("Failed to generate short URL", 500);
  }
  const shortUrl = await saveShortUrl(url, id);
  await cacheUrl(id, { id: shortUrl._id, full_url: url, isActive: true });
  return id;
};
export const createShortUrlWithUserService = async (
  url,
  userId,
  slug = null,
) => {
  const id = slug && slug.length > 0 ? slug : await generateShortUrl();
  const exists = await findShortUrlbySlug(id);
  if (exists) {
    throw new conflictError(
      "Custom short URL already exists",
      ErrorCodes.URL_SLUG_TAKEN,
    );
  }
  const shortUrl = await saveShortUrl(url, id, userId);
  await cacheUrl(id, { id: shortUrl._id, full_url: url, isActive: true });
  return id;
};

const buildFilter = ({ userId, search, isActive, cursor, sortBy, order }) => {
  const filter = { user: userId };

  if (isActive !== undefined) {
    filter.isActive = isActive;
  }

  // Only use $text locally
  if (search && !USE_ATLAS_SEARCH) {
    filter.$text = { $search: search };
  }

  if (cursor) {
    const gtOrLt = order === "desc" ? "$lt" : "$gt";

    if (sortBy === "createdAt") {
      filter._id = {
        [gtOrLt]: new mongoose.Types.ObjectId(cursor.id),
      };
    } else {
      filter.$or = [
        {
          [sortBy]: {
            [gtOrLt]: cursor.value,
          },
        },
        {
          [sortBy]: cursor.value,
          _id: {
            [gtOrLt]: new mongoose.Types.ObjectId(cursor.id),
          },
        },
      ];
    }
  }

  return filter;
};

const buildSearchPipeline = ({
  userId,
  search,
  isActive,
  cursor,
  sortBy,
  order,
  limit,
}) => {
  const dir = order === "desc" ? -1 : 1;

  const filter = [
    {
      equals: {
        path: "user",
        value: new mongoose.Types.ObjectId(userId),
      },
    },
  ];

  if (isActive !== undefined) {
    filter.push({
      equals: {
        path: "isActive",
        value: isActive,
      },
    });
  }

  return [
    {
      $search: {
        index: "search_index",
        compound: {
          must: [
            {
              autocomplete: {
                query: search,
                path: "full_url",
                tokenOrder: "any",
              },
            },
          ],
          should: [
            {
              autocomplete: {
                query: search,
                path: "short_url",
                tokenOrder: "any",
                score: { boost: { value: 2 } },
              },
            },
          ],
          filter,
        },
      },
    },

    {
      $sort: {
        [sortBy]: dir,
        _id: dir,
      },
    },

    ...(cursor
      ? [
          {
            $match:
              sortBy === "createdAt"
                ? {
                    _id: {
                      [order === "desc" ? "$lt" : "$gt"]:
                        new mongoose.Types.ObjectId(cursor.id),
                    },
                  }
                : {
                    $or: [
                      {
                        [sortBy]: {
                          [order === "desc" ? "$lt" : "$gt"]: cursor.value,
                        },
                      },
                      {
                        [sortBy]: cursor.value,
                        _id: {
                          [order === "desc" ? "$lt" : "$gt"]:
                            new mongoose.Types.ObjectId(cursor.id),
                        },
                      },
                    ],
                  },
          },
        ]
      : []),

    {
      $limit: limit + 1,
    },
  ];
};

const buildSort = ({ sortBy, order }) => {
  const dir = order === "desc" ? -1 : 1;

  return {
    [sortBy]: dir,
    _id: dir,
  };
};

export const getUserUrls = async (userId, params) => {
  const { limit, sortBy, order, cursor, isActive } = params;
  const search = params.search
    ? prepareSearchQuery(params.search, APP_DOMAIN)
    : params.search;
  let docs;

  if (search && USE_ATLAS_SEARCH) {
    const pipeline = buildSearchPipeline({
      userId,
      search,
      isActive,
      cursor,
      sortBy,
      order,
      limit,
    });

    docs = await searchShortUrls(pipeline);
  } else {
    const filter = buildFilter({
      userId,
      search,
      isActive,
      cursor,
      sortBy,
      order,
    });

    const sort = buildSort({
      sortBy,
      order,
    });

    docs = await queryShortUrls({
      filter,
      sort,
      limit: limit + 1,
    });
  }

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

  return {
    urls,
    hasMore,
    nextCursor,
  };
};
