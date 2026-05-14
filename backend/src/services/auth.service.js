import { createUser, findUserByEmail, findUserByEmailWithPassword, findUserById, saveRefreshToken } from "../dao/user.dao.js";
import { cacheRefreshToken } from "../dao/user.redis.js";
import { conflictError, NotFoundError, UnauthorizedError } from "../utils/appError.js";
import { generateAccessToken, generateRefreshToken } from "../utils/helper.js";

export const registerUser = async (name, email, password) => {
    const existingUser = await findUserByEmail(email);
    if (existingUser) {
        throw new conflictError ("User already exists");
    }
    const user = await createUser(name, email, password);
    const accessToken = await generateAccessToken(user._id.toString());
    const refreshToken = await generateRefreshToken(user._id.toString());
    await cacheRefreshToken(refreshToken, user._id)
    await saveRefreshToken(user, refreshToken);
    user.password = undefined;
    return {accessToken, refreshToken, user};
}

export const loginUser = async (email, password) => {
    const user = await findUserByEmailWithPassword(email);
    if (!user || !(await user.comparePassword(password))) {
        throw new UnauthorizedError("Invalid email or password");
    }
    const accessToken = await generateAccessToken(user._id.toString());
    const refreshToken = await generateRefreshToken(user._id.toString());
    await cacheRefreshToken(refreshToken, user._id)
    await saveRefreshToken(user, refreshToken);
    user.password = undefined;
    return {accessToken, refreshToken, user};
}


export const checkIfRefreshTokenExists = (id, refreshToken)=>{
    const cached = getCachedRefreshToken(id);
    if(cached === refreshToken){
        return true;
    }
    const user = checkIfRefreshTokenExistsDao(id, refreshToken);
    if(user){
        return true;
    }
    throw new NotFoundError("Invalid Refresh Token");
}
