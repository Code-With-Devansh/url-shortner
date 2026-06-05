
import { toUrlListDTO } from "../dto/url.dto.js";
import { parseUrlQueryParams } from "../schema/urlQuery.validator.js";
import tryCatch from "../utils/tryCatch.js";
import { getUserUrls } from "../services/shortUrl.service.js";
export const getAllUserUrls = tryCatch(async (req, res) => {
  const { _id } = req.user;

  const params = parseUrlQueryParams(req.query);
 
  const { urls, hasMore, nextCursor } = await getUserUrls(_id, params);
  res.status(200).json(
    toUrlListDTO({
      urls,
      hasMore,
      nextCursor,
      meta: {
        limit: params.limit,
        sortBy: params.sortBy,
        order: params.order,
      },
    })
  );
}, "Get all user URLs");
 