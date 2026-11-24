import { Linking, TouchableOpacity, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAssistant } from "../context/AssistantContext";
import { useTheme } from "../context/ThemeContext";
import { api } from "../services/api";
import { APK_DOWNLOAD_URL, RELEASE_PAGE_URL } from "../constants/downloads";
import type { Palette } from "../constants/branding";

/**
 * Footer with the app features. Rendered at the bottom of every page so the
 * feature set (download the Android app, run the report, consult the assistant,
 * open guidelines and publications) is always one tap away.
 */
export function AppFooter({ colors }: { colors: Palette }) {
  const router = useRouter();
  const { openAssistant } = useAssistant();

  const openExternal = (url: string) => {
    Linking.openURL(url).catch(() => {});
  };

  const features = [
    {
      key: "download",
      label: "Download Android app",
      icon: "phone-portrait-outline" as const,
      onPress: () => openExternal(APK_DOWNLOAD_URL),
    },
    {
      key: "release",
      label: "Release notes",
      icon: "ribbon-outline" as const,
      onPress: () => openExternal(RELEASE_PAGE_URL),
    },
    {
      key: "report",
      label: "Stewardship report",
      icon: "download-outline" as const,
      onPress: () => openExternal(api.reportUrl()),
    },
    {
      key: "assistant",
      label: "Clinical assistant",
      icon: "pulse-outline" as const,
      onPress: openAssistant,
    },
    {
      key: "guidelines",
      label: "Guidelines",
      icon: "book-outline" as const,
      onPress: () => router.push("/guidelines" as never),
    },
    {
      key: "publications",
      label: "Publications",
      icon: "newspaper-outline" as const,
      onPress: () => router.push("/publications" as never),
    },
  ];

  const featureStyle = (active: boolean) => ({
    flexDirection: "row" as const,
    alignItems: "center" as const,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingVertical: 10,
    paddingHorizontal: 12,
  });

  const featureLabelStyle = {
    fontSize: 12,
    fontWeight: "700" as const,
    color: colors.text,
    marginLeft: 8,
  };

  return (
    <View
      style={[
        styles.footer as any,
        { backgroundColor: colors.background, borderTopColor: colors.border },
      ]}
    >
      <View style={styles.grid as any}>
        {features.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={featureStyle(false)}
            onPress={f.onPress}
            accessibilityRole="button"
            accessibilityLabel={f.label}
          >
            <Ionicons name={f.icon} size={18} color={colors.primary} />
            <Text style={featureLabelStyle}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={[styles.meta as any, { color: colors.subtext }]}>
        Antimicrobial stewardship · WHO GLASS / WHONET / EARS-Net aligned
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    paddingTop: 14,
    paddingBottom: 24,
    paddingHorizontal: 16,
    marginTop: 8,
    width: "100%",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 8,
  },
  feature: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    paddingVertical: 10,
    paddingHorizontal: 12,
    flex: 1,
    minWidth: 150,
  },
  featureLabel: {
    fontSize: 12,
    fontWeight: "700" as const,
    color: "#0F172A",
    marginLeft: 8,
  },
  meta: {
    fontSize: 11,
    textAlign: "center",
    marginTop: 12,
  },
});
