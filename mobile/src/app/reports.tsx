import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../services/api";
import { Palette } from "../constants/branding";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { NavigationBar } from "../components/navigation-bar";
import { AppFooter } from "../components/footer";
import { useResponsive } from "../utils/responsive";

export default function ReportsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { isAuthenticated } = useAuth();
  const insets = useSafeAreaInsets();
  const { isTabletOrLarger } = useResponsive();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [hospital, setHospital] = useState<string | undefined>(undefined);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["report-summary", hospital],
    queryFn: () => api.getReportSummary(hospital),
    enabled: isAuthenticated,
  });

  if (!isAuthenticated) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.text }}>Sign in to view reports.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 120 }}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.title}>Stewardship Report</Text>
        <Text style={styles.subtitle}>Aggregate surveillance & resistance summary</Text>
      </View>

      <NavigationBar colors={colors} />

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : isError || !data ? (
        <View style={styles.center}>
          <Text style={{ color: colors.subtext }}>Failed to load report.</Text>
          <TouchableOpacity onPress={() => refetch()} style={styles.retryBtn}>
            <Text style={{ color: colors.onPrimary, fontWeight: "700" }}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.content}>
          <Text style={styles.meta}>Generated {new Date(data.generated_at).toLocaleString()} · {data.scope}</Text>

          {/* Workload */}
          <Text style={styles.sectionTitle}>Workload</Text>
          <View style={styles.card}>
            <View style={styles.statRow}>
              <Stat colors={colors} label="Patients" value={data.workload.patients} />
              <Stat colors={colors} label="Lab results" value={data.workload.lab_results} />
              <Stat colors={colors} label="First isolates" value={data.workload.first_isolates} />
              <Stat colors={colors} label="Duplicates" value={data.workload.duplicate_isolates} />
            </View>
            {data.workload.by_hospital?.map((h: any) => (
              <View key={h.hospital} style={styles.row}>
                <Text style={[styles.rowLabel, { color: colors.text }]}>{h.hospital}</Text>
                <Text style={[styles.rowValue, { color: colors.primary }]}>{h.patients} patients</Text>
              </View>
            ))}
          </View>

          {/* AWaRe */}
          <Text style={styles.sectionTitle}>WHO AWaRe</Text>
          <View style={styles.card}>
            <View style={styles.statRow}>
              {data.aware.map((a: any) => (
                <Stat key={a.category} colors={colors} label={a.category} value={a.antibiotics} />
              ))}
            </View>
          </View>

          {/* Quality */}
          <Text style={styles.sectionTitle}>Surveillance data quality (WHO GLASS)</Text>
          <View style={styles.card}>
            {[
              ["Isolates with patient identity (%)", data.quality.identified_pct],
              ["Isolates with infection origin (%)", data.quality.origin_known_pct],
              ["Isolates with AST standard (%)", data.quality.ast_standard_pct],
              ["Invasive isolates (%)", data.quality.invasive_pct],
              ["Isolates with S/I/R result (%)", data.quality.sir_pct],
            ].map(([label, val]) => (
              <View key={label as string} style={styles.row}>
                <Text style={[styles.rowLabel, { color: colors.text }]}>{label}</Text>
                <Text style={[styles.rowValue, { color: colors.primary }]}>{val}%</Text>
              </View>
            ))}
            <Text style={[styles.hint, { color: colors.subtext }]}>First-isolate window: {data.quality.dedup_window_days} days</Text>
          </View>

          {/* Antibiogram */}
          <Text style={styles.sectionTitle}>Antibiogram (first isolates)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator>
            <View style={styles.table}>
              <View style={styles.tableRow}>
                <Text style={[styles.tableHeader, { color: colors.text, minWidth: 120 }]}>Organism</Text>
                {data.antibiogram.drugs.map((d: string) => (
                  <Text key={d} style={[styles.tableHeader, { color: colors.text }]}>{d}</Text>
                ))}
              </View>
              {data.antibiogram.rows.map((row: any) => (
                <View key={row.organism} style={styles.tableRow}>
                  <Text style={[styles.tableCell, { color: colors.text, minWidth: 120, fontStyle: "italic" }]}>{row.organism}</Text>
                  {row.cells.map((c: any) => (
                    <Text key={c.drug} style={[styles.tableCell, { color: c.pct_r && c.pct_r >= 50 ? colors.reserve : colors.text }]}>
                      {c.n ? `${c.pct_s ?? "-"}%` : "—"}
                    </Text>
                  ))}
                </View>
              ))}
            </View>
          </ScrollView>

          {/* Alerts */}
          {data.alerts.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>High-resistance alerts (≥50% R)</Text>
              <View style={styles.card}>
                {data.alerts.map((a: any, i: number) => (
                  <View key={i} style={styles.row}>
                    <Text style={[styles.rowLabel, { color: colors.reserve }]}>{a.organism} vs {a.drug}</Text>
                    <Text style={[styles.rowValue, { color: colors.reserve }]}>{a.pct_r}% R</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* Download CSV */}
          <TouchableOpacity
            style={[styles.downloadBtn, { backgroundColor: colors.primary }]}
            onPress={() => {
              const url = api.reportUrl();
              if (typeof window !== "undefined") window.open(url, "_blank");
            }}
          >
            <Ionicons name="download-outline" size={18} color={colors.onPrimary} />
            <Text style={{ color: colors.onPrimary, fontWeight: "700", marginLeft: 8 }}>Download CSV report</Text>
          </TouchableOpacity>

          <AppFooter colors={colors} />
        </View>
      )}
    </ScrollView>
  );
}

function Stat({ colors, label, value }: { colors: Palette; label: string; value: any }) {
  return (
    <View style={{ alignItems: "center", flex: 1 }}>
      <Text style={{ fontSize: 24, fontWeight: "800", color: colors.primary }}>{value}</Text>
      <Text style={{ fontSize: 10, color: colors.subtext, marginTop: 2, textAlign: "center" }}>{label}</Text>
    </View>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    header: { backgroundColor: c.primary, padding: 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
    title: { fontSize: 22, fontWeight: "800", color: c.onPrimary },
    subtitle: { fontSize: 13, color: c.onPrimary, opacity: 0.8, marginTop: 4 },
    content: { padding: 16 },
    center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
    meta: { fontSize: 11, color: c.subtext, marginBottom: 16 },
    sectionTitle: { fontSize: 11, fontWeight: "700", color: c.subtext, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8, marginTop: 12 },
    card: { backgroundColor: c.surface, borderRadius: 12, borderWidth: 1, borderColor: c.border, padding: 14, marginBottom: 12 },
    statRow: { flexDirection: "row", justifyContent: "space-around", marginBottom: 8 },
    row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderTopWidth: 1, borderTopColor: c.border },
    rowLabel: { fontSize: 13, flex: 1 },
    rowValue: { fontSize: 13, fontWeight: "700" },
    hint: { fontSize: 11, marginTop: 8 },
    table: { borderWidth: 1, borderColor: c.border, borderRadius: 8 },
    tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: c.border },
    tableHeader: { padding: 8, fontSize: 11, fontWeight: "700", minWidth: 70, textAlign: "center" },
    tableCell: { padding: 8, fontSize: 11, minWidth: 70, textAlign: "center" },
    retryBtn: { marginTop: 12, backgroundColor: c.primary, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10 },
    downloadBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 14, borderRadius: 12, marginTop: 16 },
  });
}