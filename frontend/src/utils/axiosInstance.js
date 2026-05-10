import axios from "axios";

const axiosInstance = axios.create({
    baseURL: "http://localhost:5000",
    headers: {
        "Content-Type": "application/json",
    },
    timeout: 10000,
    withCredentials: true,
});

const getStatusMessage = (status) => {
    switch (status) {
        case 400:
            return "Bad request. Please check your input.";
        case 401:
            return "Unauthorized. Please log in.";
        case 403:
            return "Forbidden. You don't have permission.";
        case 404:
            return "Not found. The resource doesn't exist.";
        case 500:
            return "Internal server error. Please try again later.";
        default:
            return "An error occurred. Please try again.";
    }
};

const getErrorMessage = (error) => {
    if (axios.isCancel(error)) {
        return "Request was cancelled.";
    }

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

axiosInstance.interceptors.response.use(
    (response) => response,
    (error) => {
        error.userMessage = getErrorMessage(error);
        return Promise.reject(error);
    }
);

export default axiosInstance;