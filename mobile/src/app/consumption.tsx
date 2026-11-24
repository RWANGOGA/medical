import React, { useMemo, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, ActivityIndicator, Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../services/api";
import { Palette } from "../constants/branding";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { CONTENT_MAX_WIDTH } from "../components/screen";
import { NavigationBar } from "../components/navigation-bar";
import { EmptyState } from "../components/empty-state";
import { AppFooter } from "../components/footer";

const ALL = "All Hospitals";

function awareColor(cat: string, colors: Palette): string {
  if (cat === "Access") return colors.access;
  if (cat === "Watch") return colors.watch;
  if (cat === "Reserve") return colors.reserve;
  return colors.subtext;
}

function Metric({ label, value, colors, styles }: any) {
  return (
    <View style={[styles.metric, { backgroundColor: colors.background }]}>
      <Text style={[styles.metricValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.metricLabel, { color: colors.subtext }]}>{label}</Text>
    </View>
  );
}

function AwareBar({ aware, colors, styles, total }: any) {
  const rows = (aware || []).filter((r: any) => r.ddd > 0);
  if (!rows.length) return <Text style={styles.empty}>No consumption recorded yet.</Text>;
  const access = rows.find((r: any) => r.cat === "Access");
  const target = access?.target ?? 60;
  return (
    <View>
      <View style={[styles.awareTrack, { backgroundColor: colors.background }]}>
        {rows.map((row: any) => (
          <View
            key={row.cat}
            style={{ width: `${row.pct}%`, backgroundColor: awareColor(row.cat, colors) }}
          />
        ))}
      </View>
      <View style={styles.awareLegend}>
        {rows.map((row: any) => (
          <View key={row.cat} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: awareColor(row.cat, colors) }]} />
            <Text style={[styles.legendText, { color: colors.subtext }]}>
              {row.cat} {row.pct}% ({row.ddd} DDD)
            </Text>
          </View>
        ))}
      </View>
      {access && (
        <Text style={[styles.target, { color: access.pct >= target ? colors.access : colors.reserve }]}>
          WHO target: ≥{target}% Access — currently {access.pct}%
          {access.pct < target ? " (increase Access prescribing)" : " (target met)"}
        </Text>
      )}
    </View>
  );
}

function MonthlyBars({ rows, colors, styles }: any) {
  const relevant = (rows || []).filter((r: any) => r.ddd_per_100_patient_days !== null);
  if (!relevant.length) {
    return (
      <Text style={styles.empty}>
        No monthly patient-day denominator recorded. Add one below to see DDD per 100 patient-days.
      </Text>
    );
  }
  const max = Math.max(...relevant.map((r: any) => r.ddd_per_100_patient_days), 1);
  return (
    <View>
      {relevant.map((row: any) => (
        <View key={row.month} style={styles.monthRow}>
          <Text style={[styles.monthLabel, { color: colors.subtext }]}>{row.month}</Text>
          <View style={[styles.barTrack, { backgroundColor: colors.background }]}>
            <View
              style={[
                styles.barFill,
                { width: `${(row.ddd_per_100_patient_days / max) * 100}%`, backgroundColor: colors.primary },
              ]}
            />
          </View>
          <Text style={[styles.barValue, { color: colors.text }]}>{row.ddd_per_100_patient_days}</Text>
        </View>
      ))}
    </View>
  );
}

