import { useRouter, usePathname } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
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
  const { isDesktopOrLarger } = useResponsive();

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

  return (
    <View style={[styles.nav, isDesktopOrLarger && styles.navDesktop]}>
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
            accessibilityLabel={`Navigate to ${item.label}`}
            testID={`nav-${item.key}`}
          >
            <Ionicons name={item.icon} size={16} color={active ? colors.primary : colors.subtext} />
            <Text style={labelStyle} numberOfLines={1}>
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
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
});
