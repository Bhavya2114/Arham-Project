import axios from "axios";

const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "/api",
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