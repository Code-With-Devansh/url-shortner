
import { User } from "../models/user.model.js";

export const findUserByEmailWithPassword = async (email) => {
    return User.findOne({ email }).select("+password");
};
export const findUserByEmail = async (email) => {
    return User.findOne({ email });
};

export const findUserById = async (id) => {
    return User.findById(id);
}

export const createUser = async (name, email, password) => {
    const user = new User({ name, email, password });
    await user.save();
    user.password = undefined;
    return user;
}


