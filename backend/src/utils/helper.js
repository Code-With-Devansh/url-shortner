import { nanoid } from "nanoid";
import { jwtVerify, SignJWT } from "jose";
import { ValidationError } from "./appError.js";
export const generateShortUrl = (length = 7) => {
       const id = nanoid(7);
         return id;
}

export const generateAccessToken = (userId)=>{
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const token = new SignJWT({ userId })
        .setProtectedHeader({ alg: "HS256" })
        .setExpirationTime("15m")
        .sign(secret);
    return token;
}

export const generateRefreshToken = (userId)=>{
    const secret = new TextEncoder().encode(process.env.JWT_REFRESH_SECRET);
    const token = new SignJWT({ userId })
        .setProtectedHeader({ alg: "HS256" })
        .setExpirationTime("20d")
        .sign(secret);
    return token;
}

export const verifyToken = async (token)=>{
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    try {
        const { payload } = await jwtVerify(token, secret);
        return payload;
    } catch (error) { 
        console.log(error)
        throw new ValidationError("Invalid token");
    }
}
export const verifyRefreshToken = async (token)=>{
    const secret = new TextEncoder().encode(process.env.JWT_REFRESH_SECRET);
    try {
        const { payload } = await jwtVerify(token, secret);
        return payload;
    } catch (error) { 
        console.log(error)
        throw new ValidationError("Invalid token");
    }
}
