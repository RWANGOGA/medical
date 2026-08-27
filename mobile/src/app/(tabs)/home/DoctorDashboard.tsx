import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet, Linking } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../../services/api";
import { Palette } from "../../../constants/branding";
import { useAssistant } from "../../../context/AssistantContext";
import { HospitalFilter } from "./components/HospitalFilter";
import { useResponsive } from "../../../utils/responsive";

const ALL_HOSPITALS = "All Hospitals";

interface LabResult {
  id: number;
  patient_name: string;
  organism_id: string;
  specimen: string;
  hospital: string;
  collection_date: string;
  susceptibility: Record<string, string>;
  entered_by: string;
  created_at: string;
}

interface DoctorDashboardProps {
  user: {
    full_name: string;
    hospital: string;
    role?: string;
  };
  colors: Palette;
}

interface QuickAction {
  id: string;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  route?: string;
  onPress?: () => void;
  priority: "primary" | "secondary";
}

export function DoctorDashboard({ user, colors }: DoctorDashboardProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { openAssistant } = useAssistant();
  const { isTabletOrLarger, isDesktopOrLarger } = useResponsive();
  const [hospital, setHospital] = useState(ALL_HOSPITALS);
  const activeHospital = hospital === ALL_HOSPITALS ? undefined : hospital;

  const { data: patients, isLoading: patientsLoading, error: patientsError } = useQuery({
    queryKey: ["patients"],
    queryFn: api.getPatients,
  });

  const { data: alerts, isLoading: alertsLoading } = useQuery({
    queryKey: ["alerts", hospital],
    queryFn: () => api.getDashboardAlerts(activeHospital),
  });

  const { data: recentLabResults, isLoading: labResultsLoading } = useQuery({
    queryKey: ["recent-lab-results", hospital],
    queryFn: () => api.getRecentLabResults(10),
  });

  const filteredPatients = useMemo(() => {
    if (!patients) return [];
    return patients.filter((p: any) => !activeHospital || p.hospital === activeHospital);
  }, [patients, activeHospital]);

  const patientCount = filteredPatients.length;
  const criticalAlerts = useMemo(() => {
    if (!alerts) return [];
    return alerts.filter((a: string) => !a.includes("No critical"));
  }, [alerts]);

  const recentPatients = filteredPatients.slice(0, 3);

  const filteredLabResults = useMemo(() => {
    if (!recentLabResults) return [];
    return recentLabResults.filter(
      (r: LabResult) => !activeHospital || r.hospital === activeHospital
    );
  }, [recentLabResults, activeHospital]);

  const quickActions: QuickAction[] = [
    {
      id: "register",
      title: "Register Patient",
      subtitle: "Add new patient record",
      icon: "person-add",
      color: colors.access,
      route: "/add-patient",
      priority: "primary",
    },
    {
      id: "lab",
      title: "Enter Lab Result",
      subtitle: "Culture & susceptibility data",
      icon: "flask",
      color: colors.watch,
      route: "/add-lab-result",
      priority: "primary",
    },
    {
      id: "patients",
      title: "Manage Patients",
      subtitle: "View all records",
      icon: "people",
      color: colors.primary,
      route: "/(tabs)/patients",
      priority: "primary",
    },
    {
      id: "assistant",
      title: "Clinical Assistant",
      subtitle: "Ask about resistance, dosing",
      icon: "pulse-outline",
      color: colors.primary,
      onPress: openAssistant,
      priority: "secondary",
    },
    {
      id: "chat",
      title: "Doctor Chat",
      subtitle: "Discuss cases",
      icon: "chatbubbles",
      color: colors.primary,
      route: "/chat",
      priority: "secondary",
    },
    {
      id: "cds",
      title: "Decision Support",
      subtitle: "Treatment recommendations",
      icon: "medical",
      color: colors.watch,
      route: "/cds",
      priority: "secondary",
    },
    {
      id: "guidelines",
      title: "Guidelines",
      subtitle: "Treatment protocols",
      icon: "book",
      color: colors.reserve,
      route: "/(tabs)/guidelines",
      priority: "secondary",
    },
    {
      id: "audit",
      title: "Activity Log",
      subtitle: "Audit trail",
      icon: "list-circle",
      color: colors.watch,
      route: "/audit",
      priority: "secondary",
    },
    {
      id: "report",
      title: "Stewardship Report",
      subtitle: "Download CSV",
      icon: "download",
      color: colors.access,
      onPress: () => Linking.openURL(api.reportUrl(activeHospital)),
      priority: "secondary",
    },
  ];

  const primaryActions = quickActions.filter((a) => a.priority === "primary");
  const secondaryActions = quickActions.filter((a) => a.priority === "secondary");

  const styles = makeStyles(colors);

  const handleActionPress = (action: QuickAction) => {
    if (action.onPress) {
      action.onPress();
    } else if (action.route) {
      router.push(action.route as any);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 90 }}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.welcomeText}>Clinical Dashboard</Text>
          <Text style={styles.doctorName}>{user?.full_name || "Doctor"}</Text>
          <Text style={styles.hospitalText}>{user?.hospital}</Text>
        </View>
      </View>

      {/* Hospital Filter */}
      <HospitalFilter value={hospital} onChange={setHospital} colors={colors} isAuthenticated={true} />

      <View style={styles.content}>
        {/* Critical Alerts */}
        {alertsLoading ? (
          <View style={styles.loadingSection}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.loadingText}>Checking alerts…</Text>
          </View>
        ) : criticalAlerts.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Critical Alerts ({criticalAlerts.length}){activeHospital ? ` — ${activeHospital}` : ""}
            </Text>
            {criticalAlerts.map((alert: string, i: number) => (
              <View key={i} style={styles.alertCard}>
                <View style={styles.alertHeader}>
                  <Ionicons name="warning" size={16} color={colors.reserve} />
                  <Text style={styles.alertTitle}>Resistance alert</Text>
                </View>
                <Text style={styles.alertText}>{alert}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* Stats Row - responsive: 2 cols on phone, 4 on tablet+ */}
        <View style={[styles.statsRow, isTabletOrLarger && styles.statsRowTablet]}>
          <TouchableOpacity
            style={[styles.statCard, isTabletOrLarger && styles.statCardTablet]}
            onPress={() => router.push("/(tabs)/patients")}
            accessibilityRole="button"
            accessibilityLabel={`${patientCount} patients. Tap to view.`}
          >
            <Ionicons name="people" size={28} color={colors.primary} />
            {patientsLoading ? (
              <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 8 }} />
            ) : (
              <Text style={styles.statValue}>{patientCount}</Text>
            )}
            <Text style={styles.statLabel}>Patients</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.statCard, isTabletOrLarger && styles.statCardTablet]}
            onPress={() => router.push("/(tabs)/search")}
            accessibilityRole="button"
            accessibilityLabel="Search clinical data"
          >
            <Ionicons name="search" size={28} color={colors.watch} />
            <Text style={styles.statValue}>Search</Text>
            <Text style={styles.statLabel}>Clinical Data</Text>
          </TouchableOpacity>

          {isTabletOrLarger && (
            <>
              <TouchableOpacity
                style={[styles.statCard, styles.statCardTablet]}
                onPress={() => router.push("/add-lab-result")}
                accessibilityRole="button"
                accessibilityLabel="Enter lab result"
              >
                <Ionicons name="flask" size={28} color={colors.access} />
                <Text style={styles.statValue}>Lab</Text>
                <Text style={styles.statLabel}>Add Result</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.statCard, styles.statCardTablet]}
                onPress={openAssistant}
                accessibilityRole="button"
                accessibilityLabel="Clinical assistant"
              >
                <Ionicons name="pulse-outline" size={28} color={colors.reserve} />
                <Text style={styles.statValue}>AI</Text>
                <Text style={styles.statLabel}>Assistant</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Primary Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.primaryGrid}>
            {primaryActions.map((action) => (
              <TouchableOpacity
                key={action.id}
                style={[styles.primaryActionCard, isTabletOrLarger && styles.primaryActionCardTablet]}
                onPress={() => handleActionPress(action)}
                accessibilityRole="button"
                accessibilityLabel={action.title}
              >
                <View style={[styles.primaryActionIcon, { backgroundColor: action.color + "18" }]}>
                  <Ionicons name={action.icon} size={24} color={action.color} />
                </View>
                <Text style={styles.primaryActionTitle}>{action.title}</Text>
                <Text style={styles.primaryActionSub}>{action.subtitle}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Secondary Quick Actions */}
        <View style={styles.section}>
          {secondaryActions.map((action) => (
            <TouchableOpacity
              key={action.id}
              style={styles.actionRow}
              onPress={() => handleActionPress(action)}
              accessibilityRole="button"
              accessibilityLabel={action.title}
            >
              <View style={[styles.actionIconSmall, { backgroundColor: action.color + "18" }]}>
                <Ionicons name={action.icon} size={20} color={action.color} />
              </View>
              <View style={styles.actionContent}>
                <Text style={styles.actionTitle}>{action.title}</Text>
                <Text style={styles.actionSub}>{action.subtitle}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.subtext} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Recent Patients */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Patients</Text>
            {patientCount > 3 && (
              <TouchableOpacity onPress={() => router.push("/(tabs)/patients")}>
                <Text style={styles.viewAllLink}>View all →</Text>
              </TouchableOpacity>
            )}
          </View>

          {patientsLoading ? (
            <View style={styles.loadingSection}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.loadingText}>Loading patients…</Text>
            </View>
          ) : patientsError ? (
            <View style={styles.errorSection}>
              <Ionicons name="alert-circle" size={16} color={colors.reserve} />
              <Text style={styles.errorText}>Failed to load patients. Pull to refresh.</Text>
            </View>
          ) : recentPatients.length > 0 ? (
            recentPatients.map((patient: any) => (
              <TouchableOpacity
                key={patient.id}
                style={styles.patientCard}
                onPress={() => router.push(`/patient/${patient.id}`)}
                accessibilityRole="button"
                accessibilityLabel={`Patient ${patient.name}, ${patient.age} years old`}
              >
                <View style={styles.patientHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.patientName}>{patient.name}</Text>
                    <Text style={styles.patientMeta}>
                      {patient.age}y · {patient.sex} · {patient.diagnosis || "No diagnosis"}
                      {patient.hospital ? ` · ${patient.hospital}` : ""}
                    </Text>
                  </View>
                </View>
                {patient.culture_results && (
                  <Text style={styles.cultureText}>Culture: {patient.culture_results}</Text>
                )}
              </TouchableOpacity>
            ))
          ) : (
            <Text style={styles.emptyText}>No patients yet. Use "Register Patient" to create one.</Text>
          )}
        </View>

        {/* Recent Lab Results */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Lab Results</Text>
            {filteredLabResults.length > 5 && (
              <TouchableOpacity onPress={() => router.push("/(tabs)/search")}>
                <Text style={styles.viewAllLink}>View all →</Text>
              </TouchableOpacity>
            )}
          </View>

          {labResultsLoading ? (
            <View style={styles.loadingSection}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.loadingText}>Loading lab results…</Text>
            </View>
          ) : filteredLabResults.length > 0 ? (
            filteredLabResults.slice(0, 5).map((result: LabResult) => (
              <View key={result.id} style={styles.labResultCard}>
                <View style={styles.labResultHeader}>
                  <View style={styles.labResultIcon}>
                    <Ionicons name="flask" size={16} color={colors.watch} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.labResultPatient}>{result.patient_name || "Unknown Patient"}</Text>
                    <Text style={styles.labResultMeta}>
                      {result.organism_id} · {result.specimen} · {result.collection_date}
                    </Text>
                  </View>
                </View>
                <View style={styles.susceptibilityRow}>
                  {Object.entries(result.susceptibility).map(([drug, value]) => (
                    <View
                      key={drug}
                      style={[
                        styles.susceptibilityBadge,
                        { backgroundColor: value === "S" ? colors.access + "20" : value === "I" ? colors.watch + "20" : colors.reserve + "20" },
                      ]}
                    >
                      <Text
                        style={[
                          styles.susceptibilityText,
                          { color: value === "S" ? colors.access : value === "I" ? colors.watch : colors.reserve },
                        ]}
                      >
                        {drug}: {value}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>No lab results yet. Use "Enter Lab Result" to add one.</Text>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },

    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      backgroundColor: c.primary,
      padding: 20,
      borderBottomLeftRadius: 24,
      borderBottomRightRadius: 24,
    },
    welcomeText: { color: c.onPrimary, opacity: 0.8, fontSize: 12, fontWeight: "600", letterSpacing: 0.5 },
    doctorName: { color: c.onPrimary, fontSize: 24, fontWeight: "800", marginTop: 4 },
    hospitalText: { color: c.onPrimary, opacity: 0.9, fontSize: 12, marginTop: 4 },

    content: { padding: 16 },
    section: { marginBottom: 20 },
    sectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 4,
    },
    sectionTitle: {
      fontSize: 11,
      fontWeight: "700",
      color: c.subtext,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: 4,
      marginTop: 10,
    },
    viewAllLink: { fontSize: 12, color: c.primary, fontWeight: "600", marginTop: 10 },

    loadingSection: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingVertical: 16,
      justifyContent: "center",
    },
    loadingText: { fontSize: 12, color: c.subtext },
    errorSection: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingVertical: 16,
      justifyContent: "center",
    },
    errorText: { fontSize: 12, color: c.reserve },

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

    statsRow: { flexDirection: "row", gap: 12, marginBottom: 20, flexWrap: "wrap" },
    statsRowTablet: {
      flexWrap: "nowrap",
    },
    statCard: {
      flex: 1,
      minWidth: 140,
      backgroundColor: c.surface,
      padding: 16,
      borderRadius: 12,
      alignItems: "center",
      borderWidth: 1,
      borderColor: c.border,
      minHeight: 100,
      justifyContent: "center",
    },
    statCardTablet: {
      minWidth: 120,
      paddingVertical: 20,
    },
    statValue: { fontSize: 20, fontWeight: "800", color: c.text, marginTop: 8 },
    statLabel: { fontSize: 11, color: c.subtext, marginTop: 4, textAlign: "center" },

    primaryGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
    },
    primaryActionCard: {
      width: "48%",
      backgroundColor: c.surface,
      padding: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border",
      minHeight: 120,
    },
    primaryActionCardTablet: {
      width: "31%",
    },
    primaryActionIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 10,
    },
    primaryActionTitle: { fontSize: 14, fontWeight: "700", color: c.text },
    primaryActionSub: { fontSize: 11, color: c.subtext, marginTop: 2 },

    actionRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: c.surface,
      padding: 12,
      borderRadius: 10,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: c.border,
    },
    actionIconSmall: {
      width: 36,
      height: 36,
      borderRadius: 18,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 12,
    },
    actionContent: { flex: 1 },
    actionTitle: { fontSize: 14, fontWeight: "600", color: c.text },
    actionSub: { fontSize: 11, color: c.subtext, marginTop: 2 },

    patientCard: {
      backgroundColor: c.surface,
      padding: 14,
      borderRadius: 12,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: c.border,
    },
    patientHeader: { flexDirection: "row", alignItems: "center" },
    patientName: { fontSize: 15, fontWeight: "700", color: c.text },
    patientMeta: { fontSize: 12, color: c.subtext, marginTop: 4 },
    cultureText: { fontSize: 11, color: c.subtext, marginTop: 8, fontStyle: "italic" },
    emptyText: { fontSize: 13, color: c.subtext, textAlign: "center", marginTop: 20 },

    // Lab results
    labResultCard: {
      backgroundColor: c.surface,
      padding: 12,
      borderRadius: 10,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: c.border,
    },
    labResultHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 8,
    },
    labResultIcon: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: c.watch + "20",
      justifyContent: "center",
      alignItems: "center",
      marginRight: 10,
    },
    labResultPatient: { fontSize: 14, fontWeight: "700", color: c.text },
    labResultMeta: { fontSize: 11, color: c.subtext, marginTop: 2 },
    susceptibilityRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
    },
    susceptibilityBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
    },
    susceptibilityText: { fontSize: 10, fontWeight: "700" },
  });
}
