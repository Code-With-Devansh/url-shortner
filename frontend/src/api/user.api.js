import axiosInstance, { setAccessToken } from "../utils/axiosInstance";

export const loginUser = async(email, password) => {
    const {data} = await axiosInstance.post('/api/auth/login', {email, password});
    setAccessToken(data.data.accessToken);
    return data.data.user;
}

export const registerUser = async(name, email, password) => {
    const {data} = await axiosInstance.post('/api/auth/register', {name, email, password});
    return data.data.user;
} 

export const logoutUser = async() => {
    const {data} = await axiosInstance.post('/api/auth/logout');
    return data.success;
}

export const getCurrentUser = async() => {
    const {data} = await axiosInstance.get('/api/auth/me');
    setAccessToken(data.data.accessToken);
    return data.data;
}

export const getUrls = async ({
  cursor,
  search,
  sortBy = "createdAt",
  order = "desc",
  isActive,
  limit = 20,
} = {}) => {
  const params = new URLSearchParams();
 
  if (cursor)   params.set("cursor", cursor);
  if (search)   params.set("search", search);
  if (isActive !== undefined) params.set("isActive", isActive);
 
  params.set("sortBy", sortBy);
  params.set("order", order);
  params.set("limit", String(limit));
 
  const { data } = await axiosInstance.get(`/api/user/urls?${params.toString()}`);
  return data;
};

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
    console.log("refreshAccessToken", data);
    return data.accessToken;
}