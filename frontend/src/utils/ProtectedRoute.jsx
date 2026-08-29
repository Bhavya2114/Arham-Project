import { replace, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useEffect } from "react";

const ProtectedRoute = ({ children, requiredRole }) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate("/login", { replace: true });
      return;
    }
    
    if (!requiredRole.includes(user.role)) {
      navigate("/unauthorized", { replace: true });
      return;
    }
  }, [user, navigate, requiredRole]); // Added dependencies
  
  // Early returns instead of storing in variable
  if (!user) return null;
  if (!requiredRole.includes(user.role)) return null;
  
  return children;
};

export default ProtectedRoute;
