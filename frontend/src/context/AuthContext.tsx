"use client";
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { getToken, setToken, clearToken, authApi } from "@/lib/api";

interface AuthContextValue {
  isAuthenticated: boolean;
  userEmail: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (token) {
      // Decode email from JWT payload (simple base64, no verify needed client-side)
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        setUserEmail(payload.email ?? payload.sub ?? null);
        setIsAuthenticated(true);
      } catch {
        clearToken();
      }
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await authApi.login(email, password);
    setToken(data.access_token);
    setUserEmail(email);
    setIsAuthenticated(true);
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    await authApi.register(email, password);
    // Auto-login after registration
    await login(email, password);
  }, [login]);

  const logout = useCallback(() => {
    clearToken();
    setIsAuthenticated(false);
    setUserEmail(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ isAuthenticated, userEmail, loading, login, register, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
