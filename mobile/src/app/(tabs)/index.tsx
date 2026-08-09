import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity,
  ActivityIndicator, LayoutAnimation, Platform, UIManager,
} from "react-native";
import { useRouter } from "expo-router";
import { api } from "../../services/api";
import { BRANDING } from "../../constants/branding";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../context/AuthContext";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ============ TYPES ============
interface AntibioticSummary {
  overview: string;
  when_to_use: string[];
  cautions: string[];
  stewardship_note: string;
}

// ============ EXPANDABLE ANTIBIOTIC CARD ============
function AntibioticCard({ abx, awareColor }: { abx: any; awareColor: (c: string) => string }) {
  const [expanded, setExpanded] = useState(false);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => api.summarizeAntibiotic(abx.id),
    onSuccess: (data) => queryClient.setQueryData(["abx-summary", abx.id], data),
  });

  const summary = queryClient.getQueryData<AntibioticSummary>(["abx-summary", abx.id]);

  const handleToggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (!expanded && !summary && !mutation.isPending) mutation.mutate();
    setExpanded(!expanded);
  };

  return (
    <View style={styles.abxCard}>
      <TouchableOpacity style={styles.abxHeader} onPress={handleToggle} activeOpacity={0.8}>
        <View style={styles.abxIconContainer}>
          <Ionicons name="medical-outline" size={16} color={BRANDING.colors.primary} />
        </View>
        <View style={styles.abxTitleContainer}>
          <Text style={styles.abxName}>{abx.generic_name}</Text>
          <Text style={styles.abxClass}>{abx.drug_class}</Text>
        </View>
        <View style={[styles.awareBadge, { backgroundColor: awareColor(abx.aware_category) + "20" }]}>
          <Text style={[styles.awareBadgeText, { color: awareColor(abx.aware_category) }]}>{abx.aware_category}</Text>
        </View>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={16}
          color={BRANDING.colors.subtext}
          style={{ marginLeft: 8 }}
        />
      </TouchableOpacity>

      {expanded && (
        <View style={styles.abxExpanded}>
          <View style={styles.divider} />

          {mutation.isPending && !summary && (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={BRANDING.colors.primary} />
              <Text style={styles.loadingText}>Generating summary…</Text>
            </View>
          )}

          {mutation.isError && (
            <TouchableOpacity style={styles.errorRow} onPress={() => mutation.mutate()}>
              <Ionicons name="alert-circle" size={14} color={BRANDING.colors.reserve} />
              <Text style={styles.errorText}>Failed to load. Tap to retry.</Text>
            </TouchableOpacity>
          )}

          {summary && (
            <>
              <Text style={styles.abxOverview}>{summary.overview}</Text>

              <Text style={styles.abxSubLabel}>Preferred indications</Text>
              {summary.when_to_use.map((b, i) => (
                <View key={i} style={styles.bulletItem}>
                  <View style={[styles.bulletDot, { backgroundColor: BRANDING.colors.access }]} />
                  <Text style={styles.bulletText}>{b}</Text>
                </View>
              ))}

              <Text style={styles.abxSubLabel}>Key cautions</Text>
              {summary.cautions.map((b, i) => (
                <View key={i} style={styles.bulletItem}>
                  <View style={[styles.bulletDot, { backgroundColor: BRANDING.colors.reserve }]} />
                  <Text style={styles.bulletText}>{b}</Text>
                </View>
              ))}

              <View style={styles.stewardshipBox}>
                <Ionicons name="leaf-outline" size={14} color={BRANDING.colors.access} style={{ marginTop: 2 }} />
                <Text style={styles.stewardshipText}>{summary.stewardship_note}</Text>
              </View>
            </>
          )}
        </View>
      )}
    </View>
  );
}

