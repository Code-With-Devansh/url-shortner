import { success } from "zod";
import config from "../config/index.js";

export const toAnalyticsResponseDTO = (data) => ({
  success: true,
  data,
});
export const toUrlSummary = (data) => ({
  success: true,
  data: {
    ...data,
    shortUrl: config.app.baseUrl + data.shortUrl,
  },
});

export const toOverallSummaryDTO = (data) => ({
  success: true,
  data: {
    ...data,
    topUrl:{
      shortUrl: config.app.baseUrl + data.topUrl.shortUrl
    }
  },
});

export const overallLeaderboardDTO = (data)=>({
  success:true,
  data:data.map((e)=>{return {...e, shortUrl:config.app.baseUrl + e.shortUrl}})
})