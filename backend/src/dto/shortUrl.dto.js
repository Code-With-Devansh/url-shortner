export const toCreateShortUrlDTO = (baseUrl, shortId, url) => ({
  success:true,
  data:{
    short_id: shortId,
    short_url: baseUrl + shortId,
    full_url: url
  }
});

export const toDeleteShortUrlDTO = () => ({
  success: true,
  message: "Short URL deleted successfully",
});
