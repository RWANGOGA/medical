import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet, Linking } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../services/api";
import { Palette } from "../../constants/branding";
import { downloadApk, openInstallHelp } from "../../constants/downloads";
import { useAssistant } from "../../context/AssistantContext";
import { NavigationBar } from "../../components/navigation-bar";
import { AppFooter } from "../../components/footer";
import { HospitalFilter } from "./components/HospitalFilter";
import { AntibioticCard } from "./components/AntibioticCard";
import { UgandaContext } from "./components/UgandaContext";

const ALL_HOSPITALS = "All Hospitals";

interface PublicHomeProps {
  colors: Palette;
}

export function PublicHome({ colors }: PublicHomeProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { openAssistant } = useAssistant();
  const [hospital, setHospital] = useState(ALL_HOSPITALS);
  const activeHospital = hospital === ALL_HOSPITALS ? undefined : hospital;

  const { data: alerts, isLoading: alertsLoading } = useQuery({
    queryKey: ["alerts", hospital],
    queryFn: () => api.getDashboardAlerts(activeHospital),
  });

  const { data: aware, isLoading: awareLoading } = useQuery({
    queryKey: ["aware", hospital],
    queryFn: () => api.getDashboardAware(activeHospital),
  });

  const { data: antibiotics, isLoading: antibioticsLoading } = useQuery({
    queryKey: ["antibiotics-public"],
    queryFn: api.getAntibioticsPublic,
  });

  const { data: hospitals } = useQuery({
    queryKey: ["hospitals"],
    queryFn: () => api.getHospitals(),
  });

  const getAwareColor = (cat: string) => {
    if (cat === "Access") return colors.access;
    if (cat === "Watch") return colors.watch;
    return colors.reserve;
  };

  const frequentAntibiotics = antibiotics?.slice(0, 4) || [];
  const hasCriticalAlert = alerts && alerts.length > 0 && alerts[0] !== "No critical resistance alerts at this time.";
  const hospitalCount = hospitals?.length ?? 0;
  const antibioticCount = (antibiotics as any[])?.length ?? 0;

  const quickActions = [
    { icon: "search", label: "Search", sub: "Organisms & drugs", color: colors.primary, onPress: () => router.push("/(tabs)/search") },
    { icon: "pulse", label: "Resistance", sub: "Antibiogram", color: colors.reserve, onPress: () => router.push("/(tabs)/resistance") },
    { icon: "analytics", label: "Consumption", sub: "AMC / DDD", color: colors.watch, onPress: () => router.push("/consumption") },
    { icon: "book", label: "Guidelines", sub: "UGG 2023", color: colors.access, onPress: () => router.push("/guidelines") },
    { icon: "newspaper", label: "Publications", sub: "Research library", color: colors.primary, onPress: () => router.push("/(tabs)/publications") },
    { icon: "chatbubble-ellipses", label: "Assistant", sub: "Clinical AI", color: colors.primary, onPress: openAssistant },
  ];

  const styles = makeStyles(colors);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 120 }}>
      {/* Hero */}
      <View style={[styles.hero, { paddingTop: insets.top + 20 }]}>
        <View style={styles.heroTop}>
          <View style={styles.heroBadge}>
            <Ionicons name="shield-checkmark" size={14} color={colors.onPrimary} />
            <Text style={styles.heroBadgeText}>STEWARDSHIP · UGANDA</Text>
          </View>
          <TouchableOpacity
            style={styles.heroIconBtn}
            onPress={() => router.push("/login")}
            accessibilityRole="button"
            accessibilityLabel="Sign in"
          >
            <Ionicons name="log-in-outline" size={18} color={colors.onPrimary} />
          </TouchableOpacity>
        </View>

        <Text style={styles.heroTitle}>Steward AMR</Text>
        <Text style={styles.heroSub}>
          Antimicrobial-resistance surveillance and stewardship for Ugandan hospitals —
          works offline, on any device.
        </Text>

        <View style={styles.heroSearch}>
          <Ionicons name="search" size={18} color={colors.primary} />
          <TouchableOpacity
            style={{ flex: 1 }}
            onPress={() => router.push("/(tabs)/search")}
            accessibilityRole="button"
            accessibilityLabel="Search organism or antibiotic"
          >
            <Text style={styles.heroSearchText}>Search organism or antibiotic…</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.heroCtas}>
          <TouchableOpacity style={styles.heroCtaPrimary} onPress={downloadApk} accessibilityRole="button">
            <Ionicons name="download" size={16} color={colors.onPrimary} />
            <Text style={styles.heroCtaPrimaryText}>Get the app</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.heroCtaSecondary} onPress={openInstallHelp} accessibilityRole="button">
            <Ionicons name="help-circle-outline" size={16} color={colors.onPrimary} />
            <Text style={styles.heroCtaSecondaryText}>Install help</Text>
          </TouchableOpacity>
        </View>

        {/* Stats strip */}
        <View style={styles.statsStrip}>
          <View style={styles.stat}>
            <Text style={styles.statNum}>{hospitalCount || "—"}</Text>
            <Text style={styles.statLabel}>Hospitals</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statNum}>{antibioticCount || "—"}</Text>
            <Text style={styles.statLabel}>Antibiotics</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statNum}>WHO</Text>
            <Text style={styles.statLabel}>GLASS · AWaRe</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statNum}>Offline</Text>
            <Text style={styles.statLabel}>Ready</Text>
          </View>
        </View>
      </View>

      {/* Navigation buttons — available on every page */}
      <NavigationBar colors={colors} />

      {/* Critical alert banner */}
      {alertsLoading ? null : hasCriticalAlert ? (
        <View style={styles.alertBanner}>
          <Ionicons name="warning" size={18} color={colors.onPrimary} />
          <Text style={styles.alertBannerText} numberOfLines={2}>{alerts![0]}</Text>
          <TouchableOpacity onPress={() => router.push("/(tabs)/resistance")}>
            <Text style={styles.alertBannerLink}>View →</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={styles.content}>
        {/* Hospital filter */}
        <HospitalFilter value={hospital} onChange={setHospital} colors={colors} isAuthenticated={false} />

        {/* Quick actions grid */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick access</Text>
          <View style={styles.actionGrid}>
            {quickActions.map((a) => (
              <TouchableOpacity
                key={a.label}
                style={styles.actionTile}
                onPress={a.onPress}
                accessibilityRole="button"
                accessibilityLabel={a.label}
              >
                <View style={[styles.actionIcon, { backgroundColor: a.color + "18" }]}>
                  <Ionicons name={a.icon as any} size={22} color={a.color} />
                </View>
                <Text style={styles.actionLabel}>{a.label}</Text>
                <Text style={styles.actionSub}>{a.sub}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* WHO AWaRe summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            WHO AWaRe category summary{activeHospital ? ` — ${activeHospital}` : ""}
          </Text>
          <View style={styles.card}>
            {awareLoading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : aware && aware.length > 0 ? (
              <View style={styles.awareRow}>
                {aware.map((item: { cat: string; count: number }) => (
                  <View key={item.cat} style={styles.awareItem}>
                    <Text style={[styles.awareCount, { color: getAwareColor(item.cat) }]}>{item.count}</Text>
                    <Text style={styles.awareLabel}>{item.cat}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.emptyText}>No antibiotic data available.</Text>
            )}
          </View>
        </View>

        {/* Uganda clinical context */}
        <UgandaContext colors={colors} />

        {/* Frequently used antibiotics */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Frequently used antibiotics</Text>
          <Text style={styles.sectionHint}>Tap any drug for a clinical summary</Text>

          {antibioticsLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.loadingText}>Loading antibiotics…</Text>
            </View>
          ) : frequentAntibiotics.length > 0 ? (
            <>
              {frequentAntibiotics.map((abx: any) => (
                <AntibioticCard key={abx.id} abx={abx} awareColor={getAwareColor} colors={colors} />
              ))}
              {antibiotics && antibiotics.length > 4 && (
                <TouchableOpacity
                  style={styles.viewAllButton}
                  onPress={() => router.push("/(tabs)/search")}
                >
                  <Text style={styles.viewAllText}>View all {antibiotics.length} antibiotics →</Text>
                </TouchableOpacity>
              )}
            </>
          ) : (
            <Text style={styles.emptyText}>No antibiotic data available.</Text>
          )}
        </View>

        {/* Trust / standards */}
        <View style={styles.trustRow}>
          <View style={styles.trustChip}><Text style={styles.trustText}>WHO GLASS</Text></View>
          <View style={styles.trustChip}><Text style={styles.trustText}>WHONET</Text></View>
          <View style={styles.trustChip}><Text style={styles.trustText}>EARS-Net</Text></View>
          <View style={styles.trustChip}><Text style={styles.trustText}>UCG 2023</Text></View>
          <View style={styles.trustChip}><Text style={styles.trustText}>AWaRe</Text></View>
        </View>

        {/* CTA: clinical assistant */}
        <TouchableOpacity style={styles.ctaCard} onPress={openAssistant} accessibilityRole="button">
          <View style={[styles.ctaIcon, { backgroundColor: colors.primary + "18" }]}>
            <Ionicons name="pulse" size={20} color={colors.primary} />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.ctaTitle}>Ask the clinical assistant</Text>
            <Text style={styles.ctaSub}>Resistance mechanisms, treatment choices, drug safety</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.subtext} />
        </TouchableOpacity>

        {/* CTA: publications */}
        <TouchableOpacity
          style={styles.ctaCard}
          onPress={() => router.push("/(tabs)/publications")}
          accessibilityRole="button"
        >
          <View style={[styles.ctaIcon, { backgroundColor: colors.primary + "18" }]}>
            <Ionicons name="newspaper" size={20} color={colors.primary} />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.ctaTitle}>Latest research & findings</Text>
            <Text style={styles.ctaSub}>Articles, videos, papers on AMR and stewardship</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.subtext} />
        </TouchableOpacity>

        {/* CTA: professional login */}
        <TouchableOpacity
          style={styles.ctaCard}
          onPress={() => router.push("/login")}
          accessibilityRole="button"
        >
          <View style={[styles.ctaIcon, { backgroundColor: colors.primary + "18" }]}>
            <Ionicons name="log-in" size={20} color={colors.primary} />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.ctaTitle}>For healthcare professionals</Text>
            <Text style={styles.ctaSub}>Patient management, CDS engine, audit & reporting</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.subtext} />
        </TouchableOpacity>

        <AppFooter colors={colors} />
      </View>

      {/* Navigation buttons — appear on every page */}
      <NavigationBar colors={colors} />
    </ScrollView>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },

    hero: {
      backgroundColor: c.primary,
      paddingHorizontal: 20,
      paddingBottom: 24,
      borderBottomLeftRadius: 28,
      borderBottomRightRadius: 28,
    },
    heroTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
    heroBadge: {
      flexDirection: "row", alignItems: "center", gap: 6,
      backgroundColor: "rgba(255,255,255,0.18)",
      paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
    },
    heroBadgeText: { color: c.onPrimary, fontSize: 10, fontWeight: "800", letterSpacing: 0.6 },
    heroIconBtn: {
      width: 34, height: 34, borderRadius: 17,
      backgroundColor: "rgba(255,255,255,0.15)",
      justifyContent: "center", alignItems: "center",
    },
    heroTitle: { color: c.onPrimary, fontSize: 30, fontWeight: "900", letterSpacing: -0.5 },
    heroSub: { color: c.onPrimary, opacity: 0.85, fontSize: 14, lineHeight: 20, marginTop: 6, marginBottom: 16 },
    heroSearch: {
      flexDirection: "row", alignItems: "center", gap: 10,
      backgroundColor: c.surface, borderRadius: 14,
      paddingHorizontal: 14, paddingVertical: 12, marginBottom: 14,
    },
    heroSearchText: { fontSize: 14, color: c.subtext },
    heroCtas: { flexDirection: "row", gap: 10, marginBottom: 18 },
    heroCtaPrimary: {
      flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
      backgroundColor: "rgba(255,255,255,0.22)",
      paddingVertical: 12, borderRadius: 12,
      borderWidth: 1, borderColor: "rgba(255,255,255,0.3)",
    },
    heroCtaPrimaryText: { color: c.onPrimary, fontWeight: "700", fontSize: 14 },
    heroCtaSecondary: {
      flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
      backgroundColor: "transparent",
      paddingVertical: 12, borderRadius: 12,
      borderWidth: 1, borderColor: "rgba(255,255,255,0.4)",
    },
    heroCtaSecondaryText: { color: c.onPrimary, fontWeight: "600", fontSize: 14 },

    statsStrip: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      backgroundColor: "rgba(0,0,0,0.18)", borderRadius: 14, paddingVertical: 10, paddingHorizontal: 8,
    },
    stat: { flex: 1, alignItems: "center" },
    statNum: { color: c.onPrimary, fontSize: 15, fontWeight: "800" },
    statLabel: { color: c.onPrimary, opacity: 0.7, fontSize: 9, marginTop: 2, textTransform: "uppercase", letterSpacing: 0.4 },
    statDivider: { width: 1, height: 26, backgroundColor: "rgba(255,255,255,0.25)" },

    alertBanner: {
      flexDirection: "row", alignItems: "center", gap: 10,
      backgroundColor: c.reserve, marginHorizontal: 16, marginTop: 14,
      paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12,
    },
    alertBannerText: { flex: 1, color: c.onPrimary, fontSize: 12, fontWeight: "600" },
    alertBannerLink: { color: c.onPrimary, fontSize: 12, fontWeight: "800" },

    content: { padding: 16 },
    section: { marginBottom: 20 },
    sectionTitle: {
      fontSize: 11, fontWeight: "700", color: c.subtext,
      textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10, marginTop: 4,
    },
    sectionHint: { fontSize: 12, color: c.subtext, marginBottom: 12, marginTop: -6 },
    card: {
      backgroundColor: c.surface, padding: 16, borderRadius: 12,
      borderWidth: 1, borderColor: c.border,
    },
    loadingRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 16, justifyContent: "center" },
    loadingText: { fontSize: 12, color: c.subtext },

    actionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    actionTile: {
      width: "31%", backgroundColor: c.surface, borderRadius: 14,
      padding: 12, borderWidth: 1, borderColor: c.border, alignItems: "flex-start",
    },
    actionIcon: { width: 38, height: 38, borderRadius: 10, justifyContent: "center", alignItems: "center", marginBottom: 8 },
    actionLabel: { fontSize: 13, fontWeight: "700", color: c.text },
    actionSub: { fontSize: 10, color: c.subtext, marginTop: 2 },

    awareRow: { flexDirection: "row", justifyContent: "space-around" },
    awareItem: { alignItems: "center" },
    awareCount: { fontSize: 28, fontWeight: "800" },
    awareLabel: { fontSize: 11, color: c.subtext, marginTop: 4 },

    viewAllButton: { paddingVertical: 12, alignItems: "center" },
    viewAllText: { fontSize: 13, color: c.primary, fontWeight: "600" },

    emptyText: { fontSize: 13, color: c.subtext, textAlign: "center", marginTop: 20 },

    trustRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
    trustChip: {
      paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
      backgroundColor: c.surface, borderWidth: 1, borderColor: c.border,
    },
    trustText: { fontSize: 10, fontWeight: "700", color: c.subtext, letterSpacing: 0.3 },

    ctaCard: {
      flexDirection: "row", alignItems: "center",
      backgroundColor: c.surface, padding: 14, borderRadius: 14,
      borderWidth: 1, borderColor: c.border, marginBottom: 10,
    },
    ctaIcon: { width: 38, height: 38, borderRadius: 10, justifyContent: "center", alignItems: "center" },
    ctaTitle: { fontSize: 14, fontWeight: "700", color: c.text },
    ctaSub: { fontSize: 12, color: c.subtext, marginTop: 2 },
  });
}