import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQueryClient } from "@tanstack/react-query";
import { api, setAuthToken, getStoredToken } from "../services/api";
import {
  initCacheScope,
  setCacheScope,
  clearOfflineData,
} from "../services/offline";

interface User {
  id: number;
  username: string;
  email?: string;
  full_name: string;
  role: string;
  hospital: string;
  specialization: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  isAdmin: boolean;
  user: User | null;
  login: (token: string, userData: User) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const queryClient = useQueryClient();

  const isAdmin = user?.role === "admin";

  useEffect(() => {
    const loadAuth = async () => {
      await initCacheScope();
      const token = await getStoredToken();
      if (token) {
        try {
          const userData = await api.getMe();
          setUser(userData);
          setIsAuthenticated(true);
          await AsyncStorage.setItem("userData", JSON.stringify(userData));
          await setCacheScope(userData.id);
        } catch (error: any) {
          if (error?.status === 401) {
            await setAuthToken(null);
            await setCacheScope(null);
            await clearOfflineData();
          }
          // Otherwise keep the session and cached data for offline use.
        }
      } else {
        await setCacheScope(null);
      }
      setIsLoading(false);
    };
    loadAuth();
  }, []);

  const login = async (token: string, userData: User) => {
    await setAuthToken(token);
    await AsyncStorage.setItem("userData", JSON.stringify(userData));
    await setCacheScope(userData.id);
    setUser(userData);
    setIsAuthenticated(true);
    queryClient.invalidateQueries();
  };

  const logout = async () => {
    await setCacheScope(null);
    await clearOfflineData();
    await setAuthToken(null);
    setUser(null);
    setIsAuthenticated(false);
    await AsyncStorage.removeItem("userData");
    queryClient.clear();
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, isAdmin, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}