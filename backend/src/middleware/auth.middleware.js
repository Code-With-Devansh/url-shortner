import { findUserById } from "../dao/user.dao.js";
import { UnauthorizedError } from "../utils/appError.js";
import { verifyToken } from "../utils/helper.js";

export const authMiddleware = async (req, res, next) => {
    const token = req.cookies.accessToken;
    if (!token) {
        throw new UnauthorizedError("No token provided");
    }
    try{
        const decoded = await verifyToken(token);
        const user = await findUserById(decoded.userId);
        if (!user) {
            throw new UnauthorizedError("User not found");
        }
        req.user = user;
        next();
    }catch(err){
        next(err);
    }
}