
import axiosInstance from "../utils/axiosInstance";

export const createShortUrl = async (url, user = null, slug = null) => {
    const {data} = await axiosInstance.post("/api/create", { url, user, slug })
    return data.data.short_url;
}

export const deleteUrl = async (id) => {
    await axiosInstance.delete(`/api/${id}`);
}