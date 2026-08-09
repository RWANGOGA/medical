import { useQuery } from "@tanstack/react-query";
import { StyleSheet, Text, View, FlatList, ActivityIndicator } from "react-native";
import { Link } from "expo-router";
import { api } from "../../services/api";
import { BRANDING } from "../../constants/branding";
import { Ionicons } from "@expo/vector-icons";

export default function PatientsScreen() {
  const { data: patients, isLoading } = useQuery({
    queryKey: ["patients"],
    queryFn: api.getPatients,
  });

  if (isLoading) return <View style={styles.center}><ActivityIndicator size="large" color={BRANDING.colors.primary} /></View>;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Active Cases</Text>
        <Text style={styles.subtitle}>Ward surveillance & treatment tracking</Text>
      </View>

      <FlatList
        data={patients}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ padding: 20, gap: 12 }}
        renderItem={({ item }) => (
          <Link href={`/patient/${item.id}`} asChild>
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{item.name.charAt(0)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.meta}>{item.age}y · {item.sex} · {item.diagnosis}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={BRANDING.colors.subtext} />
              </View>
              <View style={styles.cultureBadge}>
                <Ionicons name="flask" size={12} color={BRANDING.colors.reserve} />
                <Text style={styles.cultureText}>{item.culture_results}</Text>
              </View>
            </View>
          </Link>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BRANDING.colors.background },
  header: { backgroundColor: BRANDING.colors.surface, padding: 20, paddingTop: 60, borderBottomWidth: 1, borderBottomColor: BRANDING.colors.border },
  title: { fontSize: 24, fontWeight: "800", color: BRANDING.colors.text },
  subtitle: { color: BRANDING.colors.subtext, marginTop: 4 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  card: { backgroundColor: BRANDING.colors.surface, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: BRANDING.colors.border },
  cardHeader: { flexDirection: "row", alignItems: "center" },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#E0F2FE", justifyContent: "center", alignItems: "center", marginRight: 12 },
  avatarText: { color: BRANDING.colors.primary, fontWeight: "800", fontSize: 16 },
  name: { fontSize: 16, fontWeight: "700", color: BRANDING.colors.text },
  meta: { fontSize: 13, color: BRANDING.colors.subtext, marginTop: 2 },
  cultureBadge: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFF1F2", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, marginTop: 12 },
  cultureText: { color: BRANDING.colors.reserve, fontWeight: "600", fontSize: 12, marginLeft: 6 }
});