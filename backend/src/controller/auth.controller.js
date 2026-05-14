import { AccessTokenCookieOptions, refreshTokenCookieOptions } from "../config/config.js";
import { saveRefreshToken } from "../dao/user.dao.js";
import { cacheRefreshToken } from "../dao/user.redis.js";
import { checkIfRefreshTokenExists, loginUser, registerUser } from "../services/auth.service.js";
import { sendEmailVerificationMail } from "../services/resend.service.js";
import { generateAccessToken, generateRefreshToken, verifyRefreshToken, verifyToken } from "../utils/helper.js";
import tryCatch from "../utils/tryCatch.js"

export const register_user = tryCatch( async (req, res, next) => {
    const {name, email, password} = req.body;
    const {accessToken, refreshToken, user} = await registerUser(name, email, password);
    
    res.cookie("accessToken", accessToken, AccessTokenCookieOptions);
    res.cookie("refreshToken", refreshToken, refreshTokenCookieOptions);
    res.status(201).json({success: true, data: user, message: "User registered successfully"});
})

export const login_user = tryCatch( async (req, res, next) => {
    const {email, password} = req.body;
    const {accessToken, refreshToken, user} = await loginUser(email, password);
    res.cookie("accessToken", accessToken, AccessTokenCookieOptions);
    res.cookie("refreshToken", refreshToken, refreshTokenCookieOptions)
    res.status(200).json({success: true, data: user, message: "User logged in successfully"});
    
} )

export const get_current_user = tryCatch( async (req, res, next) => {
    res.status(200).json({success: true, data: req.user, message: "Current user fetched successfully"});
} )

export const refreshAccessToken = tryCatch(async(req,res, next)=>{
    const refreshToken = req.cookies.refreshToken
    if(!token) return res.status(401).json({success:false, message:"No refresh Token"});

    const data = verifyRefreshToken(refreshToken);
    const userId = data.userId;
    const stored = checkIfRefreshTokenExists(userId, refreshToken);
    const newAccessToken = generateAccessToken(userId);
    const newRefreshToken = generateRefreshToken(userId);
    cacheRefreshToken(newRefreshToken);
    saveRefreshToken(newRefreshToken);
    res.cookie('refreshToken', newRefreshToken, refreshTokenCookieOptions)
    res.cookie('accessToken', newAccessToken, AccessTokenCookieOptions);
    res.json({success:true, message:"Access Token refreshed."})
})

export const logout_user = tryCatch(async(req, res, next)=>{
    refreshToken = req.cookies.refreshToken;
   const data = await verifyRefreshToken(refreshToken);
   if(data){
       const userId = data.userId
        await delCachedRefreshToken(userId)
   }
   res.clearCookie("accessToken")
   res.clearCookie("refreshToken")
   res.json({
    success:true,
    message:"Logout successfully"
   })
})


export const sendLink = tryCatch(async(req, res, next)=>{
    sendEmailVerificationMail("devansharora29476@gmail.com", "https://google.com")
    console.log("done");
    res.send({success:true});
})