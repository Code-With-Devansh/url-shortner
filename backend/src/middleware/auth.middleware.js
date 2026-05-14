import { findUserById } from "../dao/user.dao.js";
import { checkIfRefreshTokenExists } from "../services/auth.service.js";
import { UnauthorizedError } from "../utils/appError.js";
import { generateAccessToken, verifyRefreshToken, verifyToken } from "../utils/helper.js";

export const authMiddleware = async (req, res, next) => {
    const accessToken = req.cookies.accessToken;
    const refreshToken = req.cookies.refreshToken;
    if (!accessToken || !refreshToken) {
        throw new UnauthorizedError("No token provided");
    }
    try{
        if(accessToken){
            const decoded = await verifyToken(accessToken);
            const user = await findUserById(decoded.userId);
            if (!user) {
                throw new UnauthorizedError("User not found");
            }
            req.user = user;
            next();
        }else{
            const data = verifyRefreshToken(refreshToken);
            const userId = data.userId;
            const stored = checkIfRefreshTokenExists(userId, refreshToken);
            const newAccessToken = generateAccessToken();
            res.cookie('accessToken', newAccessToken, AccessTokenCookieOptions);
            next();
        }
    }catch(err){
        next(err);
    }
}