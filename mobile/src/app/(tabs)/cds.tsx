import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router"; // <-- ADDED: To read patient data
import { api } from "../../services/api";
import { BRANDING } from "../../constants/branding";

export default function CDSScreen() {
  // 1. Read pre-filled patient data from the Patient Chart
  const { prefill_organism, prefill_allergy, prefill_pregnant, prefill_renal } = useLocalSearchParams();

  // 2. Fetch Organisms for the selector
  const { data: organisms, isLoading: loadingOrgs } = useQuery({
    queryKey: ["organisms"],
    queryFn: api.getOrganisms,
  });

  // 3. State for Patient Factors (Initialized with Patient Chart data)
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(
    (prefill_organism as string) || null
  );
  const [allergy, setAllergy] = useState(prefill_allergy === "true");
  const [pregnant, setPregnant] = useState(prefill_pregnant === "true");
  const [renal, setRenal] = useState(prefill_renal === "true");
  const [severe, setSevere] = useState(false);

  // 4. Mutation to call the CDS Engine
  const mutation = useMutation({
    mutationFn: (payload: any) => api.getCDSRecommendation(payload),
    onError: (error: any) => {
      Alert.alert("Error", error.message || "Failed to generate recommendation");
    },
  });

  const handleGenerate = () => {
    if (!selectedOrgId) {
      Alert.alert("Selection Required", "Please select an organism first.");
      return;
    }
    mutation.mutate({
      organism_id: selectedOrgId,
      allergy_penicillin: allergy,
      pregnant: pregnant,
      renal_impairment: renal,
      severe: severe,
    });
  };

  const result = mutation.data;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.header}>
        <Text style={styles.title}>Clinical Decision Support</Text>
        <Text style={styles.subtitle}>Generate patient-specific protocols</Text>
      </View>

      {/* Organism Selector */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>1. Select Pathogen</Text>
        {loadingOrgs && <ActivityIndicator />}
        <View style={styles.chipContainer}>
          {organisms?.map((org: any) => (
            <TouchableOpacity
              key={org.id}
              style={[
                styles.chip,
                selectedOrgId === org.id && styles.chipSelected,
              ]}
              onPress={() => setSelectedOrgId(org.id)}
            >
              <Text
                style={[
                  styles.chipText,
                  selectedOrgId === org.id && styles.chipTextSelected,
                ]}
              >
                {org.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Patient Factors */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>2. Patient Factors</Text>
        <View style={styles.card}>
          <ToggleRow label="Penicillin / Beta-lactam Allergy" value={allergy} onValueChange={setAllergy} />
          <ToggleRow label="Pregnant" value={pregnant} onValueChange={setPregnant} />
          <ToggleRow label="Renal Impairment" value={renal} onValueChange={setRenal} />
          <ToggleRow label="Severe / Septic Presentation" value={severe} onValueChange={setSevere} />
        </View>
      </View>

      {/* Action Button */}
      <TouchableOpacity
        style={[styles.button, (!selectedOrgId || mutation.isPending) && styles.buttonDisabled]}
        onPress={handleGenerate}
        disabled={!selectedOrgId || mutation.isPending}
      >
        <Text style={styles.buttonText}>
          {mutation.isPending ? "Analyzing Protocol..." : "Generate Recommendation"}
        </Text>
      </TouchableOpacity>

      {/* Results */}
      {result && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. Treatment Protocol</Text>
          
          {/* First Line */}
          <ResultCard title="First-Line" color={BRANDING.colors.access} items={result.first_line} />
          
          {/* Second Line */}
          <ResultCard title="Second-Line" color={BRANDING.colors.watch} items={result.second_line} />
          
          {/* Reserve */}
          <ResultCard title="Reserve" color={BRANDING.colors.reserve} items={result.reserve} />

          {/* Avoid */}
          {result.avoid && result.avoid.length > 0 && (
            <ResultCard title="Avoid / Contraindicated" color="#888" items={result.avoid} isAvoid />
          )}

          {/* Reasoning */}
          <View style={styles.reasoningBox}>
             <Text style={styles.reasoningTitle}>Clinical Reasoning</Text>
             {result.reasoning.map((reason: string, idx: number) => (
               <Text key={idx} style={styles.reasoningText}>• {reason}</Text>
             ))}
             <Text style={styles.duration}>Duration: {result.duration}</Text>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

// Helper Components
function ToggleRow({ label, value, onValueChange }: any) {
  return (
    <View style={styles.toggleRow}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: "#D1D5DB", true: BRANDING.colors.primary }}
        thumbColor={"#fff"}
      />
    </View>
  );
}

function ResultCard({ title, color, items, isAvoid }: any) {
  if (!items || items.length === 0) return null;
  return (
    <View style={[styles.resultCard, { borderLeftColor: color }]}>
      <Text style={[styles.resultTitle, { color }]}>{title}</Text>
      {items.map((item: string, idx: number) => (
        <Text key={idx} style={styles.resultItem}>
          {isAvoid ? "⚠️ " : "• "} {item}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BRANDING.colors.background },
  header: { backgroundColor: BRANDING.colors.primary, padding: 20, paddingTop: 60, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, marginBottom: 20 },
  title: { color: "#fff", fontSize: 24, fontWeight: "bold" },
  subtitle: { color: "rgba(255,255,255,0.8)", marginTop: 4 },
  section: { paddingHorizontal: 20, marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: BRANDING.colors.text, marginBottom: 12 },
  chipContainer: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E5E7EB" },
  chipSelected: { backgroundColor: BRANDING.colors.primary, borderColor: BRANDING.colors.primary },
  chipText: { color: BRANDING.colors.text, fontWeight: "600" },
  chipTextSelected: { color: "#fff" },
  card: { backgroundColor: "#fff", padding: 16, borderRadius: 16, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  toggleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  toggleLabel: { fontSize: 15, color: BRANDING.colors.text, flex: 1 },
  button: { backgroundColor: BRANDING.colors.primary, marginHorizontal: 20, padding: 16, borderRadius: 12, alignItems: "center", marginBottom: 30 },
  buttonDisabled: { backgroundColor: "#9CA3AF" },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  resultCard: { backgroundColor: "#fff", padding: 16, borderRadius: 12, borderLeftWidth: 4, marginBottom: 12, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 5, elevation: 1 },
  resultTitle: { fontSize: 14, fontWeight: "800", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 },
  resultItem: { fontSize: 15, color: BRANDING.colors.text, lineHeight: 22 },
  reasoningBox: { backgroundColor: "#F8FAFC", padding: 16, borderRadius: 12, border: 1, borderColor: "#E2E8F0", marginTop: 8 },
  reasoningTitle: { fontSize: 14, fontWeight: "700", color: BRANDING.colors.subtext, marginBottom: 8 },
  reasoningText: { fontSize: 13, color: BRANDING.colors.text, lineHeight: 20, marginBottom: 4 },
  duration: { fontSize: 14, fontWeight: "600", color: BRANDING.colors.primary, marginTop: 12, borderTopWidth: 1, borderTopColor: "#E2E8F0", paddingTop: 12 }
});