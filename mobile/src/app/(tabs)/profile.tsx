import { useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { Palette } from "../../constants/branding";
import { useTheme, ThemeMode } from "../../context/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../context/AuthContext";
import { Screen } from "../../components/screen";

const MODES: { value: ThemeMode; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

export default function ProfileScreen() {
  const router = useRouter();
  const { logout, user } = useAuth();
  const { colors, mode, setMode } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const handleLogout = async () => {
    // Web note: Alert.alert is shimmed to window.confirm via src/setup/alert-shim.ts
    const doLogout = async () => {
      await logout();
      router.replace("/(tabs)");
    };

    Alert.alert("Log Out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Log Out", style: "destructive", onPress: doLogout },
    ]);
  };

  const roleDisplay = user?.role
    ? user.role.charAt(0).toUpperCase() + user.role.slice(1)
    : "Doctor";

  return (
    <Screen scroll contentStyle={{ padding: 20, gap: 16 }}>
      <View style={styles.card}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={32} color={colors.primary} />
        </View>
        <Text style={styles.name}>{user?.full_name || "Doctor"}</Text>
        <Text style={styles.role}>
          {user?.specialization || roleDisplay} · {roleDisplay}
        </Text>
        <Text style={styles.hospital}>{user?.hospital || "AMR Stewardship Network"}</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.menuItem}>
          <Ionicons name="shield-checkmark" size={20} color={colors.access} />
          <Text style={styles.menuText}>Role: {roleDisplay}</Text>
        </View>
        <View style={styles.menuItem}>
          <Ionicons name="mail" size={20} color={colors.primary} />
          <Text style={styles.menuText}>{user?.email || "Not set"}</Text>
        </View>
        <View style={styles.menuItem}>
          <Ionicons name="business" size={20} color={colors.primary} />
          <Text style={styles.menuText}>{user?.hospital || "Not set"}</Text>
        </View>
        <View style={styles.menuItem}>
          <Ionicons name="lock-closed" size={20} color={colors.primary} />
          <Text style={styles.menuText}>Session authentication: Active</Text>
        </View>
        <View style={[styles.menuItem, { borderBottomWidth: 0 }]}>
          <Ionicons name="document-text" size={20} color={colors.watch} />
          <Text style={styles.menuText}>Audit trail: Enabled</Text>
        </View>
      </View>

      {/* Appearance */}
      <View style={styles.card}>
        <Text style={styles.appearanceLabel}>Appearance</Text>
        <View style={styles.modeRow}>
          {MODES.map((m) => (
            <TouchableOpacity
              key={m.value}
              style={[styles.modeBtn, mode === m.value && styles.modeBtnActive]}
              onPress={() => setMode(m.value)}
            >
              <Ionicons
                name={m.value === "dark" ? "moon-outline" : m.value === "light" ? "sunny-outline" : "phone-portrait-outline"}
                size={16}
                color={mode === m.value ? colors.onPrimary : colors.subtext}
              />
              <Text style={[styles.modeText, mode === m.value && styles.modeTextActive]}>{m.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Ionicons name="log-out" size={18} color={colors.onPrimary} />
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>
    </Screen>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    card: { backgroundColor: c.surface, padding: 20, borderRadius: 16, borderWidth: 1, borderColor: c.border },
    avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: c.primarySoft, justifyContent: "center", alignItems: "center", alignSelf: "center", marginBottom: 12 },
    name: { fontSize: 18, fontWeight: "800", color: c.text, textAlign: "center" },
    role: { fontSize: 13, color: c.subtext, textAlign: "center", marginTop: 4 },
    hospital: { fontSize: 12, color: c.subtext, textAlign: "center", marginTop: 2 },
    menuItem: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.border },
    menuText: { fontSize: 14, color: c.text, flex: 1 },
    appearanceLabel: { fontSize: 13, fontWeight: "700", color: c.text, marginBottom: 10 },
    modeRow: { flexDirection: "row", gap: 8 },
    modeBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: c.border, backgroundColor: c.background },
    modeBtnActive: { backgroundColor: c.primary, borderColor: c.primary },
    modeText: { fontSize: 13, fontWeight: "600", color: c.subtext },
    modeTextActive: { color: c.onPrimary },
    logoutBtn: { backgroundColor: c.reserve, flexDirection: "row", justifyContent: "center", alignItems: "center", padding: 16, borderRadius: 12, gap: 8, marginTop: 8 },
    logoutText: { color: c.onPrimary, fontSize: 16, fontWeight: "700" },
  });
}
