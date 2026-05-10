import { createUser, findUserByEmail, findUserByEmailWithPassword } from "../dao/user.dao.js";
import { conflictError, UnauthorizedError } from "../utils/appError.js";
import { generateToken } from "../utils/helper.js";

export const registerUser = async (name, email, password) => {
    const existingUser = await findUserByEmail(email);
    if (existingUser) {
        throw new conflictError ("User already exists");
    }
    const user = await createUser(name, email, password);
    const token = await generateToken(user._id.toString());

    return {token, user};
}

export const loginUser = async (email, password) => {
    const user = await findUserByEmailWithPassword(email);
    if (!user || !(await user.comparePassword(password))) {
        throw new UnauthorizedError("Invalid email or password");
    }
    const token = await generateToken(user._id.toString());
    user.password = undefined;
    return {token, user};
}