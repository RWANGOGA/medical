
import { useMemo, useState } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { api } from "../services/api";
import { Palette, BRANDING } from "../constants/branding";
import { useTheme } from "../context/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert("Missing Info", "Please enter username and password.");
      return;
    }
    setLoading(true);
    try {
      const res = await api.login(username, password);
      await login(res.access_token, {
        id: res.user_id,
        username: res.username,
        full_name: res.full_name,
        role: res.role,
        hospital: res.hospital,
        specialization: res.specialization,
      });
      router.replace("/(tabs)");
    } catch (e: any) {
      Alert.alert("Login Failed", e.message || "Invalid credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.column}>
        <View style={styles.header}>
          <Ionicons name="shield-checkmark" size={48} color={colors.primary} />
          <Text style={styles.title}>Sign In</Text>
          <Text style={styles.subtitle}>{BRANDING.officialName}</Text>
        </View>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Username"
            placeholderTextColor={colors.subtext}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={colors.subtext}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Text style={styles.buttonText}>Sign In</Text>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => router.replace("/register")}>
          <Text style={styles.registerLink}>Don't have an account? Sign up</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background, justifyContent: "center", padding: 24 },
    column: { maxWidth: 480, width: "100%", alignSelf: "center" },
    header: { alignItems: "center", marginBottom: 40 },
    title: { fontSize: 26, fontWeight: "800", color: c.text, marginTop: 12 },
    subtitle: { fontSize: 14, color: c.subtext, marginTop: 4, textAlign: "center" },
    form: { gap: 12 },
    input: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 16,
      color: c.text,
    },
    button: {
      backgroundColor: c.primary,
      borderRadius: 12,
      paddingVertical: 16,
      alignItems: "center",
      marginTop: 8,
    },
    buttonDisabled: { opacity: 0.6 },
    buttonText: { color: c.onPrimary, fontSize: 16, fontWeight: "700" },
    registerLink: { textAlign: "center", color: c.primary, fontSize: 14, marginTop: 24, fontWeight: "600" },
  });
}
