
import { useMemo, useState } from "react";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router"; // Read pre-filled patient data
import { api } from "../../services/api";
import { Palette } from "../../constants/branding";
import { useTheme } from "../../context/ThemeContext";

export default function CDSScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);

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
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={styles.headerInner}>
          <Text style={styles.title}>Clinical Decision Support</Text>
          <Text style={styles.subtitle}>Generate patient-specific protocols</Text>
        </View>
      </View>

      <View style={styles.column}>
        {/* Organism Selector */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Select Pathogen</Text>
          {loadingOrgs && <ActivityIndicator color={colors.primary} />}
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
            <ToggleRow label="Penicillin / Beta-lactam Allergy" value={allergy} onValueChange={setAllergy} styles={styles} colors={colors} />
            <ToggleRow label="Pregnant" value={pregnant} onValueChange={setPregnant} styles={styles} colors={colors} />
            <ToggleRow label="Renal Impairment" value={renal} onValueChange={setRenal} styles={styles} colors={colors} />
            <ToggleRow label="Severe / Septic Presentation" value={severe} onValueChange={setSevere} styles={styles} colors={colors} />
          </View>
        </View>

        {/* Action Button */}
        <TouchableOpacity
          style={[styles.button, (!selectedOrgId || mutation.isPending) && styles.buttonDisabled]}
          onPress={handleGenerate}
          disabled={!selectedOrgId || mutation.isPending}
        >
          <Text style={styles.buttonText}>
            {mutation.isPending ? "Analyzing protocol..." : "Generate Recommendation"}
          </Text>
        </TouchableOpacity>

        {/* Results */}
        {result && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>3. Treatment Protocol</Text>

            {/* First Line */}
            <ResultCard title="First-Line" color={colors.access} items={result.first_line} styles={styles} />

            {/* Second Line */}
            <ResultCard title="Second-Line" color={colors.watch} items={result.second_line} styles={styles} />

            {/* Reserve */}
            <ResultCard title="Reserve" color={colors.reserve} items={result.reserve} styles={styles} />

            {/* Avoid */}
            {result.avoid && result.avoid.length > 0 && (
              <ResultCard title="Avoid / Contraindicated" color={colors.subtext} items={result.avoid} isAvoid styles={styles} />
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
      </View>
    </ScrollView>
  );
}

// Helper Components
function ToggleRow({ label, value, onValueChange, styles, colors }: any) {
  return (
    <View style={styles.toggleRow}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.border, true: colors.primary }}
        thumbColor={value ? colors.surface : colors.surfaceAlt}
      />
    </View>
  );
}

function ResultCard({ title, color, items, isAvoid, styles }: any) {
  if (!items || items.length === 0) return null;
  return (
    <View style={[styles.resultCard, { borderLeftColor: color }]}>
      <Text style={[styles.resultTitle, { color }]}>{title}</Text>
      {items.map((item: string, idx: number) => (
        <Text key={idx} style={styles.resultItem}>
          {isAvoid ? "– " : "• "} {item}
        </Text>
      ))}
    </View>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    header: {
      backgroundColor: c.surface,
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
      marginBottom: 20,
    },
    headerInner: { maxWidth: 720, width: "100%", alignSelf: "center" },
    title: { color: c.text, fontSize: 22, fontWeight: "800" },
    subtitle: { color: c.subtext, marginTop: 4, fontSize: 13 },
    column: { maxWidth: 720, width: "100%", alignSelf: "center" },
    section: { paddingHorizontal: 20, marginBottom: 24 },
    sectionTitle: { fontSize: 16, fontWeight: "700", color: c.text, marginBottom: 12 },
    chipContainer: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    chip: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
    },
    chipSelected: { backgroundColor: c.primary, borderColor: c.primary },
    chipText: { color: c.text, fontWeight: "600" },
    chipTextSelected: { color: c.onPrimary },
    card: {
      backgroundColor: c.surface,
      padding: 16,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: c.border,
    },
    toggleRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    toggleLabel: { fontSize: 15, color: c.text, flex: 1 },
    button: {
      backgroundColor: c.primary,
      marginHorizontal: 20,
      padding: 16,
      borderRadius: 12,
      alignItems: "center",
      marginBottom: 30,
    },
    buttonDisabled: { opacity: 0.5 },
    buttonText: { color: c.onPrimary, fontSize: 16, fontWeight: "bold" },
    resultCard: {
      backgroundColor: c.surface,
      padding: 16,
      borderRadius: 12,
      borderLeftWidth: 4,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: c.border,
    },
    resultTitle: {
      fontSize: 14,
      fontWeight: "800",
      marginBottom: 8,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    resultItem: { fontSize: 15, color: c.text, lineHeight: 22 },
    reasoningBox: {
      backgroundColor: c.surfaceAlt,
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
      marginTop: 8,
    },
    reasoningTitle: { fontSize: 14, fontWeight: "700", color: c.subtext, marginBottom: 8 },
    reasoningText: { fontSize: 13, color: c.text, lineHeight: 20, marginBottom: 4 },
    duration: {
      fontSize: 14,
      fontWeight: "600",
      color: c.primary,
      marginTop: 12,
      borderTopWidth: 1,
      borderTopColor: c.border,
      paddingTop: 12,
    },
  });
}
