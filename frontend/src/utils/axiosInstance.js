import axios from "axios";

const axiosInstance = axios.create({
    baseURL: import.meta.env.VITE_API_URL,
    headers: {
        "Content-Type": "application/json",
    },
    timeout: 10000,
    withCredentials: true,
});

const getStatusMessage = (status) => {
    switch (status) {
        case 400: return "Bad request. Please check your input.";
        case 401: return "Unauthorized. Please log in.";
        case 403: return "Forbidden. You don't have permission.";
        case 404: return "Not found. The resource doesn't exist.";
        case 500: return "Internal server error. Please try again later.";
        default:  return "An error occurred. Please try again.";
    }
};

const getErrorMessage = (error) => {
    if (axios.isCancel(error)) return "Request was cancelled.";

    if (error.response) {
        const responseData = error.response.data;
        return (
            responseData?.message ||
            responseData?.error ||
            responseData?.errors?.[0] ||
            getStatusMessage(error.response.status)
        );
    }

    if (error.request) {
        return "No response received from server. Please check your network or backend.";
    }

    return error.message || "An unknown error occurred.";
};

let accessToken = null;
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
    failedQueue.forEach((p) => error ? p.reject(error) : p.resolve(token));
    failedQueue = [];
};

export const setAccessToken = (token) => {
    accessToken = token;
};

export const clearAccessToken = () => {
    accessToken = null;
};

// --- Request interceptor ---
axiosInstance.interceptors.request.use((config) => {
    if (accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
});

// --- Response interceptor ---
axiosInstance.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        const is401 = error.response?.status === 401;
        const isRefreshEndpoint = originalRequest.url?.includes("/auth/refresh");
        const alreadyRetried = originalRequest._retry;

        // Attempt token refresh on 401, but not for the refresh endpoint itself
        if (is401 && !isRefreshEndpoint && !alreadyRetried) {
            if (isRefreshing) {
                // Queue this request until refresh completes
                return new Promise((resolve, reject) => {
                    failedQueue.push({ resolve, reject });
                }).then((token) => {
                    originalRequest.headers.Authorization = `Bearer ${token}`;
                    return axiosInstance(originalRequest);
                }).catch((err) => {
                    err.userMessage = getErrorMessage(err);
                    return Promise.reject(err);
                });
            }

            originalRequest._retry = true;
            isRefreshing = true;

            try {
                // withCredentials sends the httpOnly refresh token cookie
                const { data } = await axios.post(
                    `${import.meta.env.VITE_API_URL}api/auth/refresh`,
                    {},
                    { withCredentials: true }
                );

                setAccessToken(data.data.accessToken);
                processQueue(null, data.data.accessToken);

                originalRequest.headers.Authorization = `Bearer ${data.data.accessToken}`;
                return axiosInstance(originalRequest);
            } catch (refreshError) {
                processQueue(refreshError, null);
                clearAccessToken();
                // Dispatch a custom event so your app can redirect to login
                window.dispatchEvent(new Event("auth:logout"));
                refreshError.userMessage = "Session expired. Please log in again.";
                return Promise.reject(refreshError);
            } finally {
                isRefreshing = false;
            }
        }

        error.userMessage = getErrorMessage(error);
        return Promise.reject(error);
    }
);

export default axiosInstance;