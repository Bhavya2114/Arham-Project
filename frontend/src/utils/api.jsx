import axios from "axios";

// Dynamically configure baseURL from VITE_API_URL or VITE_API_BASE_URL
const rawBaseURL = (import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || "/api").trim().replace(/\/+$/, "");
const baseURL = rawBaseURL.endsWith("/api") || rawBaseURL === ""
  ? (rawBaseURL || "/api")
  : `${rawBaseURL}/api`;

const axiosInstance = axios.create({
  baseURL,
});

// Request interceptor to attach bearer token
axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("ims_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// The Render backend sleeps when idle and answers 502/503/504 (or nothing) while it wakes up.
// Read requests are retried a few times so a cold start doesn't show as an error.
const RETRY_DELAYS_MS = [2000, 5000, 10000];
const isWakingUp = (error) =>
  !error.response || [502, 503, 504].includes(error.response.status);

// Response interceptor to retry reads during a cold start and handle 401 unauthorized errors
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;
    if (config && (config.method || "get").toLowerCase() === "get" && !axios.isCancel(error) && isWakingUp(error)) {
      config.__retryCount = config.__retryCount || 0;
      if (config.__retryCount < RETRY_DELAYS_MS.length) {
        const delay = RETRY_DELAYS_MS[config.__retryCount];
        config.__retryCount += 1;
        await new Promise((resolve) => setTimeout(resolve, delay));
        return axiosInstance(config);
      }
    }

    if (error.response && error.response.status === 401) {
      localStorage.removeItem("ims_token");
      localStorage.removeItem("ims_user");
      // Check if we are already on login page to avoid loops
      if (typeof window !== "undefined" && !window.location.pathname.endsWith("/login")) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;