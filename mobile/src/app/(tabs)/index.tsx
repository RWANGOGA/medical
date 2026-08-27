import { useMemo } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { DoctorDashboard } from "./home/DoctorDashboard";
import { AdminDashboard } from "./home/AdminDashboard";
import { PublicHome } from "./home/PublicHome";

export default function HomeScreen() {
  const { isAuthenticated, isAdmin, user, isLoading } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading…</Text>
      </View>
    );
  }

  if (isAuthenticated && user) {
    if (isAdmin) {
      return <AdminDashboard colors={colors} />;
    }
    return <DoctorDashboard user={user} colors={colors} />;
  }

  return <PublicHome colors={colors} />;
}

function makeStyles(c: { background: string; primary: string; subtext: string }) {
  return StyleSheet.create({
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: c.background,
      gap: 12,
    },
    loadingText: { fontSize: 14, color: c.subtext, fontWeight: "600" },
  });
}
