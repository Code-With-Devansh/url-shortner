 import { getUserUrls } from "../dao/shortUrl.js";
import tryCatch from "../utils/tryCatch.js";
 
 export const getAllUserUrls = tryCatch( async (req, res, next) => {
    const {_id} = req.user;
    const urls =  await getUserUrls(_id)
    res.status(200).json({urls, success: true, message: "User URLs retrieved successfully"});
 })

 