// ============ DOCTOR'S DASHBOARD (shown after login) ============
function DoctorDashboard({ user }: { user: any }) {
  const router = useRouter();
  const { data: patients } = useQuery({ queryKey: ["patients"], queryFn: api.getPatients });
  const { data: alerts } = useQuery({ queryKey: ["alerts"], queryFn: api.getDashboardAlerts });

  const patientCount = patients?.length || 0;
  const criticalAlerts = alerts?.filter((a: string) => !a.includes("No critical")) || [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 90 }}>
      <View style={styles.dashboardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.welcomeText}>Clinical Dashboard</Text>
          <Text style={styles.doctorName}>{user?.full_name || "Doctor"}</Text>
          <Text style={styles.hospitalText}>{user?.hospital}</Text>
        </View>
      </View>

      <View style={styles.content}>
        {criticalAlerts.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Critical Alerts ({criticalAlerts.length})</Text>
            {criticalAlerts.map((alert: string, i: number) => (
              <View key={i} style={styles.alertCard}>
                <View style={styles.alertHeader}>
                  <Ionicons name="warning" size={16} color={BRANDING.colors.reserve} />
                  <Text style={styles.alertTitle}>Resistance alert</Text>
                </View>
                <Text style={styles.alertText}>{alert}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.statsRow}>
          <TouchableOpacity style={styles.statCard} onPress={() => router.push("/(tabs)/patients")}>
            <Ionicons name="people" size={28} color={BRANDING.colors.primary} />
            <Text style={styles.statValue}>{patientCount}</Text>
            <Text style={styles.statLabel}>Patients</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.statCard} onPress={() => router.push("/(tabs)/search")}>
            <Ionicons name="search" size={28} color={BRANDING.colors.watch} />
            <Text style={styles.statValue}>Search</Text>
            <Text style={styles.statLabel}>Clinical Data</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>

          {/* Add New Patient */}
          <TouchableOpacity style={styles.actionCard} onPress={() => router.push("/add-patient")}>
            <View style={[styles.actionIcon, { backgroundColor: BRANDING.colors.access + "15" }]}>
              <Ionicons name="person-add" size={24} color={BRANDING.colors.access} />
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Add New Patient</Text>
              <Text style={styles.actionSub}>Create a new patient record with duplicate check</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={BRANDING.colors.subtext} />
          </TouchableOpacity>

          {/* Enter Lab Result */}
          <TouchableOpacity style={styles.actionCard} onPress={() => router.push("/add-lab-result")}>
            <View style={[styles.actionIcon, { backgroundColor: BRANDING.colors.watch + "15" }]}>
              <Ionicons name="flask" size={24} color={BRANDING.colors.watch} />
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Enter Lab Result</Text>
              <Text style={styles.actionSub}>Add culture & susceptibility — updates antibiogram live</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={BRANDING.colors.subtext} />
          </TouchableOpacity>

          {/* Manage Patients */}
          <TouchableOpacity style={styles.actionCard} onPress={() => router.push("/(tabs)/patients")}>
            <View style={[styles.actionIcon, { backgroundColor: BRANDING.colors.primary + "15" }]}>
              <Ionicons name="people" size={24} color={BRANDING.colors.primary} />
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Manage Patients</Text>
              <Text style={styles.actionSub}>View and track all patient records</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={BRANDING.colors.subtext} />
          </TouchableOpacity>

          {/* Clinical Decision Support */}
          <TouchableOpacity style={styles.actionCard} onPress={() => router.push("/cds")}>
            <View style={[styles.actionIcon, { backgroundColor: BRANDING.colors.watch + "15" }]}>
              <Ionicons name="medical" size={24} color={BRANDING.colors.watch} />
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Clinical Decision Support</Text>
              <Text style={styles.actionSub}>Generate treatment recommendations</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={BRANDING.colors.subtext} />
          </TouchableOpacity>

          {/* Clinical Guidelines */}
          <TouchableOpacity style={styles.actionCard} onPress={() => router.push("/(tabs)/guidelines")}>
            <View style={[styles.actionIcon, { backgroundColor: BRANDING.colors.reserve + "15" }]}>
              <Ionicons name="book" size={24} color={BRANDING.colors.reserve} />
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Clinical Guidelines</Text>
              <Text style={styles.actionSub}>Treatment protocols and pathogen profiles</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={BRANDING.colors.subtext} />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Patients</Text>
          {patients && patients.length > 0 ? (
            patients.slice(0, 3).map((patient: any) => (
              <TouchableOpacity
                key={patient.id}
                style={styles.patientCard}
                onPress={() => router.push(`/patient/${patient.id}`)}
              >
                <View style={styles.patientHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.patientName}>{patient.name}</Text>
                    <Text style={styles.patientMeta}>
                      {patient.age}y · {patient.sex} · {patient.diagnosis || "No diagnosis"}
                    </Text>
                  </View>
                </View>
                {patient.culture_results && (
                  <Text style={styles.cultureText}>Culture: {patient.culture_results}</Text>
                )}
              </TouchableOpacity>
            ))
          ) : (
            <Text style={styles.emptyText}>No patients yet. Tap "Add New Patient" to create one.</Text>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

// ============ PUBLIC HOME (shown before login) ============
function PublicHome() {
  const router = useRouter();
  const { data: alerts } = useQuery({ queryKey: ["alerts"], queryFn: api.getDashboardAlerts });
  const { data: aware } = useQuery({ queryKey: ["aware"], queryFn: api.getDashboardAware });
  const { data: antibiotics } = useQuery({ queryKey: ["antibiotics"], queryFn: api.getAntibioticsPublic });

  const getAwareColor = (cat: string) => {
    if (cat === "Access") return BRANDING.colors.access;
    if (cat === "Watch") return BRANDING.colors.watch;
    return BRANDING.colors.reserve;
  };

  const frequentAntibiotics = antibiotics?.slice(0, 4) || [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 90 }}>
      <View style={styles.publicHeader}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerSub}>MAKERERE COLLEGE OF HEALTH SCIENCES</Text>
            <Text style={styles.headerTitle}>AMR Stewardship</Text>
          </View>
          <View style={styles.headerIcon}>
            <Ionicons name="shield-checkmark" size={18} color="#fff" />
          </View>
        </View>
        <TouchableOpacity style={styles.searchBar} onPress={() => router.push("/(tabs)/search")}>
          <Ionicons name="search" size={17} color={BRANDING.colors.primary} />
          <Text style={styles.searchText}>Search organism or antibiotic…</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {alerts && alerts.length > 0 && alerts[0] !== "No critical resistance alerts at this time." && (
          <View style={styles.alertCard}>
            <View style={styles.alertHeader}>
              <Ionicons name="warning" size={16} color={BRANDING.colors.reserve} />
              <Text style={styles.alertTitle}>Resistance alert</Text>
            </View>
            <Text style={styles.alertText}>{alerts[0]}</Text>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>WHO AWaRe category summary</Text>
          <View style={styles.card}>
            {aware ? (
              <View style={styles.awareRow}>
                {aware.map((item) => (
                  <View key={item.cat} style={styles.awareItem}>
                    <Text style={[styles.awareCount, { color: getAwareColor(item.cat) }]}>{item.count}</Text>
                    <Text style={styles.awareLabel}>{item.cat}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <ActivityIndicator />
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Frequently used antibiotics</Text>
          <Text style={styles.sectionHint}>Tap any drug for an AI-generated clinical summary</Text>
          {frequentAntibiotics.map((abx: any) => (
            <AntibioticCard key={abx.id} abx={abx} awareColor={getAwareColor} />
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>For healthcare professionals</Text>
          <TouchableOpacity style={styles.loginCard} onPress={() => router.push("/login")}>
            <Ionicons name="log-in" size={20} color={BRANDING.colors.primary} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.loginTitle}>Doctor login</Text>
              <Text style={styles.loginSub}>Access patient management, CDS engine, and clinical tools</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={BRANDING.colors.subtext} />
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

// ============ MAIN EXPORT ============
export default function HomeScreen() {
  const { isAuthenticated, user, isLoading } = useAuth();

  // Show a clean loading state while auth is being resolved
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={BRANDING.colors.primary} />
        <Text style={styles.loadingText}>Loading…</Text>
      </View>
    );
  }

  if (isAuthenticated && user) {
    return <DoctorDashboard user={user} />;
  }

  return <PublicHome />;
}

// ============ STYLES ============
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BRANDING.colors.background },

  // Loading state
  loadingContainer: { 
    flex: 1, 
    justifyContent: "center", 
    alignItems: "center", 
    backgroundColor: BRANDING.colors.background,
    gap: 12,
  },
  loadingText: { 
    fontSize: 14, 
    color: BRANDING.colors.subtext,
    fontWeight: "600",
  },

  // Headers
  dashboardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: BRANDING.colors.primary, padding: 20, paddingTop: 60, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  welcomeText: { color: "rgba(255,255,255,0.8)", fontSize: 12, fontWeight: "600", letterSpacing: 0.5 },
  doctorName: { color: "#fff", fontSize: 24, fontWeight: "800", marginTop: 4 },
  hospitalText: { color: "rgba(255,255,255,0.9)", fontSize: 12, marginTop: 4 },
  publicHeader: { backgroundColor: BRANDING.colors.primary, padding: 20, paddingTop: 60, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  headerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  headerSub: { color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: "600", letterSpacing: 0.5 },
  headerTitle: { color: "#fff", fontSize: 22, fontWeight: "800", marginTop: 4 },
  headerIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.15)", justifyContent: "center", alignItems: "center" },
  searchBar: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  searchText: { fontSize: 14, color: "#5C7285" },

  // Content
  content: { padding: 16 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 11, fontWeight: "700", color: BRANDING.colors.subtext, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4, marginTop: 10 },
  sectionHint: { fontSize: 12, color: BRANDING.colors.subtext, marginBottom: 12, fontStyle: "italic" },
  card: { backgroundColor: BRANDING.colors.surface, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: BRANDING.colors.border },

  // Alerts
  alertCard: { backgroundColor: "#FFF5F5", padding: 14, borderRadius: 12, marginBottom: 10, borderLeftWidth: 3, borderLeftColor: BRANDING.colors.reserve },
  alertHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  alertTitle: { fontSize: 13, fontWeight: "700", color: BRANDING.colors.reserve },
  alertText: { fontSize: 12, color: BRANDING.colors.text, lineHeight: 17 },

  // Stats & Actions
  statsRow: { flexDirection: "row", gap: 12, marginBottom: 20 },
  statCard: { flex: 1, backgroundColor: BRANDING.colors.surface, padding: 16, borderRadius: 12, alignItems: "center", borderWidth: 1, borderColor: BRANDING.colors.border },
  statValue: { fontSize: 20, fontWeight: "800", color: BRANDING.colors.text, marginTop: 8 },
  statLabel: { fontSize: 11, color: BRANDING.colors.subtext, marginTop: 4, textAlign: "center" },
  actionCard: { flexDirection: "row", alignItems: "center", backgroundColor: BRANDING.colors.surface, padding: 16, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: BRANDING.colors.border },
  actionIcon: { width: 48, height: 48, borderRadius: 24, justifyContent: "center", alignItems: "center", marginRight: 14 },
  actionContent: { flex: 1 },
  actionTitle: { fontSize: 15, fontWeight: "700", color: BRANDING.colors.text },
  actionSub: { fontSize: 12, color: BRANDING.colors.subtext, marginTop: 2 },

  // Patient cards
  patientCard: { backgroundColor: BRANDING.colors.surface, padding: 14, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: BRANDING.colors.border },
  patientHeader: { flexDirection: "row", alignItems: "center" },
  patientName: { fontSize: 15, fontWeight: "700", color: BRANDING.colors.text },
  patientMeta: { fontSize: 12, color: BRANDING.colors.subtext, marginTop: 4 },
  cultureText: { fontSize: 11, color: BRANDING.colors.subtext, marginTop: 8, fontStyle: "italic" },
  emptyText: { fontSize: 13, color: BRANDING.colors.subtext, textAlign: "center", marginTop: 20 },

  // AWaRe
  awareRow: { flexDirection: "row", justifyContent: "space-around" },
  awareItem: { alignItems: "center" },
  awareCount: { fontSize: 28, fontWeight: "800" },
  awareLabel: { fontSize: 11, color: BRANDING.colors.subtext, marginTop: 4 },

  // Antibiotic expandable cards
  abxCard: { backgroundColor: BRANDING.colors.surface, borderRadius: 12, borderWidth: 1, borderColor: BRANDING.colors.border, marginBottom: 10, overflow: "hidden" },
  abxHeader: { flexDirection: "row", alignItems: "center", padding: 14 },
  abxIconContainer: { width: 30, height: 30, borderRadius: 8, backgroundColor: BRANDING.colors.primary + "15", justifyContent: "center", alignItems: "center", marginRight: 10 },
  abxTitleContainer: { flex: 1, marginRight: 8 },
  abxName: { fontSize: 14, fontWeight: "700", color: BRANDING.colors.text },
  abxClass: { fontSize: 11, color: BRANDING.colors.subtext, marginTop: 2 },
  awareBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  awareBadgeText: { fontSize: 10, fontWeight: "700" },
  abxExpanded: { paddingHorizontal: 14, paddingBottom: 14 },
  divider: { height: 1, backgroundColor: BRANDING.colors.border, marginBottom: 12 },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 12 },
  errorRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 10 },
  errorText: { fontSize: 12, color: BRANDING.colors.reserve },
  abxOverview: { fontSize: 13, color: BRANDING.colors.text, lineHeight: 19, marginBottom: 12 },
  abxSubLabel: { fontSize: 10.5, fontWeight: "700", color: BRANDING.colors.subtext, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6, marginTop: 4 },
  bulletItem: { flexDirection: "row", marginBottom: 5 },
  bulletDot: { width: 4, height: 4, borderRadius: 2, marginTop: 7, marginRight: 8 },
  bulletText: { fontSize: 12.5, color: BRANDING.colors.text, lineHeight: 18, flex: 1 },
  stewardshipBox: { flexDirection: "row", backgroundColor: BRANDING.colors.access + "12", borderRadius: 8, padding: 10, marginTop: 12, gap: 8 },
  stewardshipText: { fontSize: 12, color: BRANDING.colors.text, lineHeight: 17, flex: 1 },

  // Login card
  loginCard: { flexDirection: "row", alignItems: "center", backgroundColor: BRANDING.colors.surface, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: BRANDING.colors.border },
  loginTitle: { fontSize: 15, fontWeight: "700", color: BRANDING.colors.text },
  loginSub: { fontSize: 12, color: BRANDING.colors.subtext, marginTop: 2 },
});