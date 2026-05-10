import { findUserById } from "../dao/user.dao.js";
import { verifyToken } from "../utils/helper.js";

export const attachUser = async(req, res, next) => {
    const token = req.cookies.accessToken;
    if(!token){
        return next();
    }
    try{
        const decoded = await verifyToken(token);
        const user = await findUserById(decoded.userId);
        if (!user) {
            return next();
        }
        req.user = user;
        next();
    }catch(err){
        next(err);
    }
}