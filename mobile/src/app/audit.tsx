import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../services/api";
import { BRANDING } from "../constants/branding";

export default function AuditScreen() {
  const router = useRouter();
  const { data: logs, isLoading } = useQuery({
    queryKey: ["audit-logs"],
    queryFn: () => api.getAuditLogs(200),
  });

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Ionicons name="pulse-outline" size={16} color={BRANDING.colors.primary} />
        <Text style={styles.action}>{item.action}</Text>
        <Text style={styles.user}>by {item.username}</Text>
      </View>
      {item.details ? <Text style={styles.details}>{item.details}</Text> : null}
      <Text style={styles.time}>{new Date(item.timestamp).toLocaleString()}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.title}>Activity Log</Text>
          <Text style={styles.subtitle}>Who did what, and when</Text>
        </View>
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color={BRANDING.colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={logs || []}
          keyExtractor={(l) => String(l.id)}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={
            <Text style={styles.empty}>No activity yet. Add a patient or a lab result and it will appear here.</Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BRANDING.colors.background },
  header: { flexDirection: "row", alignItems: "center", backgroundColor: BRANDING.colors.primary, padding: 16, paddingTop: 60, borderBottomLeftRadius: 20, borderBottomRightRadius: 20 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.15)", justifyContent: "center", alignItems: "center" },
  title: { color: "#fff", fontSize: 20, fontWeight: "800" },
  subtitle: { color: "rgba(255,255,255,0.8)", fontSize: 12, marginTop: 2 },
  card: { backgroundColor: BRANDING.colors.surface, borderRadius: 12, borderWidth: 1, borderColor: BRANDING.colors.border, padding: 14, marginBottom: 10 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  action: { fontSize: 14, fontWeight: "700", color: BRANDING.colors.text, flex: 1 },
  user: { fontSize: 11, color: BRANDING.colors.primary, fontWeight: "700" },
  details: { fontSize: 12, color: BRANDING.colors.text, marginTop: 6, lineHeight: 17 },
  time: { fontSize: 10, color: BRANDING.colors.subtext, marginTop: 6 },
  empty: { fontSize: 13, color: BRANDING.colors.subtext, textAlign: "center", marginTop: 40 },
});