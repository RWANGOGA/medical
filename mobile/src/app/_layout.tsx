import { Stack, useRouter, useSegments } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ActivityIndicator, View, StyleSheet } from "react-native";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { AssistantProvider } from "../context/AssistantContext";
import { ThemeProvider, useTheme } from "../context/ThemeContext";

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (isLoading) return;

    const currentRoute = segments[0];
    
    // List of protected routes that require authentication
    const protectedRoutes = ["patients", "cds"];
    
    // If user is NOT authenticated and trying to access a protected route
    if (!isAuthenticated && protectedRoutes.includes(currentRoute)) {
      router.replace("/login");
    }
    
    // If user IS authenticated and on login/register, redirect to home
    if (isAuthenticated && (currentRoute === "login" || currentRoute === "register")) {
      router.replace("/(tabs)");
    }
  }, [isAuthenticated, segments, isLoading]);

  if (isLoading) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <AssistantProvider>
            <AppContent />
          </AssistantProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});