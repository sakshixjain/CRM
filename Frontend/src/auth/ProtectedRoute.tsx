import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token, loading } = useAuth();

  if (loading) return <div style={{ padding: 20 }}>Loading...</div>;
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