export default function ConsumptionScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, isAuthenticated } = useAuth();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const queryClient = useQueryClient();

  const [hospital, setHospital] = useState(ALL);
  const [showForm, setShowForm] = useState(false);
  const [showActivity, setShowActivity] = useState(false);
  const active = hospital === ALL ? undefined : hospital;

  const { data: hospitals } = useQuery({ queryKey: ["hospitals"], queryFn: () => api.getHospitals() });
  const { data: antibiotics } = useQuery({ queryKey: ["antibiotics-public"], queryFn: api.getAntibioticsPublic });
  const { data: summary, isLoading } = useQuery({
    queryKey: ["amc-summary", hospital],
    queryFn: () => api.getAmcSummary(active),
  });

  const [drugId, setDrugId] = useState("amoxi");
  const [unit, setUnit] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [duration, setDuration] = useState("7");
  const [dose, setDose] = useState("");
  const [saving, setSaving] = useState(false);

  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [patientDays, setPatientDays] = useState("");
  const [savingActivity, setSavingActivity] = useState(false);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["amc-summary"] });
    queryClient.invalidateQueries({ queryKey: ["amc-use"] });
    queryClient.invalidateQueries({ queryKey: ["amc-activity"] });
  };

  const submitUse = async () => {
    const days = Number(duration);
    if (!drugId || !days || days < 1) {
      Alert.alert("Missing Data", "Choose an antibiotic and enter a duration of at least 1 day.");
      return;
    }
    setSaving(true);
    try {
      await api.recordAmcUse({
        antibiotic_id: drugId,
        hospital: active || user?.hospital || "",
        unit: unit.trim(),
        start_date: startDate,
        duration_days: days,
        daily_dose_mg: dose.trim() ? Number(dose) : null,
      });
      invalidate();
      setShowForm(false);
      Alert.alert("Saved", "Consumption episode recorded. WHO DDD and AWaRe category applied automatically.");
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to record use.");
    } finally {
      setSaving(false);
    }
  };

  const submitActivity = async () => {
    const days = Number(patientDays);
    if (!period || !days || days < 1) {
      Alert.alert("Missing Data", "Enter a YYYY-MM period and patient-days.");
      return;
    }
    setSavingActivity(true);
    try {
      await api.recordAmcActivity({
        hospital: active || user?.hospital || "",
        period,
        patient_days: days,
      });
      invalidate();
      setShowActivity(false);
      Alert.alert("Saved", "Monthly denominator updated.");
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to save denominator.");
    } finally {
      setSavingActivity(false);
    }
  };

  const drugRows = (summary?.by_drug || []).slice(0, 8);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 90 }}>
      {/* Navigation buttons — appear on every page */}
      <NavigationBar colors={colors} />
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={styles.headerInner}>
          <Text style={styles.title}>Antibiotic Consumption</Text>
          <Text style={styles.subtitle}>WHO GLASS-AMC · ATC/DDD and AWaRe reporting</Text>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow} contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingVertical: 10 }}>
        {[ALL, ...(hospitals || [])].map((h) => (
          <TouchableOpacity key={h} style={[styles.chip, hospital === h && styles.chipActive]} onPress={() => setHospital(h)}>
            <Text style={[styles.chipText, hospital === h && styles.chipTextActive]}>{h}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.column}>
        {isLoading ? (
          <ActivityIndicator color={colors.primary} style={{ margin: 30 }} />
        ) : (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>AWaRe group distribution (DDD)</Text>
              <AwareBar aware={summary?.aware} colors={colors} styles={styles} total={summary?.total_ddd} />
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Consumption summary</Text>
              <View style={styles.metricGrid}>
                <Metric label="Total DDD" value={summary?.total_ddd ?? 0} colors={colors} styles={styles} />
                <Metric label="Episodes" value={summary?.episodes ?? 0} colors={colors} styles={styles} />
                <Metric label="Therapy days" value={summary?.total_days_of_therapy ?? 0} colors={colors} styles={styles} />
                <Metric label="Dose estimated" value={`${summary?.estimated_pct ?? 0}%`} colors={colors} styles={styles} />
              </View>
              <Text style={[styles.note, { color: colors.subtext }]}>
                {summary?.estimated_episodes ?? 0} episode(s) used one DDD per day because no dose was recorded.
                {" "}Denominator coverage: {summary?.denominator_coverage_pct ?? 0}%.
              </Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>DDD per 100 patient-days (monthly)</Text>
              <MonthlyBars rows={summary?.by_month} colors={colors} styles={styles} />
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Top antibiotics by DDD</Text>
              {drugRows.length ? (
                drugRows.map((drug: any) => (
                  <View key={drug.antibiotic_id} style={styles.drugRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.drugName, { color: colors.text }]}>{drug.name}</Text>
                      <Text style={[styles.drugMeta, { color: colors.subtext }]}>
                        {drug.aware_category} · {drug.atc_code || "no ATC"}
                      </Text>
                    </View>
                    <Text style={[styles.drugValue, { color: colors.text }]}>
                      {drug.ddd} DDD · {drug.pct}%
                    </Text>
                  </View>
                ))
              ) : (
                <EmptyState colors={colors} icon="flask-outline" title="No consumption data" subtitle="Record antibiotic use to see DDD totals and AWaRe breakdown." />
              )}
            </View>

            {isAuthenticated && (
              <>
                <TouchableOpacity style={styles.actionBtn} onPress={() => setShowForm(!showForm)}>
                  <Text style={[styles.actionText, { color: colors.onPrimary }]}>
                    {showForm ? "Hide" : "+ Record antibiotic use"}
                  </Text>
                </TouchableOpacity>
                {showForm && (
                  <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Antibiotic</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow} contentContainerStyle={{ gap: 8 }}>
                      {(antibiotics || []).map((a: any) => (
                        <TouchableOpacity
                          key={a.id}
                          style={[styles.chip, drugId === a.id && styles.chipActive]}
                          onPress={() => setDrugId(a.id)}
                        >
                          <Text style={[styles.chipText, drugId === a.id && styles.chipTextActive]}>{a.generic_name}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>

                    <Text style={styles.sectionTitle}>Ward / unit</Text>
                    <TextInput style={styles.input} value={unit} onChangeText={setUnit} placeholder="e.g. ICU, Medical ward" placeholderTextColor={colors.subtext} />

                    <Text style={styles.sectionTitle}>Start date (YYYY-MM-DD)</Text>
                    <TextInput style={styles.input} value={startDate} onChangeText={setStartDate} placeholder="2026-05-02" placeholderTextColor={colors.subtext} />

                    <Text style={styles.sectionTitle}>Duration (days)</Text>
                    <TextInput style={styles.input} value={duration} onChangeText={setDuration} keyboardType="numeric" placeholderTextColor={colors.subtext} />

                    <Text style={styles.sectionTitle}>Daily dose in mg (optional)</Text>
                    <TextInput style={styles.input} value={dose} onChangeText={setDose} keyboardType="numeric" placeholder="Leave blank to estimate 1 DDD/day" placeholderTextColor={colors.subtext} />

                    <TouchableOpacity
                      style={[styles.submitBtn, saving && styles.submitDisabled]}
                      onPress={submitUse}
                      disabled={saving}
                    >
                      {saving ? (
                        <ActivityIndicator color={colors.onPrimary} />
                      ) : (
                        <Text style={[styles.actionText, { color: colors.onPrimary }]}>Save episode</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}

                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]} onPress={() => setShowActivity(!showActivity)}>
                  <Text style={[styles.actionText, { color: colors.primary }]}>
                    {showActivity ? "Hide" : "+ Record monthly patient-days"}
                  </Text>
                </TouchableOpacity>
                {showActivity && (
                  <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Month (YYYY-MM)</Text>
                    <TextInput style={styles.input} value={period} onChangeText={setPeriod} placeholder="2026-05" placeholderTextColor={colors.subtext} />
                    <Text style={styles.sectionTitle}>Patient-days</Text>
                    <TextInput style={styles.input} value={patientDays} onChangeText={setPatientDays} keyboardType="numeric" placeholderTextColor={colors.subtext} />
                    <TouchableOpacity
                      style={[styles.submitBtn, savingActivity && styles.submitDisabled]}
                      onPress={submitActivity}
                      disabled={savingActivity}
                    >
                      {savingActivity ? (
                        <ActivityIndicator color={colors.onPrimary} />
                      ) : (
                        <Text style={[styles.actionText, { color: colors.onPrimary }]}>Save denominator</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}

            <View style={styles.card}>
              <Text style={[styles.note, { color: colors.subtext }]}>
                {summary?.method}. {summary?.ddd_source}. DDD is a WHO technical unit, not a prescribed dose —
                use clinical judgement for individual patients.
              </Text>
              <TouchableOpacity onPress={() => router.push("/(tabs)/resistance")}>
                <Text style={[styles.link, { color: colors.primary }]}>View resistance dashboard →</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      {/* Footer with app features — appears on every page */}
      <AppFooter colors={colors} />
    </ScrollView>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    header: { backgroundColor: c.surface, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: c.border },
    headerInner: { paddingHorizontal: 20, width: "100%", maxWidth: CONTENT_MAX_WIDTH, alignSelf: "center" },
    title: { fontSize: 22, fontWeight: "800", color: c.text },
    subtitle: { color: c.subtext, marginTop: 4, fontSize: 13 },
    chipRow: { flexGrow: 0, maxHeight: 60 },
    chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },
    chipActive: { backgroundColor: c.primary, borderColor: c.primary },
    chipText: { fontSize: 12, color: c.text },
    chipTextActive: { color: c.onPrimary, fontWeight: "700" },
    column: { width: "100%", maxWidth: CONTENT_MAX_WIDTH, alignSelf: "center" },
    card: { backgroundColor: c.surface, margin: 16, marginBottom: 0, marginTop: 16, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: c.border },
    cardTitle: { fontSize: 12, fontWeight: "700", color: c.subtext, letterSpacing: 0.5, marginBottom: 12, textTransform: "uppercase" },
    sectionTitle: { fontSize: 12, fontWeight: "700", color: c.text, marginTop: 12, marginBottom: 6 },
    metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    metric: { minWidth: 90, flex: 1, borderRadius: 10, padding: 12, alignItems: "center" },
    metricValue: { fontSize: 18, fontWeight: "800" },
    metricLabel: { fontSize: 10, marginTop: 2 },
    awareTrack: { flexDirection: "row", height: 16, borderRadius: 8, overflow: "hidden" },
    awareLegend: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 10 },
    legendItem: { flexDirection: "row", alignItems: "center" },
    legendDot: { width: 10, height: 10, borderRadius: 5, marginRight: 6 },
    legendText: { fontSize: 11 },
    target: { fontSize: 11, fontWeight: "700", marginTop: 10 },
    monthRow: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
    monthLabel: { width: 52, fontSize: 11 },
    barTrack: { flex: 1, height: 12, borderRadius: 6, overflow: "hidden", marginRight: 8 },
    barFill: { height: 12, borderRadius: 6 },
    barValue: { width: 44, fontSize: 11, fontWeight: "700", textAlign: "right" },
    drugRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.border },
    drugName: { fontSize: 13, fontWeight: "700" },
    drugMeta: { fontSize: 10, marginTop: 2 },
    drugValue: { fontSize: 11, fontWeight: "800" },
    input: { backgroundColor: c.background, borderWidth: 1, borderColor: c.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: c.text, minHeight: 46 },
    actionBtn: { backgroundColor: c.primary, margin: 16, marginBottom: 0, paddingVertical: 14, borderRadius: 12, alignItems: "center" },
    actionText: { fontSize: 13, fontWeight: "700" },
    submitBtn: { backgroundColor: c.primary, marginTop: 16, paddingVertical: 14, borderRadius: 12, alignItems: "center" },
    submitDisabled: { opacity: 0.6 },
    note: { fontSize: 10, lineHeight: 15 },
    link: { fontSize: 12, fontWeight: "700", marginTop: 12 },
    empty: { fontSize: 12, color: c.subtext, lineHeight: 17 },
  });
}
