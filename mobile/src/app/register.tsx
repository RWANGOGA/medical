import { useMemo, useState, useEffect } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { api, setAuthToken } from "../services/api";
import { Palette } from "../constants/branding";
import { useTheme } from "../context/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";

export default function RegisterScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    username: "",
    password: "",
    hospital: "",
    specialization: "",
  });
  const [loading, setLoading] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const passwordMismatch =
    confirmPassword.length > 0 && confirmPassword !== formData.password;

  // Clear any stale token when entering register screen
  useEffect(() => {
    setAuthToken(null);
  }, []);

  const handleRegister = async () => {
    if (!formData.full_name || !formData.email || !formData.username || !formData.password || !formData.hospital) {
      Alert.alert("Missing Info", "Please fill in all required fields.");
      return;
    }
    if (!confirmPassword) {
      Alert.alert("Confirm Password", "Please re-enter your password to confirm it.");
      return;
    }
    if (confirmPassword !== formData.password) {
      Alert.alert("Password Mismatch", "The passwords you entered do not match. Please try again.");
      return;
    }
    setLoading(true);
    try {
      const res = await api.register({ ...formData, role: "doctor" });

      // Save token AND user data to context
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
      Alert.alert("Registration Failed", e.message || "Could not create account.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.column}>
          <View style={styles.header}>
            <Ionicons name="person-add" size={48} color={colors.primary} />
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Registration for healthcare professionals</Text>
          </View>

          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder="Full Name"
              placeholderTextColor={colors.subtext}
              value={formData.full_name}
              onChangeText={(text) => setFormData({ ...formData, full_name: text })}
            />
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={colors.subtext}
              value={formData.email}
              onChangeText={(text) => setFormData({ ...formData, email: text })}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <TextInput
              style={styles.input}
              placeholder="Username"
              placeholderTextColor={colors.subtext}
              value={formData.username}
              onChangeText={(text) => setFormData({ ...formData, username: text })}
              autoCapitalize="none"
            />
            <View style={styles.passwordWrap}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                placeholder="Password"
                placeholderTextColor={colors.subtext}
                value={formData.password}
                onChangeText={(text) => setFormData({ ...formData, password: text })}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity
                style={styles.eyeBtn}
                onPress={() => setShowPassword((v) => !v)}
                accessibilityLabel={showPassword ? "Hide password" : "Show password"}
              >
                <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color={colors.subtext} />
              </TouchableOpacity>
            </View>
            <View style={styles.passwordWrap}>
              <TextInput
                style={[styles.input, styles.passwordInput, passwordMismatch && styles.inputError]}
                placeholder="Confirm Password"
                placeholderTextColor={colors.subtext}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirm}
              />
              <TouchableOpacity
                style={styles.eyeBtn}
                onPress={() => setShowConfirm((v) => !v)}
                accessibilityLabel={showConfirm ? "Hide password" : "Show password"}
              >
                <Ionicons name={showConfirm ? "eye-off-outline" : "eye-outline"} size={20} color={colors.subtext} />
              </TouchableOpacity>
            </View>
            {passwordMismatch && (
              <Text style={styles.mismatchText}>Passwords do not match.</Text>
            )}
            <TextInput
              style={styles.input}
              placeholder="Hospital / Facility"
              placeholderTextColor={colors.subtext}
              value={formData.hospital}
              onChangeText={(text) => setFormData({ ...formData, hospital: text })}
            />
            <TextInput
              style={styles.input}
              placeholder="Specialization (optional)"
              placeholderTextColor={colors.subtext}
              value={formData.specialization}
              onChangeText={(text) => setFormData({ ...formData, specialization: text })}
            />
            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleRegister}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <Text style={styles.buttonText}>Create Account</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.replace("/login")}>
              <Text style={styles.loginLink}>Already have an account? Sign in</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    scrollContent: { flexGrow: 1, justifyContent: "center", padding: 24 },
    column: { maxWidth: 480, width: "100%", alignSelf: "center" },
    header: { alignItems: "center", marginBottom: 32 },
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
    passwordWrap: { position: "relative" },
    passwordInput: { paddingRight: 48 },
    inputError: { borderColor: c.reserve },
    eyeBtn: {
      position: "absolute", right: 4, top: 0, bottom: 0, width: 44,
      justifyContent: "center", alignItems: "center",
    },
    mismatchText: { color: c.reserve, fontSize: 13, marginTop: -4 },
    button: {
      backgroundColor: c.primary,
      borderRadius: 12,
      paddingVertical: 16,
      alignItems: "center",
      marginTop: 8,
    },
    buttonDisabled: { opacity: 0.6 },
    buttonText: { color: c.onPrimary, fontSize: 16, fontWeight: "700" },
    loginLink: { textAlign: "center", color: c.primary, fontSize: 14, marginTop: 24, fontWeight: "600" },
  });
}
