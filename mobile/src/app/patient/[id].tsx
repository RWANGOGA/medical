import { useQuery } from "@tanstack/react-query";
import { StyleSheet, Text, View, ScrollView, ActivityIndicator, TouchableOpacity } from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { api } from "../../services/api";
import { BRANDING } from "../../constants/branding";
import { Ionicons } from "@expo/vector-icons";

export default function PatientDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const { data: patient, isLoading } = useQuery({
    queryKey: ["patient", id],
    queryFn: () => api.getPatientById(id),
  });

  if (isLoading || !patient) return <View style={styles.center}><ActivityIndicator size="large" color={BRANDING.colors.primary} /></View>;

  // Guess the organism ID from the culture result for the CDS engine
  const guessOrganismId = (culture: string) => {
    if (culture.toLowerCase().includes("e. coli")) return "ecoli";
    if (culture.toLowerCase().includes("klebsiella")) return "kpneumo";
    return "ecoli"; // fallback
  };

  const handleRunCDS = () => {
    const orgId = guessOrganismId(patient.culture_results);
    
    // Pass patient-specific constraints directly to the CDS Engine!
    router.push({
      pathname: "/(tabs)/cds",
      params: {
        prefill_organism: orgId,
        prefill_allergy: patient.allergies.some((a: string) => a.toLowerCase().includes("penicillin")) ? "true" : "false",
        prefill_pregnant: patient.pregnancy_status.toLowerCase().includes("not") ? "false" : "true",
        prefill_renal: patient.renal_function.toLowerCase().includes("impair") ? "true" : "false",
      }
    });
  };

  const getOutcomeColor = (outcome: string) => {
    switch (outcome) {
      case "fail": return BRANDING.colors.reserve;
      case "partial": return BRANDING.colors.watch;
      case "success": return BRANDING.colors.access;
      default: return BRANDING.colors.primary;
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: "Patient Chart", headerShadowVisible: false, headerStyle: { backgroundColor: BRANDING.colors.background } }} />
      <ScrollView style={styles.container} contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
        
        {/* Header Profile */}
        <View style={styles.profileCard}>
          <Text style={styles.name}>{patient.name}</Text>
          <Text style={styles.meta}>{patient.age}y · {patient.sex} · {patient.weight_kg}kg</Text>
          <View style={styles.diagnosisBox}>
            <Text style={styles.diagnosisLabel}>Primary Diagnosis</Text>
            <Text style={styles.diagnosisValue}>{patient.diagnosis}</Text>
            <Text style={styles.culture}>{patient.culture_results}</Text>
          </View>
        </View>

        {/* Clinical Constraints */}
        <View style={styles.grid}>
          <View style={styles.gridItem}>
            <Text style={styles.gridLabel}>Pregnancy</Text>
            <Text style={styles.gridValue}>{patient.pregnancy_status}</Text>
          </View>
          <View style={styles.gridItem}>
            <Text style={styles.gridLabel}>Renal</Text>
            <Text style={styles.gridValue}>{patient.renal_function}</Text>
          </View>
          <View style={[styles.gridItem, { borderBottomWidth: 0 }]}>
            <Text style={styles.gridLabel}>Allergies</Text>
            <Text style={styles.gridValue}>{patient.allergies.join(", ") || "None"}</Text>
          </View>
          <View style={[styles.gridItem, { borderBottomWidth: 0 }]}>
            <Text style={styles.gridLabel}>Immune</Text>
            <Text style={styles.gridValue}>{patient.immunocompromised ? "Compromised" : "Intact"}</Text>
          </View>
        </View>

        {/* Timeline */}
        <Text style={styles.sectionTitle}>Antibiotic Timeline</Text>
        <View style={styles.timelineContainer}>
          {patient.antibiotic_timeline.map((item: any, index: number) => (
            <View key={index} style={styles.timelineRow}>
              <View style={styles.timelineLineContainer}>
                <View style={[styles.dot, { backgroundColor: getOutcomeColor(item.outcome) }]} />
                {index < patient.antibiotic_timeline.length - 1 && <View style={styles.line} />}
              </View>
              <View style={styles.timelineContent}>
                <Text style={styles.timelineDate}>{item.date}</Text>
                <Text style={styles.timelineDrug}>{item.drug}</Text>
                <Text style={styles.timelineNote}>{item.note}</Text>
                <View style={[styles.outcomeBadge, { backgroundColor: getOutcomeColor(item.outcome) + "20" }]}>
                  <Text style={[styles.outcomeText, { color: getOutcomeColor(item.outcome) }]}>
                    {item.outcome.toUpperCase()}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* The "Aha!" Funder Button */}
        <TouchableOpacity style={styles.primaryButton} onPress={handleRunCDS}>
          <Ionicons name="sparkles" size={20} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.buttonText}>Generate Rescue Protocol</Text>
        </TouchableOpacity>

      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BRANDING.colors.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  profileCard: { backgroundColor: BRANDING.colors.surface, padding: 20, borderRadius: 16, borderWidth: 1, borderColor: BRANDING.colors.border, marginBottom: 20 },
  name: { fontSize: 22, fontWeight: "800", color: BRANDING.colors.text },
  meta: { color: BRANDING.colors.subtext, marginTop: 4, fontSize: 14 },
  diagnosisBox: { backgroundColor: "#F1F5F9", padding: 12, borderRadius: 12, marginTop: 16 },
  diagnosisLabel: { fontSize: 11, fontWeight: "700", color: BRANDING.colors.subtext, textTransform: "uppercase", letterSpacing: 0.5 },
  diagnosisValue: { fontSize: 16, fontWeight: "600", color: BRANDING.colors.text, marginTop: 4 },
  culture: { color: BRANDING.colors.reserve, fontSize: 13, fontWeight: "600", marginTop: 8, fontStyle: "italic" },
  grid: { backgroundColor: BRANDING.colors.surface, borderRadius: 16, borderWidth: 1, borderColor: BRANDING.colors.border, marginBottom: 24 },
  gridItem: { flexDirection: "row", justifyContent: "space-between", padding: 16, borderBottomWidth: 1, borderBottomColor: BRANDING.colors.border },
  gridLabel: { color: BRANDING.colors.subtext, fontSize: 14 },
  gridValue: { color: BRANDING.colors.text, fontWeight: "600", fontSize: 14 },
  sectionTitle: { fontSize: 18, fontWeight: "800", color: BRANDING.colors.text, marginBottom: 16 },
  timelineContainer: { marginBottom: 30 },
  timelineRow: { flexDirection: "row", minHeight: 80 },
  timelineLineContainer: { width: 30, alignItems: "center" },
  dot: { width: 14, height: 14, borderRadius: 7, zIndex: 1 },
  line: { width: 2, flex: 1, backgroundColor: BRANDING.colors.border },
  timelineContent: { flex: 1, paddingBottom: 24, paddingLeft: 12 },
  timelineDate: { fontSize: 12, color: BRANDING.colors.subtext, fontWeight: "600" },
  timelineDrug: { fontSize: 16, fontWeight: "700", color: BRANDING.colors.text, marginVertical: 4 },
  timelineNote: { fontSize: 13, color: BRANDING.colors.subtext, lineHeight: 18 },
  outcomeBadge: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginTop: 8 },
  outcomeText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  primaryButton: { backgroundColor: BRANDING.colors.primary, flexDirection: "row", justifyContent: "center", alignItems: "center", padding: 18, borderRadius: 16, shadowColor: BRANDING.colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 5 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "800" }
});