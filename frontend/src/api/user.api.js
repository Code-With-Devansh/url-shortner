import axiosInstance, { setAccessToken } from "../utils/axiosInstance";

export const loginUser = async(email, password) => {
    const {data} = await axiosInstance.post('/api/auth/login', {email, password});
    setAccessToken(data.data.accessToken);
    return data.data;
}

export const registerUser = async(name, email, password) => {
    const {data} = await axiosInstance.post('/api/auth/register', {name, email, password});
    return data.data;
} 

export const logoutUser = async() => {
    const {data} = await axiosInstance.get('/api/auth/logout');
    return data.data;
}

export const getCurrentUser = async() => {
    const {data} = await axiosInstance.get('/api/auth/me');
    setAccessToken(data.data.accessToken);
    return data.data;
}

export const getUrls = async() => {
    const {data} = await axiosInstance.get('/api/user/urls');
    return data.urls;
}

export const sendVerificationMail = async(email) =>{
    const {data} = await axiosInstance.post("/api/auth/send-verification-link", {email})
    return data;
}

export const forgotPassword = async(email) =>{
    const {data} = await axiosInstance.post('/api/auth/forgot-password', {email})
    return data;
}
export const changePassword = async (token, password) =>{
    const {data} = await axiosInstance.post('/api/auth/change-password/'+ token, {password})
    return data;
}

export const refreshAccessToken = async()=>{
    const {data} = await axiosInstance.post("/api/auth/refresh");
    return data;
}