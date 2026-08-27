import { useEffect, useMemo, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Alert, ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../services/api";
import { Palette } from "../constants/branding";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";

const DRUGS = ["Ampicillin", "Ceftriaxone", "Pip-Tazo", "Meropenem", "Vancomycin"];
const SIR = ["S", "I", "R"];

export default function AddLabResultScreen() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const queryClient = useQueryClient();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [authLoading, isAuthenticated]);

  const { data: organisms } = useQuery({
    queryKey: ["organisms"],
    queryFn: api.getOrganismsPublic,
    enabled: isAuthenticated,
  });

  const [organismId, setOrganismId] = useState("ecoli");
  const [specimen, setSpecimen] = useState("Urine");
  const [patientName, setPatientName] = useState("");
  const [hospital, setHospital] = useState("");
  const [susceptibility, setSusceptibility] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const setSir = (drug: string, val: string) => {
    setSusceptibility((prev) => ({
      ...prev,
      [drug]: prev[drug] === val ? "" : val, // tap again to clear
    }));
  };

  const sirColor = (val: string) =>
    val === "S" ? colors.access : val === "I" ? colors.watch : colors.reserve;

  const handleSubmit = async () => {
    const filled = Object.values(susceptibility).filter(Boolean);
    if (filled.length === 0) {
      Alert.alert("Missing Data", "Select at least one S/I/R result.");
      return;
    }
    setLoading(true);
    try {
      await api.addLabResult({
        patient_name: patientName,
        organism_id: organismId,
        specimen,
        hospital: hospital || user?.hospital || "",
        susceptibility,
      });
      // Refresh the antibiogram so the dashboard updates immediately
      // Also invalidate patients and lab results so recent patients updates
      queryClient.invalidateQueries({ queryKey: ["antibiogram"] });
      queryClient.invalidateQueries({ queryKey: ["labresults"] });
      queryClient.invalidateQueries({ queryKey: ["lab-results"] });
      queryClient.invalidateQueries({ queryKey: ["patients"] });
      queryClient.invalidateQueries({ queryKey: ["recent-lab-results"] });
      Alert.alert("Result Saved", "The antibiogram has been updated.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to save lab result.");
    } finally {
      setLoading(false);
    }
  };

  // Show loading state while checking auth
  if (authLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20, paddingBottom: 40, paddingTop: insets.top + 16 }}>
      <View style={styles.column}>
        <View style={styles.header}>
          <Text style={styles.title}>Enter Lab Result</Text>
          <Text style={styles.subtitle}>Culture and susceptibility — updates the antibiogram</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Organism</Text>
          <View style={styles.chipRow}>
            {(organisms || []).map((o: any) => (
              <TouchableOpacity
                key={o.id}
                style={[styles.chip, organismId === o.id && styles.chipActive]}
                onPress={() => setOrganismId(o.id)}
              >
                <Text style={[styles.chipText, organismId === o.id && styles.chipTextActive]} numberOfLines={1}>
                  {o.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Specimen</Text>
          <View style={styles.chipRow}>
            {["Urine", "Blood", "Sputum", "Wound swab"].map((s) => (
              <TouchableOpacity
                key={s}
                style={[styles.chip, specimen === s && styles.chipActive]}
                onPress={() => setSpecimen(s)}
              >
                <Text style={[styles.chipText, specimen === s && styles.chipTextActive]}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Patient (optional)</Text>
          <TextInput style={styles.input} value={patientName} onChangeText={setPatientName} placeholder="Patient name" placeholderTextColor={colors.subtext} />
          <TextInput style={[styles.input, { marginTop: 10 }]} value={hospital} onChangeText={setHospital} placeholder="Hospital (defaults to yours)" placeholderTextColor={colors.subtext} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Susceptibility (S / I / R)</Text>
          {DRUGS.map((drug) => (
            <View key={drug} style={styles.sirRow}>
              <Text style={styles.sirDrug}>{drug}</Text>
              <View style={styles.sirButtons}>
                {SIR.map((v) => (
                  <TouchableOpacity
                    key={v}
                    style={[
                      styles.sirBtn,
                      susceptibility[drug] === v && { backgroundColor: sirColor(v), borderColor: sirColor(v) },
                    ]}
                    onPress={() => setSir(drug, v)}
                  >
                    <Text
                      style={[
                        styles.sirBtnText,
                        susceptibility[drug] === v && { color: colors.onPrimary },
                      ]}
                    >
                      {v}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}
          <Text style={styles.hint}>Tap a letter to set it; tap again to clear.</Text>
        </View>

        <TouchableOpacity
          style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={styles.submitBtnText}>Save Result</Text>}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    column: { maxWidth: 720, width: "100%", alignSelf: "center" },
    header: { marginBottom: 20 },
    title: { fontSize: 22, fontWeight: "800", color: c.text },
    subtitle: { fontSize: 13, color: c.subtext, marginTop: 4 },
    section: { marginBottom: 20 },
    sectionTitle: { fontSize: 13, fontWeight: "700", color: c.text, marginBottom: 10 },
    chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },
    chipActive: { backgroundColor: c.primary, borderColor: c.primary },
    chipText: { fontSize: 12, color: c.text },
    chipTextActive: { color: c.onPrimary, fontWeight: "700" },
    input: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: c.text },
    sirRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
    sirDrug: { fontSize: 14, fontWeight: "600", color: c.text, flex: 1 },
    sirButtons: { flexDirection: "row", gap: 8 },
    sirBtn: { width: 40, height: 36, borderRadius: 8, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, justifyContent: "center", alignItems: "center" },
    sirBtnText: { fontSize: 14, fontWeight: "700", color: c.subtext },
    hint: { fontSize: 11, color: c.subtext, marginTop: 4, fontStyle: "italic" },
    submitBtn: { backgroundColor: c.primary, paddingVertical: 16, borderRadius: 12, alignItems: "center", marginTop: 10 },
    submitBtnDisabled: { opacity: 0.6 },
    submitBtnText: { color: c.onPrimary, fontSize: 16, fontWeight: "700" },
  });
}
