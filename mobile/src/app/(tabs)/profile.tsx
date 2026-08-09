import { View, Text, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { useRouter } from "expo-router";
import { BRANDING } from "../../constants/branding";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../context/AuthContext";

export default function ProfileScreen() {
  const router = useRouter();
  const { logout, user } = useAuth();

  const handleLogout = async () => {
    Alert.alert("Log Out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log Out",
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/(tabs)"); // This will show PublicHome since isAuthenticated is now false
        },
      },
    ]);
  };

  const roleDisplay = user?.role 
    ? user.role.charAt(0).toUpperCase() + user.role.slice(1) 
    : "Doctor";

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={32} color={BRANDING.colors.primary} />
        </View>
        <Text style={styles.name}>{user?.full_name || "Doctor"}</Text>
        <Text style={styles.role}>
          {user?.specialization || roleDisplay} · {roleDisplay}
        </Text>
        <Text style={styles.hospital}>{user?.hospital || "AMR Stewardship Network"}</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.menuItem}>
          <Ionicons name="shield-checkmark" size={20} color={BRANDING.colors.access} />
          <Text style={styles.menuText}>Role: {roleDisplay} · Verified</Text>
        </View>
        <View style={styles.menuItem}>
          <Ionicons name="mail" size={20} color={BRANDING.colors.primary} />
          <Text style={styles.menuText}>{user?.email || "Not set"}</Text>
        </View>
        <View style={styles.menuItem}>
          <Ionicons name="business" size={20} color={BRANDING.colors.primary} />
          <Text style={styles.menuText}>{user?.hospital || "Not set"}</Text>
        </View>
        <View style={styles.menuItem}>
          <Ionicons name="lock-closed" size={20} color={BRANDING.colors.primary} />
          <Text style={styles.menuText}>Offline Encrypted Storage: Enabled</Text>
        </View>
        <View style={styles.menuItem}>
          <Ionicons name="document-text" size={20} color={BRANDING.colors.watch} />
          <Text style={styles.menuText}>Audit Log: Available</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Ionicons name="log-out" size={18} color="#fff" />
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BRANDING.colors.background, padding: 20, paddingTop: 60, gap: 16 },
  card: { backgroundColor: BRANDING.colors.surface, padding: 20, borderRadius: 16, borderWidth: 1, borderColor: BRANDING.colors.border },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#EFF6FF", justifyContent: "center", alignItems: "center", alignSelf: "center", marginBottom: 12 },
  name: { fontSize: 18, fontWeight: "800", color: BRANDING.colors.text, textAlign: "center" },
  role: { fontSize: 13, color: BRANDING.colors.subtext, textAlign: "center", marginTop: 4 },
  hospital: { fontSize: 12, color: BRANDING.colors.subtext, textAlign: "center", marginTop: 2 },
  menuItem: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: BRANDING.colors.border },
  menuText: { fontSize: 14, color: BRANDING.colors.text, flex: 1 },
  logoutBtn: { backgroundColor: BRANDING.colors.reserve, flexDirection: "row", justifyContent: "center", alignItems: "center", padding: 16, borderRadius: 12, gap: 8, marginTop: 8 },
  logoutText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});