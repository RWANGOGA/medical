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
import { useResponsive } from "../../utils/responsive";

export default function PatientsScreen() {
  const { colors } = useTheme();
  const { isAuthenticated } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isTabletOrLarger } = useResponsive();
  const styles = useMemo(() => makeStyles(colors, isTabletOrLarger), [colors, isTabletOrLarger]);

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
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => router.push("/add-patient")}
          accessibilityRole="button"
          accessibilityLabel="Add new patient"
        >
          <Ionicons name="add" size={24} color={colors.onPrimary} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={patients}
        keyExtractor={(item) => String(item.id)}
        numColumns={isTabletOrLarger ? 2 : 1}
        key={isTabletOrLarger ? "tablet" : "phone"}
        contentContainerStyle={styles.listContent}
        columnWrapperStyle={isTabletOrLarger ? styles.columnWrapper : undefined}
        renderItem={({ item }) => (
          <Link href={`/patient/${item.id}`} asChild>
            <View style={[styles.card, isTabletOrLarger && styles.cardTablet]}>
              <View style={styles.cardHeader}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{item.name.charAt(0)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.meta}>{item.age}y · {item.sex} · {item.diagnosis}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.subtext} />
              </View>
              {item.culture_results ? (
                <View style={styles.cultureBadge}>
                  <Ionicons name="flask" size={12} color={colors.reserve} />
                  <Text style={styles.cultureText} numberOfLines={1}>{item.culture_results}</Text>
                </View>
              ) : null}
            </View>
          </Link>
        )}
      />
    </View>
  );
}

function makeStyles(c: Palette, isTabletOrLarger: boolean) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: c.surface,
      paddingHorizontal: isTabletOrLarger ? 32 : 20,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    title: { fontSize: isTabletOrLarger ? 28 : 22, fontWeight: "800", color: c.text },
    subtitle: { color: c.subtext, marginTop: 4, fontSize: isTabletOrLarger ? 15 : 13 },
    addBtn: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: c.primary,
      justifyContent: "center",
      alignItems: "center",
    },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    listContent: {
      padding: isTabletOrLarger ? 24 : 20,
      gap: 12,
    },
    columnWrapper: {
      gap: 12,
    },
    card: {
      backgroundColor: c.surface,
      padding: 16,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: c.border,
      minHeight: 80,
    },
    cardTablet: {
      flex: 1,
    },
    cardHeader: { flexDirection: "row", alignItems: "center" },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: c.primarySoft,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 12,
    },
    avatarText: { color: c.primary, fontWeight: "800", fontSize: 18 },
    name: { fontSize: 16, fontWeight: "700", color: c.text },
    meta: { fontSize: 13, color: c.subtext, marginTop: 2 },
    cultureBadge: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: c.dangerSoft,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      marginTop: 12,
      alignSelf: "flex-start",
    },
    cultureText: { color: c.reserve, fontWeight: "600", fontSize: 12, marginLeft: 6 },
  });
}
