import { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Alert, ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../services/api";
import { BRANDING } from "../constants/branding";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";

const DRUGS = ["Ampicillin", "Ceftriaxone", "Pip-Tazo", "Meropenem", "Vancomycin"];
const SIR = ["S", "I", "R"];

export default function AddLabResultScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: organisms } = useQuery({ queryKey: ["organisms"], queryFn: api.getOrganismsPublic });

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
    val === "S" ? BRANDING.colors.access : val === "I" ? BRANDING.colors.watch : BRANDING.colors.reserve;

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
      queryClient.invalidateQueries({ queryKey: ["antibiogram"] });
      queryClient.invalidateQueries({ queryKey: ["labresults"] });
      Alert.alert("✅ Result Saved", "The antibiogram has been updated in real time.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to save lab result.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      <View style={styles.header}>
        <Text style={styles.title}>Enter Lab Result</Text>
        <Text style={styles.subtitle}>Culture & susceptibility — updates the antibiogram live</Text>
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
        <TextInput style={styles.input} value={patientName} onChangeText={setPatientName} placeholder="Patient name" />
        <TextInput style={[styles.input, { marginTop: 10 }]} value={hospital} onChangeText={setHospital} placeholder="Hospital (defaults to yours)" />
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
                      susceptibility[drug] === v && { color: "#fff" },
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
        style={[styles.submitBtn, loading && { opacity: 0.6 }]}
        onPress={handleSubmit}
        disabled={loading}
      >
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Save Result</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BRANDING.colors.background },
  header: { marginBottom: 20, paddingTop: 60 },
  title: { fontSize: 22, fontWeight: "800", color: BRANDING.colors.text },
  subtitle: { fontSize: 13, color: BRANDING.colors.subtext, marginTop: 4 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: BRANDING.colors.text, marginBottom: 10 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18, backgroundColor: BRANDING.colors.surface, borderWidth: 1, borderColor: BRANDING.colors.border },
  chipActive: { backgroundColor: BRANDING.colors.primary, borderColor: BRANDING.colors.primary },
  chipText: { fontSize: 12, color: BRANDING.colors.text },
  chipTextActive: { color: "#fff", fontWeight: "700" },
  input: { backgroundColor: BRANDING.colors.surface, borderWidth: 1, borderColor: BRANDING.colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: BRANDING.colors.text },
  sirRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  sirDrug: { fontSize: 14, fontWeight: "600", color: BRANDING.colors.text, flex: 1 },
  sirButtons: { flexDirection: "row", gap: 8 },
  sirBtn: { width: 40, height: 36, borderRadius: 8, borderWidth: 1, borderColor: BRANDING.colors.border, backgroundColor: BRANDING.colors.surface, justifyContent: "center", alignItems: "center" },
  sirBtnText: { fontSize: 14, fontWeight: "700", color: BRANDING.colors.subtext },
  hint: { fontSize: 11, color: BRANDING.colors.subtext, marginTop: 4, fontStyle: "italic" },
  submitBtn: { backgroundColor: BRANDING.colors.primary, paddingVertical: 16, borderRadius: 12, alignItems: "center", marginTop: 10 },
  submitBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});