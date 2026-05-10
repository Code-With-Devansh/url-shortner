import { cookieOptions } from "../config/config.js";
import { loginUser, registerUser } from "../services/auth.service.js";
import tryCatch from "../utils/tryCatch.js"

export const register_user = tryCatch( async (req, res, next) => {
    const {name, email, password} = req.body;
    const {token, user} = await registerUser(name, email, password);
    res.cookie("accessToken", token, cookieOptions);
    res.status(201).json({success: true, data: user, message: "User registered successfully"});
})

export const login_user = tryCatch( async (req, res, next) => {
    const {email, password} = req.body;
    const {token, user} = await loginUser(email, password);
    res.cookie("accessToken", token, cookieOptions);
    res.status(200).json({success: true, data: user, message: "User logged in successfully"});
} )

export const get_current_user = tryCatch( async (req, res, next) => {
    res.status(200).json({success: true, data: req.user, message: "Current user fetched successfully"});
} )