export const toCreateShortUrlDTO = (baseUrl, shortId) => ({
  short_url: baseUrl + shortId,
});

export const toDeleteShortUrlDTO = () => ({
  success: true,
  message: "Short URL deleted successfully",
});
