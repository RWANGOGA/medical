import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../../services/api";
import { Palette } from "../../../constants/branding";
import { useAssistant } from "../../../context/AssistantContext";
import { HospitalFilter } from "./components/HospitalFilter";
import { AntibioticCard } from "./components/AntibioticCard";

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

  const getAwareColor = (cat: string) => {
    if (cat === "Access") return colors.access;
    if (cat === "Watch") return colors.watch;
    return colors.reserve;
  };

  const frequentAntibiotics = antibiotics?.slice(0, 4) || [];
  const hasCriticalAlert = alerts && alerts.length > 0 && alerts[0] !== "No critical resistance alerts at this time.";

  const styles = makeStyles(colors);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 90 }}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerSub}>MAKERERE COLLEGE OF HEALTH SCIENCES</Text>
            <Text style={styles.headerTitle}>AMR Stewardship</Text>
          </View>
          <View style={styles.headerIcon}>
            <Ionicons name="shield-checkmark" size={18} color={colors.onPrimary} />
          </View>
        </View>
        <TouchableOpacity
          style={styles.searchBar}
          onPress={() => router.push("/(tabs)/search")}
          accessibilityRole="button"
          accessibilityLabel="Search organism or antibiotic"
        >
          <Ionicons name="search" size={17} color={colors.primary} />
          <Text style={styles.searchText}>Search organism or antibiotic…</Text>
        </TouchableOpacity>
      </View>

      {/* Hospital Filter */}
      <HospitalFilter value={hospital} onChange={setHospital} colors={colors} isAuthenticated={false} />

      <View style={styles.content}>
        {/* Critical Alert */}
        {alertsLoading ? (
          <View style={styles.loadingSection}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.loadingText}>Checking alerts…</Text>
          </View>
        ) : hasCriticalAlert ? (
          <View style={styles.alertCard}>
            <View style={styles.alertHeader}>
              <Ionicons name="warning" size={16} color={colors.reserve} />
              <Text style={styles.alertTitle}>Resistance alert</Text>
            </View>
            <Text style={styles.alertText}>{alerts[0]}</Text>
          </View>
        ) : null}

        {/* WHO AWaRe Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            WHO AWaRe category summary{activeHospital ? ` — ${activeHospital}` : ""}
          </Text>
          <View style={styles.card}>
            {awareLoading ? (
              <View style={styles.loadingSection}>
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

        {/* Frequently Used Antibiotics */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Frequently used antibiotics</Text>
          <Text style={styles.sectionHint}>Tap any drug for a clinical summary</Text>

          {antibioticsLoading ? (
            <View style={styles.loadingSection}>
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

        {/* Clinical Assistant CTA */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Clinical Assistant</Text>
          <TouchableOpacity
            style={styles.ctaCard}
            onPress={openAssistant}
            accessibilityRole="button"
            accessibilityLabel="Open clinical assistant"
          >
            <Ionicons name="pulse-outline" size={20} color={colors.primary} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.ctaTitle}>Ask the clinical assistant</Text>
              <Text style={styles.ctaSub}>Resistance mechanisms, treatment choices, drug safety</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.subtext} />
          </TouchableOpacity>
        </View>

        {/* Doctor Login CTA */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>For healthcare professionals</Text>
          <TouchableOpacity
            style={styles.ctaCard}
            onPress={() => router.push("/login")}
            accessibilityRole="button"
            accessibilityLabel="Doctor login"
          >
            <Ionicons name="log-in" size={20} color={colors.primary} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.ctaTitle}>Doctor login</Text>
              <Text style={styles.ctaSub}>Access patient management, CDS engine, and clinical tools</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.subtext} />
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },

    header: {
      backgroundColor: c.primary,
      padding: 20,
      borderBottomLeftRadius: 24,
      borderBottomRightRadius: 24,
    },
    headerTop: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 16,
    },
    headerSub: { color: c.onPrimary, opacity: 0.75, fontSize: 11, fontWeight: "600", letterSpacing: 0.5 },
    headerTitle: { color: c.onPrimary, fontSize: 22, fontWeight: "800", marginTop: 4 },
    headerIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: "rgba(255,255,255,0.15)",
      justifyContent: "center",
      alignItems: "center",
    },
    searchBar: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: c.surface,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      gap: 8,
    },
    searchText: { fontSize: 14, color: c.subtext },

    content: { padding: 16 },
    section: { marginBottom: 20 },
    sectionTitle: {
      fontSize: 11,
      fontWeight: "700",
      color: c.subtext,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: 4,
      marginTop: 10,
    },
    sectionHint: { fontSize: 12, color: c.subtext, marginBottom: 12 },

    loadingSection: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingVertical: 16,
      justifyContent: "center",
    },
    loadingText: { fontSize: 12, color: c.subtext },

    card: {
      backgroundColor: c.surface,
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
    },

    alertCard: {
      backgroundColor: c.dangerSoft,
      padding: 14,
      borderRadius: 12,
      marginBottom: 10,
      borderLeftWidth: 3,
      borderLeftColor: c.reserve,
    },
    alertHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
    alertTitle: { fontSize: 13, fontWeight: "700", color: c.reserve },
    alertText: { fontSize: 12, color: c.text, lineHeight: 17 },

    awareRow: { flexDirection: "row", justifyContent: "space-around" },
    awareItem: { alignItems: "center" },
    awareCount: { fontSize: 28, fontWeight: "800" },
    awareLabel: { fontSize: 11, color: c.subtext, marginTop: 4 },

    viewAllButton: {
      paddingVertical: 12,
      alignItems: "center",
    },
    viewAllText: { fontSize: 13, color: c.primary, fontWeight: "600" },

    ctaCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: c.surface,
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
    },
    ctaTitle: { fontSize: 15, fontWeight: "700", color: c.text },
    ctaSub: { fontSize: 12, color: c.subtext, marginTop: 2 },

    emptyText: { fontSize: 13, color: c.subtext, textAlign: "center", marginTop: 20 },
  });
}
