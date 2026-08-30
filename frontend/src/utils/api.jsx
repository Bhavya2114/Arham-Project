import axios from "axios";

// Dynamically configure baseURL from VITE_API_URL or VITE_API_BASE_URL
const rawBaseURL = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || "/api";
const baseURL = rawBaseURL.endsWith("/api") || rawBaseURL === "/api"
  ? rawBaseURL
  : `${rawBaseURL.replace(/\/+$/, "")}/api`;

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

// Response interceptor to handle 401 unauthorized errors
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
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