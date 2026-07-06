import config from "../config/index.js";

export const toAnalyticsResponseDTO = (data) => ({
  success: true,
  data,
});
export const toUrlSummary = (data) => ({
  success: true,
  data: {
    ...data,
    ...(data.shortUrl && {
      shortUrl: config.app.baseUrl + data.shortUrl,
    }),
  },
});

export const toOverallSummaryDTO = (data) => ({
  success: true,
  data: {
    ...data,
    ...(data.topUrl && {
      topUrl: config.app.baseUrl + data.topUrl.shortUrl,
    }),
  },
});

export const overallLeaderboardDTO = (data) => ({
  success: true,
  data: (data ?? []).map((e) => ({
    ...e,
    shortUrl: config.app.baseUrl + e.shortUrl,
  })),
});
