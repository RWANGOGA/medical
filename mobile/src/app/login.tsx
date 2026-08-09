
import { useState } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { api } from "../services/api";
import { BRANDING } from "../constants/branding";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();
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

  const handleClearStorage = async () => {
    await AsyncStorage.clear();
    Alert.alert("Storage Cleared", "All cached data has been removed.");
    if (Platform.OS === "web") {
      window.location.reload();
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.header}>
        <Ionicons name="shield-checkmark" size={48} color={BRANDING.colors.primary} />
        <Text style={styles.title}>{BRANDING.appName}</Text>
        <Text style={styles.subtitle}>{BRANDING.officialName}</Text>
      </View>

      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Username"
          placeholderTextColor={BRANDING.colors.subtext}
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={BRANDING.colors.subtext}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        <TouchableOpacity
          style={[styles.button, loading && { opacity: 0.6 }]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Sign In</Text>
          )}
        </TouchableOpacity>
      </View>

      <Text style={styles.demoHint}>
        Demo: username "dr.demo" / password "steward123"
      </Text>

      {/* Clear Storage Button - For Testing */}
      <TouchableOpacity 
        style={styles.clearButton} 
        onPress={handleClearStorage}
      >
        <Ionicons name="trash" size={16} color={BRANDING.colors.reserve} />
        <Text style={styles.clearButtonText}>Clear Storage (Reset)</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.replace("/register")}>
        <Text style={styles.registerLink}>Don't have an account? Sign up</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BRANDING.colors.background, justifyContent: "center", padding: 24 },
  header: { alignItems: "center", marginBottom: 40 },
  title: { fontSize: 28, fontWeight: "800", color: BRANDING.colors.text, marginTop: 12 },
  subtitle: { fontSize: 14, color: BRANDING.colors.subtext, marginTop: 4 },
  form: { gap: 12 },
  input: { backgroundColor: BRANDING.colors.surface, borderWidth: 1, borderColor: BRANDING.colors.border, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: BRANDING.colors.text },
  button: { backgroundColor: BRANDING.colors.primary, borderRadius: 12, paddingVertical: 16, alignItems: "center", marginTop: 8 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  demoHint: { textAlign: "center", color: BRANDING.colors.subtext, fontSize: 12, marginTop: 24 },
  registerLink: { textAlign: "center", color: BRANDING.colors.primary, fontSize: 14, marginTop: 16, fontWeight: "600" },
  
  // Clear Storage Button Styles
  clearButton: { 
    flexDirection: "row", 
    alignItems: "center", 
    justifyContent: "center", 
    gap: 8,
    paddingVertical: 12, 
    marginTop: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BRANDING.colors.reserve + "40",
    backgroundColor: BRANDING.colors.reserve + "10",
  },
  clearButtonText: { 
    fontSize: 13, 
    fontWeight: "600", 
    color: BRANDING.colors.reserve 
  },
});