import { createContext, useState, useContext, useEffect } from "react";
import axiosInstance from "../utils/api";

export const AuthContext = createContext();

// A login lasts 7 days (set by the server's token). True when the stored token's time is up.
const isTokenExpired = (token) => {
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof payload.exp === "number" && payload.exp * 1000 <= Date.now();
  } catch {
    return false;
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    // Initialize user from localStorage on mount
    const storedUser = JSON.parse(localStorage.getItem("ims_user"));
    return storedUser || null;
  });
  const [loading, setLoading] = useState(true);

  const login = (userData, token) => {
    setUser(userData);
    localStorage.setItem("ims_user", JSON.stringify(userData));
    localStorage.setItem("ims_token", token);
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("ims_user");
    localStorage.removeItem("ims_token");
  };

  useEffect(() => {
    const validateToken = async () => {
      const token = localStorage.getItem("ims_token");
      if (token && isTokenExpired(token)) {
        logout();
      } else if (token) {
        try {
          const response = await axiosInstance.get("/auth/me");
          if (response.data && response.data.user) {
            const meUser = response.data.user;
            const normalizedUser = {
              id: meUser.userId || meUser.id,
              name: meUser.name,
              email: meUser.email,
              role: meUser.role,
            };
            setUser(normalizedUser);
            localStorage.setItem("ims_user", JSON.stringify(normalizedUser));
          }
        } catch (error) {
          console.error("Token validation failed on load:", error);
          logout();
        }
      }
      setLoading(false);
    };

    validateToken();
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
export default AuthProvider;
