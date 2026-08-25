import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { StyleSheet, Text, View, FlatList, ActivityIndicator, TouchableOpacity } from "react-native";
import { Link, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../../services/api";
import { Palette } from "../../constants/branding";
import { useTheme } from "../../context/ThemeContext";
import { useAuth } from "../../context/AuthContext";
import { Ionicons } from "@expo/vector-icons";

export default function PatientsScreen() {
  const { colors } = useTheme();
  const { isAuthenticated } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const { data: patients, isLoading } = useQuery({
    queryKey: ["patients"],
    queryFn: api.getPatients,
    enabled: isAuthenticated,
  });

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Active Cases</Text>
          <Text style={styles.subtitle}>Ward surveillance and treatment tracking</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => router.push("/add-patient")}>
          <Ionicons name="add" size={20} color={colors.onPrimary} />
        </TouchableOpacity>
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
                <Ionicons name="chevron-forward" size={20} color={colors.subtext} />
              </View>
              {item.culture_results ? (
                <View style={styles.cultureBadge}>
                  <Ionicons name="flask" size={12} color={colors.reserve} />
                  <Text style={styles.cultureText}>{item.culture_results}</Text>
                </View>
              ) : null}
            </View>
          </Link>
        )}
      />
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
      paddingHorizontal: 20,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    title: { fontSize: 22, fontWeight: "800", color: c.text },
    subtitle: { color: c.subtext, marginTop: 4, fontSize: 13 },
    addBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.primary,
      justifyContent: "center",
      alignItems: "center",
    },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    card: { backgroundColor: c.surface, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: c.border },
    cardHeader: { flexDirection: "row", alignItems: "center" },
    avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.primarySoft, justifyContent: "center", alignItems: "center", marginRight: 12 },
    avatarText: { color: c.primary, fontWeight: "800", fontSize: 16 },
    name: { fontSize: 16, fontWeight: "700", color: c.text },
    meta: { fontSize: 13, color: c.subtext, marginTop: 2 },
    cultureBadge: { flexDirection: "row", alignItems: "center", backgroundColor: c.dangerSoft, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, marginTop: 12 },
    cultureText: { color: c.reserve, fontWeight: "600", fontSize: 12, marginLeft: 6 },
  });
}
