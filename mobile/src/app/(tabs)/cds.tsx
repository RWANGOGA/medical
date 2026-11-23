
import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  TextInput,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router"; // Read pre-filled patient data
import { api } from "../../services/api";
import { Palette } from "../../constants/branding";
import { useTheme } from "../../context/ThemeContext";
import { useAuth } from "../../context/AuthContext";

const SITES = [
  { label: "Not specified", value: "" },
  { label: "Urinary", value: "urinary" },
  { label: "Blood", value: "blood" },
  { label: "Respiratory", value: "respiratory" },
  { label: "Skin / soft tissue", value: "skin" },
  { label: "Intra-abdominal", value: "intra-abdominal" },
  { label: "CNS", value: "cns" },
];

/**
 * Accepts entries such as "Ceftriaxone: R, Nitrofurantoin=S" or one per line.
 * Unknown text is ignored by the API, so a typo cannot silently change therapy.
 */
function parseSusceptibility(text: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const part of text.split(/[,;\n]+/)) {
    const match = part.trim().match(/^(.+?)\s*[:=]?\s*([SIR])$/i);
    if (match) result[match[1].trim()] = match[2].toUpperCase();
  }
  return result;
}

export default function CDSScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [authLoading, isAuthenticated]);

  // 1. Read pre-filled patient data from the Patient Chart
  const {
    prefill_organism,
    prefill_allergy,
    prefill_pregnant,
    prefill_renal,
    prefill_site,
    prefill_esbl,
    prefill_carbapenemase,
    prefill_mrsa,
  } = useLocalSearchParams();

  // 2. Fetch Organisms for the selector
  const { data: organisms, isLoading: loadingOrgs } = useQuery({
    queryKey: ["organisms"],
    queryFn: api.getOrganisms,
    enabled: isAuthenticated,
  });

  // 3. State for Patient Factors (Initialized with Patient Chart data)
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(
    (prefill_organism as string) || null
  );
  const [allergy, setAllergy] = useState(prefill_allergy === "true");
  const [pregnant, setPregnant] = useState(prefill_pregnant === "true");
  const [renal, setRenal] = useState(prefill_renal === "true");
  const [severe, setSevere] = useState(false);
  const [site, setSite] = useState((prefill_site as string) || "");
  const [esbl, setEsbl] = useState(prefill_esbl === "true");
  const [carbapenemase, setCarbapenemase] = useState(prefill_carbapenemase === "true");
  const [mrsa, setMrsa] = useState(prefill_mrsa === "true");
  const [susceptibilityText, setSusceptibilityText] = useState("");

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
      infection_site: site,
      culture_susceptibility: parseSusceptibility(susceptibilityText),
      esbl,
      carbapenemase,
      mrsa,
    });
  };

  const result = mutation.data;

  // Show loading state while checking auth
  if (authLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

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

        {/* Infection site */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. Infection Site</Text>
          <View style={styles.chipContainer}>
            {SITES.map((option) => (
              <TouchableOpacity
                key={option.value || "unspecified"}
                style={[styles.chip, site === option.value && styles.chipSelected]}
                onPress={() => setSite(option.value)}
              >
                <Text
                  style={[styles.chipText, site === option.value && styles.chipTextSelected]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.helperText}>
            The site changes which agents are appropriate, for example
            nitrofurantoin is urine-only.
          </Text>
        </View>

        {/* Resistance markers */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. Resistance Markers</Text>
          <View style={styles.card}>
            <ToggleRow label="ESBL producer" value={esbl} onValueChange={setEsbl} styles={styles} colors={colors} />
            <ToggleRow label="Carbapenemase producer (CRE/CPE)" value={carbapenemase} onValueChange={setCarbapenemase} styles={styles} colors={colors} />
            <ToggleRow label="MRSA (mecA positive)" value={mrsa} onValueChange={setMrsa} styles={styles} colors={colors} />
          </View>
        </View>

        {/* Culture susceptibility */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5. Culture Susceptibility (optional)</Text>
          <View style={styles.card}>
            <TextInput
              style={[styles.input, { color: colors.text }]}
              value={susceptibilityText}
              onChangeText={setSusceptibilityText}
              placeholder="e.g. Ceftriaxone: R, Nitrofurantoin: S"
              placeholderTextColor={colors.subtext}
              multiline
              autoCapitalize="words"
              accessibilityLabel="Culture susceptibility results"
            />
            <Text style={styles.helperText}>
              Enter one drug per entry as Drug: S, I or R. Results drive the
              recommendation and override empirical choices.
            </Text>
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
            <Text style={styles.sectionTitle}>6. Treatment Protocol</Text>

            {result.culture_directed && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>Culture-directed recommendation</Text>
              </View>
            )}

            {/* Warnings */}
            {result.warnings && result.warnings.length > 0 && (
              <View style={styles.warningBox}>
                <Text style={styles.warningTitle}>Safety Warnings</Text>
                {result.warnings.map((warning: string, idx: number) => (
                  <Text key={idx} style={styles.warningText}>• {warning}</Text>
                ))}
              </View>
            )}

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
    helperText: {
      fontSize: 12,
      color: c.subtext,
      lineHeight: 18,
      marginTop: 8,
    },
    input: {
      minHeight: 64,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 10,
      padding: 12,
      fontSize: 14,
      textAlignVertical: "top",
      backgroundColor: c.background,
    },
    badge: {
      alignSelf: "flex-start",
      backgroundColor: c.access,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
      marginBottom: 12,
    },
    badgeText: {
      color: c.onPrimary,
      fontSize: 12,
      fontWeight: "700",
    },
    warningBox: {
      backgroundColor: c.surfaceAlt,
      borderWidth: 1,
      borderColor: c.watch,
      borderRadius: 12,
      padding: 14,
      marginBottom: 12,
    },
    warningTitle: {
      fontSize: 13,
      fontWeight: "800",
      color: c.watch,
      marginBottom: 6,
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    warningText: {
      fontSize: 13,
      color: c.text,
      lineHeight: 19,
      marginBottom: 4,
    },
  });
}
