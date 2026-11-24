import { Stack, useRouter, useSegments } from "expo-router";
// Web Alert.alert shim — must load before any screen renders
import "../setup/alert-shim";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ActivityIndicator, View, StyleSheet } from "react-native";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { AssistantProvider } from "../context/AssistantContext";
import { ThemeProvider, useTheme } from "../context/ThemeContext";
import { ApiError, flushPendingMutations } from "../services/api";
import { onOfflineSynced, refreshPendingCount } from "../services/offline";
import { DownloadAppPrompt } from "../components/download-app-prompt";
import { AppTopBar } from "../components/top-bar";

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

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <AppTopBar />
      <View style={styles.stack}>
        <Stack screenOptions={{ headerShown: false }} />
      </View>
      <DownloadAppPrompt />
    </View>
  );
}

export default function RootLayout() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Auth failures are handled by the auth flow; retrying just spams 401s
            retry: (failureCount, error) =>
              (error as ApiError)?.status !== 401 && failureCount < 2,
          },
        },
      })
  );

  // Replay offline writes and refresh every cached query after a sync.
  useEffect(() => {
    refreshPendingCount().catch(() => undefined);
    flushPendingMutations().catch(() => undefined);
    return onOfflineSynced(() => {
      queryClient.invalidateQueries();
    });
  }, [queryClient]);

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
  root: {
    flex: 1,
  },
  stack: {
    flex: 1,
  },
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});