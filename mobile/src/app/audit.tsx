import { useEffect, useMemo } from "react";
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../services/api";
import { Palette } from "../constants/branding";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";

export default function AuditScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [authLoading, isAuthenticated]);

  const { data: logs, isLoading } = useQuery({
    queryKey: ["audit-logs"],
    queryFn: () => api.getAuditLogs(200),
    enabled: isAuthenticated,
  });

  // Show loading state while checking auth
  if (authLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Ionicons name="pulse-outline" size={16} color={colors.primary} />
        <Text style={styles.action}>{item.action}</Text>
        <Text style={styles.user}>by {item.username}</Text>
      </View>
      {item.details ? <Text style={styles.details}>{item.details}</Text> : null}
      <Text style={styles.time}>{new Date(item.timestamp).toLocaleString()}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.title}>Activity Log</Text>
          <Text style={styles.subtitle}>Who did what, and when</Text>
        </View>
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={logs || []}
          keyExtractor={(l) => String(l.id)}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, maxWidth: 720, width: "100%", alignSelf: "center" }}
          ListEmptyComponent={
            <Text style={styles.empty}>No activity yet. Add a patient or a lab result and it will appear here.</Text>
          }
        />
      )}
    </View>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: c.surface,
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    backBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: c.surfaceAlt,
      borderWidth: 1,
      borderColor: c.border,
      justifyContent: "center",
      alignItems: "center",
    },
    title: { color: c.text, fontSize: 20, fontWeight: "800" },
    subtitle: { color: c.subtext, fontSize: 12, marginTop: 2 },
    card: { backgroundColor: c.surface, borderRadius: 12, borderWidth: 1, borderColor: c.border, padding: 14, marginBottom: 10 },
    cardHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
    action: { fontSize: 14, fontWeight: "700", color: c.text, flex: 1 },
    user: { fontSize: 11, color: c.primary, fontWeight: "700" },
    details: { fontSize: 12, color: c.text, marginTop: 6, lineHeight: 17 },
    time: { fontSize: 10, color: c.subtext, marginTop: 6 },
    empty: { fontSize: 13, color: c.subtext, textAlign: "center", marginTop: 40 },
  });
}
