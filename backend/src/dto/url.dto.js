import config from "../config/index.js";

export const toUrlDTO = (doc) => ({
  id: doc._id.toString(),
  full_url: doc.full_url,
  shortCode: doc.short_url,
  short_url: `${config.app.baseUrl}${doc.short_url}`,
  clicks: doc.clicks,
  isActive: doc.isActive,
  createdAt: doc.createdAt.toISOString(),
});

export const toUrlListDTO = ({ urls, hasMore, nextCursor, meta }) => ({
  success: true,
  data: urls.map(toUrlDTO),
  pagination: {
    hasMore,
    nextCursor: hasMore ? nextCursor : null,
    limit: meta.limit,
    sortBy: meta.sortBy,
    order: meta.order,
  },
});