import { useRouter, usePathname } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { View, Text, TouchableOpacity, StyleSheet, Platform, ScrollView } from "react-native";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";
import { useOffline } from "../hooks/use-offline";
import { useResponsive } from "../utils/responsive";
import type { Palette } from "../constants/branding";

export interface NavDestination {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
}

/** Destinations available to everyone (public surveillance views). */
export const PUBLIC_NAV_DESTINATIONS: NavDestination[] = [
  { key: "home", label: "Home", icon: "home-outline", route: "/" },
  { key: "search", label: "Search", icon: "search-outline", route: "/search" },
  { key: "resistance", label: "Resistance", icon: "pulse-outline", route: "/resistance" },
  { key: "consumption", label: "Consumption", icon: "bar-chart-outline", route: "/consumption" },
  { key: "guidelines", label: "Guidelines", icon: "book-outline", route: "/guidelines" },
  { key: "publications", label: "Publications", icon: "newspaper-outline", route: "/publications" },
];

/** Destinations that require an authenticated clinician or administrator. */
export const AUTH_NAV_DESTINATIONS: NavDestination[] = [
  { key: "patients", label: "Patients", icon: "people-outline", route: "/patients" },
  { key: "add-patient", label: "Register Patient", icon: "person-add-outline", route: "/add-patient" },
  { key: "add-lab-result", label: "Lab Result", icon: "flask-outline", route: "/add-lab-result" },
  { key: "cds", label: "CDS", icon: "medical-outline", route: "/cds" },
  { key: "audit", label: "Audit", icon: "list-outline", route: "/audit" },
  { key: "reports", label: "Reports", icon: "document-text-outline", route: "/reports" },
];

/**
 * Navigation buttons rendered on top of page content on every screen so
 * users can always move between sections without relying on the bottom tab
 * bar alone (and so the public web version exposes the full feature set).
 */
export function NavigationBar({
  colors,
  destinations,
}: {
  colors: Palette;
  destinations?: NavDestination[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated } = useAuth();
  const { t } = useI18n();
  const { isDesktopOrLarger, isPhone } = useResponsive();
  const { online, pending, syncing, syncNow } = useOffline();

  const items =
    destinations ??
    (isAuthenticated
      ? [...AUTH_NAV_DESTINATIONS, ...PUBLIC_NAV_DESTINATIONS]
      : PUBLIC_NAV_DESTINATIONS);

  const isActive = (route: string) => {
    const current = pathname || "/";
    if (route === "/") return current === "/";
    return current === route || current.startsWith(`${route}/`);
  };

  const labels: Record<string, string> = {
    home: t("nav.home"), search: t("nav.search"), resistance: t("nav.resistance"),
    consumption: t("nav.consumption"), guidelines: t("nav.guidelines"), publications: t("nav.publications"),
    patients: t("nav.patients"), "add-patient": t("nav.registerPatient"), "add-lab-result": t("nav.labResult"),
    cds: t("nav.cds"), audit: t("nav.audit"), reports: "Reports",
  };

  const content = (
    <>
      {Platform.OS !== "web" && !online && (
        <View style={styles.offlineChip} accessibilityRole="alert">
          <Ionicons name="cloud-offline-outline" size={13} color="#B45309" />
          <Text style={styles.offlineText}>
            Offline — showing saved data{pending > 0 ? ` · ${pending} to sync` : ""}
          </Text>
        </View>
      )}
      {Platform.OS !== "web" && online && pending > 0 && (
        <TouchableOpacity
          style={[styles.syncChip, { borderColor: colors.primary }]}
          onPress={syncNow}
          accessibilityRole="button"
          accessibilityLabel={`Sync ${pending} saved changes`}
        >
          <Ionicons
            name={syncing ? "sync" : "cloud-upload-outline"}
            size={13}
            color={colors.primary}
          />
          <Text style={[styles.syncText, { color: colors.primary }]}>
            {syncing ? "Syncing…" : `Sync ${pending} saved change${pending === 1 ? "" : "s"}`}
          </Text>
        </TouchableOpacity>
      )}
      {items.map((item) => {
        const active = isActive(item.route);
        const buttonStyle = {
          flexDirection: "row" as const,
          alignItems: "center" as const,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: active ? colors.primarySoft : colors.surface,
          paddingVertical: 9,
          paddingHorizontal: 12,
          marginRight: 8,
          marginBottom: 8,
        };
        const labelStyle = {
          fontSize: 13,
          fontWeight: "700" as const,
          color: active ? colors.primary : colors.subtext,
          marginLeft: 6,
        };
        return (
          <TouchableOpacity
            key={item.key}
            style={buttonStyle}
            onPress={() => router.push(item.route as never)}
            accessibilityRole="button"
            accessibilityLabel={`Navigate to ${labels[item.key] || item.label}`}
            testID={`nav-${item.key}`}
          >
            <Ionicons name={item.icon} size={16} color={active ? colors.primary : colors.subtext} />
            <Text style={labelStyle} numberOfLines={1}>
              {labels[item.key] || item.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </>
  );

  if (isPhone) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.nav}>
        {content}
      </ScrollView>
    );
  }

  return <View style={[styles.nav, isDesktopOrLarger && styles.navDesktop]}>{content}</View>;
}

const styles = StyleSheet.create({
  nav: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    width: "100%",
  },
  navDesktop: {
    flexWrap: "nowrap",
    overflow: "scroll",
  },
  offlineChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FEF3C7",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginRight: 8,
    marginBottom: 8,
  },
  offlineText: { fontSize: 11.5, fontWeight: "700", color: "#B45309" },
  syncChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginRight: 8,
    marginBottom: 8,
  },
  syncText: { fontSize: 11.5, fontWeight: "700" },
});
