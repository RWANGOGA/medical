import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet, FlatList, Alert, TextInput,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../../services/api";
import { Palette } from "../../../constants/branding";
import { useTheme } from "../../../context/ThemeContext";
import { useAuth } from "../../../context/AuthContext";

const ALL_HOSPITALS = "All Hospitals";

interface AdminDashboardProps {
  colors: Palette;
}

export function AdminDashboard({ colors }: AdminDashboardProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"overview" | "doctors" | "patients" | "publications">("overview");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: api.getAdminDashboard,
  });

  const { data: doctors, isLoading: doctorsLoading } = useQuery({
    queryKey: ["admin-doctors"],
    queryFn: () => api.getAdminDoctors(),
  });

  const { data: patients, isLoading: patientsLoading } = useQuery({
    queryKey: ["admin-patients"],
    queryFn: () => api.getAdminPatients(),
  });

  const { data: publications, isLoading: pubsLoading } = useQuery({
    queryKey: ["admin-publications"],
    queryFn: () => api.getAdminPublications(),
  });

  const filteredDoctors = useMemo(() => {
    if (!doctors?.doctors) return [];
    if (!searchQuery) return doctors.doctors;
    const q = searchQuery.toLowerCase();
    return doctors.doctors.filter(
      (d: any) =>
        d.full_name.toLowerCase().includes(q) ||
        d.username.toLowerCase().includes(q) ||
        d.hospital?.toLowerCase().includes(q)
    );
  }, [doctors, searchQuery]);

  const filteredPatients = useMemo(() => {
    if (!patients?.patients) return [];
    if (!searchQuery) return patients.patients;
    const q = searchQuery.toLowerCase();
    return patients.patients.filter(
      (p: any) =>
        p.name.toLowerCase().includes(q) ||
        p.diagnosis?.toLowerCase().includes(q) ||
        p.hospital?.toLowerCase().includes(q)
    );
  }, [patients, searchQuery]);

  const handleSuspendDoctor = async (doctorId: number, currentStatus: boolean) => {
    Alert.alert(
      currentStatus ? "Suspend Doctor" : "Activate Doctor",
      `Are you sure you want to ${currentStatus ? "suspend" : "activate"} this doctor?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: currentStatus ? "Suspend" : "Activate",
          style: currentStatus ? "destructive" : "default",
          onPress: async () => {
            try {
              if (currentStatus) {
                await api.suspendDoctor(doctorId, "Suspended by admin");
              } else {
                await api.activateDoctor(doctorId);
              }
              queryClient.invalidateQueries({ queryKey: ["admin-doctors"] });
              queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
            } catch (e: any) {
              Alert.alert("Error", e.message || "Failed to update doctor status");
            }
          },
        },
      ]
    );
  };

  const handleDeleteDoctor = async (doctorId: number, name: string) => {
    Alert.alert(
      "Delete Doctor",
      `Are you sure you want to permanently delete Dr. ${name}? This action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await api.deleteAdminDoctor(doctorId);
              queryClient.invalidateQueries({ queryKey: ["admin-doctors"] });
              queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
            } catch (e: any) {
              Alert.alert("Error", e.message || "Failed to delete doctor");
            }
          },
        },
      ]
    );
  };

  const handleDeletePatient = async (patientId: number, name: string) => {
    Alert.alert(
      "Delete Patient",
      `Are you sure you want to delete patient ${name}? This action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await api.deleteAdminPatient(patientId);
              queryClient.invalidateQueries({ queryKey: ["admin-patients"] });
              queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
            } catch (e: any) {
              Alert.alert("Error", e.message || "Failed to delete patient");
            }
          },
        },
      ]
    );
  };

  const handleMakeAdmin = async (userId: number, name: string, currentRole: string) => {
    if (currentRole === "admin") {
      Alert.alert("Already Admin", `${name} is already an administrator.`);
      return;
    }
    Alert.alert(
      "Make Admin",
      `Are you sure you want to promote ${name} to administrator? They will have full access to the admin dashboard.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Make Admin",
          style: "default",
          onPress: async () => {
            try {
              await api.changeUserRole(userId, "admin");
              queryClient.invalidateQueries({ queryKey: ["admin-doctors"] });
              queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
              Alert.alert("Success", `${name} has been promoted to administrator.`);
            } catch (e: any) {
              Alert.alert("Error", e.message || "Failed to change role");
            }
          },
        },
      ]
    );
  };

  const styles = makeStyles(colors);

  const renderOverview = () => (
    <View style={styles.statsGrid}>
      <View style={[styles.statCard, { backgroundColor: colors.access + "15" }]}>
        <Ionicons name="people" size={32} color={colors.access} />
        <Text style={styles.statValue}>{stats?.total_doctors || 0}</Text>
        <Text style={styles.statLabel}>Total Doctors</Text>
      </View>
      <View style={[styles.statCard, { backgroundColor: colors.primary + "15" }]}>
        <Ionicons name="person" size={32} color={colors.primary} />
        <Text style={styles.statValue}>{stats?.active_doctors || 0}</Text>
        <Text style={styles.statLabel}>Active Doctors</Text>
      </View>
      <View style={[styles.statCard, { backgroundColor: colors.watch + "15" }]}>
        <Ionicons name="medical" size={32} color={colors.watch} />
        <Text style={styles.statValue}>{stats?.total_patients || 0}</Text>
        <Text style={styles.statLabel}>Total Patients</Text>
      </View>
      <View style={[styles.statCard, { backgroundColor: colors.reserve + "15" }]}>
        <Ionicons name="business" size={32} color={colors.reserve} />
        <Text style={styles.statValue}>{stats?.total_hospitals || 0}</Text>
        <Text style={styles.statLabel}>Hospitals</Text>
      </View>
    </View>
  );

  const renderDoctors = () => (
    <View>
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={colors.subtext} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search doctors..."
          placeholderTextColor={colors.subtext}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>
      {doctorsLoading ? (
        <ActivityIndicator size="large" color={colors.primary} />
      ) : (
        filteredDoctors.map((doctor: any) => (
          <View key={doctor.id} style={styles.listCard}>
            <View style={styles.listCardHeader}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{doctor.full_name.charAt(0)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.listCardTitle}>{doctor.full_name}</Text>
                <Text style={styles.listCardSubtitle}>
                  {doctor.role} · {doctor.hospital || "No hospital"}
                </Text>
                <Text style={styles.listCardMeta}>
                  @{doctor.username} · {doctor.specialization || "No specialization"}
                </Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: doctor.is_active ? colors.access + "20" : colors.reserve + "20" }]}>
                <Text style={[styles.statusText, { color: doctor.is_active ? colors.access : colors.reserve }]}>
                  {doctor.is_active ? "Active" : "Suspended"}
                </Text>
              </View>
            </View>
            <View style={styles.listCardActions}>
              {doctor.role !== "admin" && (
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: colors.primary + "15" }]}
                  onPress={() => handleMakeAdmin(doctor.id, doctor.full_name, doctor.role)}
                >
                  <Ionicons name="shield-checkmark" size={16} color={colors.primary} />
                  <Text style={[styles.actionBtnText, { color: colors.primary }]}>Make Admin</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: doctor.is_active ? colors.reserve + "15" : colors.access + "15" }]}
                onPress={() => handleSuspendDoctor(doctor.id, doctor.is_active)}
              >
                <Ionicons
                  name={doctor.is_active ? "pause-circle" : "play-circle"}
                  size={16}
                  color={doctor.is_active ? colors.reserve : colors.access}
                />
                <Text style={[styles.actionBtnText, { color: doctor.is_active ? colors.reserve : colors.access }]}>
                  {doctor.is_active ? "Suspend" : "Activate"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: colors.reserve + "15" }]}
                onPress={() => handleDeleteDoctor(doctor.id, doctor.full_name)}
              >
                <Ionicons name="trash" size={16} color={colors.reserve} />
                <Text style={[styles.actionBtnText, { color: colors.reserve }]}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}
    </View>
  );

  const renderPatients = () => (
    <View>
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={colors.subtext} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search patients..."
          placeholderTextColor={colors.subtext}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>
      {patientsLoading ? (
        <ActivityIndicator size="large" color={colors.primary} />
      ) : (
        filteredPatients.map((patient: any) => (
          <View key={patient.id} style={styles.listCard}>
            <View style={styles.listCardHeader}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{patient.name.charAt(0)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.listCardTitle}>{patient.name}</Text>
                <Text style={styles.listCardSubtitle}>
                  {patient.age}y · {patient.sex} · {patient.diagnosis || "No diagnosis"}
                </Text>
                <Text style={styles.listCardMeta}>
                  {patient.hospital || "No hospital"} · by {patient.entered_by || "Unknown"}
                </Text>
              </View>
            </View>
            <View style={styles.listCardActions}>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: colors.primary + "15" }]}
                onPress={() => router.push(`/patient/${patient.id}`)}
              >
                <Ionicons name="eye" size={16} color={colors.primary} />
                <Text style={[styles.actionBtnText, { color: colors.primary }]}>View</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: colors.reserve + "15" }]}
                onPress={() => handleDeletePatient(patient.id, patient.name)}
              >
                <Ionicons name="trash" size={16} color={colors.reserve} />
                <Text style={[styles.actionBtnText, { color: colors.reserve }]}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}
    </View>
  );

  const renderPublications = () => (
    <View>
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => router.push("/admin/publication-create")}
      >
        <Ionicons name="add-circle" size={24} color={colors.onPrimary} />
        <Text style={styles.addButtonText}>New Publication</Text>
      </TouchableOpacity>
      {pubsLoading ? (
        <ActivityIndicator size="large" color={colors.primary} />
      ) : (
        publications?.publications?.map((pub: any) => (
          <View key={pub.id} style={styles.listCard}>
            <View style={styles.listCardHeader}>
              <View style={[styles.avatar, { backgroundColor: colors.watch + "20" }]}>
                <Ionicons
                  name={pub.content_type === "video" ? "videocam" : pub.content_type === "paper" ? "document-text" : "link"}
                  size={20}
                  color={colors.watch}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.listCardTitle} numberOfLines={2}>{pub.title}</Text>
                <Text style={styles.listCardSubtitle}>
                  {pub.content_type} · {pub.category || "Uncategorized"}
                </Text>
                <Text style={styles.listCardMeta}>
                  {pub.view_count} views · {new Date(pub.created_at).toLocaleDateString()}
                </Text>
              </View>
            </View>
          </View>
        ))
      )}
    </View>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 90 }}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View>
          <Text style={styles.welcomeText}>Admin Dashboard</Text>
          <Text style={styles.doctorName}>{user?.full_name || "Administrator"}</Text>
        </View>
      </View>

      <View style={styles.tabBar}>
        {[
          { key: "overview", label: "Overview", icon: "grid" },
          { key: "doctors", label: "Doctors", icon: "people" },
          { key: "patients", label: "Patients", icon: "medical" },
          { key: "publications", label: "Publications", icon: "newspaper" },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key as any)}
          >
            <Ionicons
              name={tab.icon as any}
              size={18}
              color={activeTab === tab.key ? colors.primary : colors.subtext}
            />
            <Text style={[styles.tabText, activeTab === tab.key && { color: colors.primary }]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.content}>
        {activeTab === "overview" && renderOverview()}
        {activeTab === "doctors" && renderDoctors()}
        {activeTab === "patients" && renderPatients()}
        {activeTab === "publications" && renderPublications()}
      </View>
    </ScrollView>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    header: {
      backgroundColor: c.primary,
      padding: 20,
      borderBottomLeftRadius: 24,
      borderBottomRightRadius: 24,
    },
    welcomeText: { color: c.onPrimary, opacity: 0.8, fontSize: 12, fontWeight: "600" },
    doctorName: { color: c.onPrimary, fontSize: 24, fontWeight: "800", marginTop: 4 },
    tabBar: {
      flexDirection: "row",
      backgroundColor: c.surface,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    tab: {
      flex: 1,
      flexDirection: "column",
      alignItems: "center",
      paddingVertical: 12,
      gap: 4,
    },
    tabActive: {
      borderBottomWidth: 2,
      borderBottomColor: c.primary,
    },
    tabText: { fontSize: 10, color: c.subtext, fontWeight: "600" },
    content: { padding: 16 },
    statsGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 12,
    },
    statCard: {
      width: "48%",
      padding: 20,
      borderRadius: 16,
      alignItems: "center",
      minHeight: 120,
      justifyContent: "center",
    },
    statValue: { fontSize: 28, fontWeight: "800", color: c.text, marginTop: 8 },
    statLabel: { fontSize: 12, color: c.subtext, marginTop: 4, textAlign: "center" },
    searchContainer: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: c.surface,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: c.border,
      gap: 8,
    },
    searchInput: { flex: 1, fontSize: 16, color: c.text },
    listCard: {
      backgroundColor: c.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: c.border,
    },
    listCardHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: c.primarySoft,
      justifyContent: "center",
      alignItems: "center",
    },
    avatarText: { color: c.primary, fontWeight: "800", fontSize: 18 },
    listCardTitle: { fontSize: 15, fontWeight: "700", color: c.text },
    listCardSubtitle: { fontSize: 12, color: c.subtext, marginTop: 2 },
    listCardMeta: { fontSize: 11, color: c.subtext, marginTop: 2, fontStyle: "italic" },
    statusBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    statusText: { fontSize: 11, fontWeight: "700" },
    listCardActions: {
      flexDirection: "row",
      gap: 8,
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    actionBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      minHeight: 36,
    },
    actionBtnText: { fontSize: 12, fontWeight: "600" },
    addButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: c.primary,
      paddingVertical: 14,
      borderRadius: 12,
      marginBottom: 16,
    },
    addButtonText: { color: c.onPrimary, fontSize: 16, fontWeight: "700" },
  });
}
