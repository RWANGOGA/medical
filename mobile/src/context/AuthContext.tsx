import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQueryClient } from "@tanstack/react-query";
import { api, setAuthToken, getStoredToken } from "../services/api";

interface User {
  id: number;
  username: string;
  full_name: string;
  role: string;
  hospital: string;
  specialization: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
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

  useEffect(() => {
    const loadAuth = async () => {
      const token = await getStoredToken();
      if (token) {
        try {
          const userData = await api.getMe();
          setUser(userData);
          setIsAuthenticated(true);
        } catch (error) {
          await setAuthToken(null);
        }
      }
      setIsLoading(false);
    };
    loadAuth();
  }, []);

  const login = async (token: string, userData: User) => {
    // Set token SYNCHRONOUSLY first (before any queries fire)
    await setAuthToken(token);
    setUser(userData);
    setIsAuthenticated(true);
    await AsyncStorage.setItem("userData", JSON.stringify(userData));
    
    // Invalidate all queries so they refetch with the new token
    queryClient.invalidateQueries();
  };

  const logout = async () => {
    await setAuthToken(null);
    setUser(null);
    setIsAuthenticated(false);
    await AsyncStorage.removeItem("userData");
    queryClient.clear();
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}