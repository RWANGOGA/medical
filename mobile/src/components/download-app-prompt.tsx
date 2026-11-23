import { useEffect, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "../context/ThemeContext";
import { APK_DOWNLOAD_URL, DOWNLOAD_PAGE_PATH } from "../constants/downloads";

/**
 * Web-only install prompt.
 *
 * Shown once per browser visit so anyone opening the web version is always
 * offered the Android app. It never blocks the web app: "Continue in browser"
 * dismisses it and the full app remains usable.
 */
export function DownloadAppPrompt() {
  const { colors } = useTheme();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    if (typeof window === "undefined") return;

    // Let the page render first so the prompt does not fight with hydration.
    const timer = window.setTimeout(() => setVisible(true), 900);
    return () => window.clearTimeout(timer);
  }, []);

  if (Platform.OS !== "web") return null;

  const openApk = () => {
    setVisible(false);
    Linking.openURL(APK_DOWNLOAD_URL).catch(() => {
      // Some in-app browsers refuse programmatic navigation; leave the user
      // on the page rather than failing silently.
      setVisible(true);
    });
  };

  const openHelp = () => {
    setVisible(false);
    const url =
      typeof window === "undefined"
        ? DOWNLOAD_PAGE_PATH
        : new URL(DOWNLOAD_PAGE_PATH, window.location.origin).toString();
    Linking.openURL(url).catch(() => {});
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => setVisible(false)}
    >
      <View style={styles.root}>
        <Pressable
          style={styles.backdrop}
          onPress={() => setVisible(false)}
          accessibilityLabel="Dismiss app download prompt"
        />
        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={[styles.iconWrap, { backgroundColor: colors.primarySoft }]}>
            <Ionicons name="phone-portrait-outline" size={26} color={colors.primary} />
          </View>

          <Text style={[styles.title, { color: colors.text }]}>Get the Android app</Text>
          <Text style={[styles.body, { color: colors.subtext }]}>
            Install the APK for a full-screen, faster experience. The web version
            stays available whenever you need it.
          </Text>

          <TouchableOpacity
            style={[styles.primary, { backgroundColor: colors.primary }]}
            onPress={openApk}
            accessibilityRole="button"
            accessibilityLabel="Download the Android APK"
          >
            <Ionicons name="download-outline" size={18} color={colors.onPrimary} />
            <Text style={[styles.primaryText, { color: colors.onPrimary }]}>
              Download APK
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondary}
            onPress={() => setVisible(false)}
            accessibilityRole="button"
          >
            <Text style={[styles.secondaryText, { color: colors.subtext }]}>
              Continue in browser
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={openHelp} accessibilityRole="link">
            <Text style={[styles.link, { color: colors.primary }]}>Installation help</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "flex-end",
    alignItems: "center",
    padding: 16,
  },
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(2, 6, 23, 0.55)",
  },
  card: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 20,
    borderWidth: 1,
    padding: 22,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  title: { fontSize: 18, fontWeight: "800", textAlign: "center" },
  body: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 6,
    marginBottom: 18,
  },
  primary: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    borderRadius: 12,
  },
  primaryText: { fontSize: 15, fontWeight: "700" },
  secondary: { paddingVertical: 12, paddingHorizontal: 12 },
  secondaryText: { fontSize: 14, fontWeight: "600" },
  link: { fontSize: 13, fontWeight: "600", textDecorationLine: "underline", marginTop: 2 },
});
