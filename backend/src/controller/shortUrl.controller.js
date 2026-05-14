import { deleteShortUrlDao, findShortUrl } from "../dao/shortUrl.js";
import { cacheUrl, deleteCachedUrl, getCachedUrl } from "../dao/url.redis.js";
import { createShortUrlwithoutUserService, createShortUrlWithUserService } from "../services/shortUrl.service.js";
import { NotFoundError } from "../utils/appError.js";
import tryCatch from "../utils/tryCatch.js";

export const createShortUrl = tryCatch(async (req, res, next)=>{
        const {url} = req.body;
        if(req.user){
                const id=await createShortUrlWithUserService(url, req.user._id, req.body.slug);
                res.status(200).json({ short_url: process.env.BASE_URL + id });
        }
        else{
                const id= await createShortUrlwithoutUserService(url);
                res.status(200).json({ short_url: process.env.BASE_URL + id });
        }
});


export const redirectFromShortUrl = tryCatch(async (req, res, next)=>{
        const {shortId} = req.params;
        const cached = await getCachedUrl(shortId)
        if(cached){
                res.redirect(cached)
        }else{
                const shortUrl = await findShortUrl(shortId);
                if(!shortUrl || !shortUrl.isactive){
                        throw new NotFoundError("Short URL not found");
                }
                cacheUrl(shortId, shortUrl.full_url)
                res.redirect(shortUrl.full_url);
        }
})

export const deleteShortUrl = tryCatch(async (req, res, next)=>{
        const {id} = req.params;
        const shortUrl = await deleteShortUrlDao(id, req.user._id);
        if(!shortUrl){
            throw new NotFoundError("Short URL not found or you don't have permission to delete it");
        }
        deleteCachedUrl(id)
        res.status(200).json({ message: "Short URL deleted successfully" });    
})