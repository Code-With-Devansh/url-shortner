import { nanoid } from "nanoid";
import { jwtVerify, SignJWT } from "jose";
import { cookieOptions } from "../config/config.js";
import { ValidationError } from "./appError.js";
export const generateShortUrl = (length = 7) => {
       const id = nanoid(7);
         return id;
}

export const generateToken = (userId)=>{
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const token = new SignJWT({ userId })
        .setProtectedHeader({ alg: "HS256" })
        .setExpirationTime("1h")
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