import axios from "axios";
import type { AxiosError, InternalAxiosRequestConfig } from "axios";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://192.168.10.250:8000/api/v1";

const refreshClient = axios.create({
    baseURL: apiBaseUrl,
    withCredentials: true,
});

interface RetriableRequestConfig extends InternalAxiosRequestConfig {
    _retry?: boolean;
}

const isAuthRoute = (url?: string) => {
    if (!url) {
        return false;
    }

    return ["/auth/login", "/auth/logout", "/auth/refresh"].some((path) => url.includes(path));
};

let refreshPromise: Promise<void> | null = null;

const ensureRefresh = () => {
    if (!refreshPromise) {
        refreshPromise = refreshClient.post("/auth/refresh").then(() => undefined).finally(() => {
            refreshPromise = null;
        });
    }

    return refreshPromise;
};

export const apiClient = axios.create({
    baseURL: apiBaseUrl,
    withCredentials: true,
    headers: {
        "Content-Type": "application/json",
    },
});

apiClient.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
        const statusCode = error.response?.status;
        const originalRequest = error.config as RetriableRequestConfig | undefined;

        if (statusCode === 401 && originalRequest && !originalRequest._retry && !isAuthRoute(originalRequest.url)) {
            originalRequest._retry = true;

            try {
                await ensureRefresh();
                return apiClient(originalRequest);
            } catch {
                window.dispatchEvent(new Event("auth:expired"));
            }
        }

        return Promise.reject(error);
    },
);
