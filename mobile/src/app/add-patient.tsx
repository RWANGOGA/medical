import { useEffect, useMemo, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator, StyleSheet,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../services/api";
import { useTheme } from "../context/ThemeContext";
import { Palette } from "../constants/branding";
import { Screen } from "../components/screen";

type Phase = "find" | "results" | "form";

const emptyForm = {
  name: "",
  national_id: "",
  hospital: "",
  age: "",
  sex: "M",
  weight_kg: "",
  pregnancy_status: "Not pregnant",
  allergies: "",
  renal_function: "Normal",
  liver_function: "Normal",
  diagnosis: "",
  infection_site: "",
  culture_results: "",
};

export default function AddPatientScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ editId?: string }>();

  const [phase, setPhase] = useState<Phase>(params.editId ? "form" : "find");
  const [editId, setEditId] = useState<string | null>(params.editId ?? null);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchName, setSearchName] = useState("");
  const [searchId, setSearchId] = useState("");
  const [matches, setMatches] = useState<any[]>([]);
  const [formData, setFormData] = useState({ ...emptyForm });

  // Deep-link into edit mode when arriving with an editId
  const { data: editPatient } = useQuery({
    queryKey: ["patient", editId],
    queryFn: () => api.getPatientById(editId as string),
    enabled: !!editId,
  });

  useEffect(() => {
    if (editId && editPatient) {
      setFormData({
        name: editPatient.name || "",
        national_id: editPatient.national_id || "",
        hospital: editPatient.hospital || "",
        age: String(editPatient.age ?? ""),
        sex: editPatient.sex || "M",
        weight_kg: editPatient.weight_kg ? String(editPatient.weight_kg) : "",
        pregnancy_status: editPatient.pregnancy_status || "Not pregnant",
        allergies: (editPatient.allergies || []).join(", "),
        renal_function: editPatient.renal_function || "Normal",
        liver_function: editPatient.liver_function || "Normal",
        diagnosis: editPatient.diagnosis || "",
        infection_site: editPatient.infection_site || "",
        culture_results: editPatient.culture_results || "",
      });
      setPhase("form");
    }
  }, [editId, editPatient]);

  // ---------- Phase 1: check the database before creating ----------
  const handleSearch = async () => {
    const query = (searchName.trim() || searchId.trim());
    if (!query) {
      Alert.alert("Search required", "Enter the patient name or national ID to check existing records first.");
      return;
    }
    setSearching(true);
    try {
      const res = await api.searchPatients(query);
      const found = res.patients || [];
      setMatches(found);
      if (found.length > 0) {
        setPhase("results");
      } else {
        // No record exists — proceed to create, carrying the search input over
        setFormData((f) => ({ ...f, name: searchName.trim(), national_id: searchId.trim() }));
        setPhase("form");
      }
    } catch (e: any) {
      Alert.alert("Search failed", e.message || "Could not check existing records. Please try again.");
    } finally {
      setSearching(false);
    }
  };

  const openForEdit = (patientId: number) => {
    setEditId(String(patientId));
    // Full record is loaded by the query above; form is filled in the effect
  };

  const startNewRecord = () => {
    setEditId(null);
    setFormData({ ...emptyForm, name: searchName.trim(), national_id: searchId.trim() });
    setPhase("form");
  };

  // ---------- Phase 2: create or update ----------
  const handleSubmit = async () => {
    if (!formData.name.trim() || !formData.age.trim() || !formData.diagnosis.trim()) {
      Alert.alert("Missing information", "Please complete Name, Age, and Diagnosis.");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        ...formData,
        age: parseInt(formData.age, 10),
        weight_kg: formData.weight_kg ? parseFloat(formData.weight_kg) : null,
        allergies: formData.allergies
          ? formData.allergies.split(",").map((a) => a.trim()).filter(Boolean)
          : [],
      };

      if (editId) {
        await api.updatePatient(editId, payload);
        queryClient.invalidateQueries({ queryKey: ["patients"] });
        queryClient.invalidateQueries({ queryKey: ["patient", editId] });
        Alert.alert("Record updated", "The patient record has been saved.", [
          { text: "OK", onPress: () => router.back() },
        ]);
      } else {
        await api.createPatient(payload);
        queryClient.invalidateQueries({ queryKey: ["patients"] });
        Alert.alert("Record created", "The patient has been registered.", [
          { text: "OK", onPress: () => router.back() },
        ]);
      }
    } catch (error: any) {
      Alert.alert("Error", error.message || "Could not save the patient record.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: editId ? "Edit Patient" : "Register Patient" }} />
      <Screen scroll keyboardAvoid contentStyle={{ padding: 20, paddingBottom: 40 }}>

        {phase === "find" && (
          <>
            <View style={styles.header}>
              <Text style={styles.title}>Patient Lookup</Text>
              <Text style={styles.subtitle}>
                Records are checked against the database before registration to prevent duplicates.
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Search existing records</Text>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Patient name</Text>
                <TextInput
                  style={styles.input}
                  value={searchName}
                  onChangeText={setSearchName}
                  placeholder="Enter full or partial name"
                  placeholderTextColor={colors.subtext}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>National ID</Text>
                <TextInput
                  style={styles.input}
                  value={searchId}
                  onChangeText={setSearchId}
                  placeholder="e.g., UG-123456"
                  placeholderTextColor={colors.subtext}
                />
              </View>

              <TouchableOpacity
                style={[styles.primaryBtn, searching && { opacity: 0.6 }]}
                onPress={handleSearch}
                disabled={searching}
              >
                {searching ? (
                  <ActivityIndicator color={colors.onPrimary} />
                ) : (
                  <>
                    <Ionicons name="search" size={18} color={colors.onPrimary} />
                    <Text style={styles.primaryBtnText}>Search records</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}

        {phase === "results" && (
          <>
            <View style={styles.header}>
              <Text style={styles.title}>Existing records found</Text>
              <Text style={styles.subtitle}>
                {matches.length} matching {matches.length === 1 ? "record" : "records"} in the database.
                Review the details below — if this is the same patient, open the record and edit it
                instead of creating a duplicate.
              </Text>
            </View>

            {matches.map((p) => (
              <View key={p.id} style={styles.matchCard}>
                <View style={styles.matchHeader}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{(p.name || "?").charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.matchName}>{p.name}</Text>
                    <Text style={styles.matchMeta}>
                      {p.age}y · {p.sex}{p.hospital ? ` · ${p.hospital}` : ""}
                    </Text>
                  </View>
                </View>
                {p.national_id ? (
                  <DetailRow label="National ID" value={p.national_id} styles={styles} />
                ) : null}
                <DetailRow label="Diagnosis" value={p.diagnosis || "Not recorded"} styles={styles} />

                <TouchableOpacity style={styles.primaryBtn} onPress={() => openForEdit(p.id)}>
                  <Ionicons name="create-outline" size={18} color={colors.onPrimary} />
                  <Text style={styles.primaryBtnText}>Open and edit this patient</Text>
                </TouchableOpacity>
              </View>
            ))}

            <TouchableOpacity style={styles.secondaryBtn} onPress={startNewRecord}>
              <Text style={styles.secondaryBtnText}>
                This is a different patient — create a new record
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.linkBtn} onPress={() => setPhase("find")}>
              <Text style={styles.linkBtnText}>Back to search</Text>
            </TouchableOpacity>
          </>
        )}

        {phase === "form" && (
          <>
            <View style={styles.header}>
              <Text style={styles.title}>{editId ? "Edit Patient Record" : "New Patient Record"}</Text>
              <Text style={styles.subtitle}>
                {editId
                  ? "Update the clinical details below. Changes are saved to the existing record."
                  : "No existing record was found. Enter the patient details below."}
              </Text>
            </View>

            {editId && loading === false && editPatient === undefined ? (
              <View style={{ paddingVertical: 40, alignItems: "center" }}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : (
              <>
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Basic information</Text>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Full name *</Text>
                    <TextInput
                      style={styles.input}
                      value={formData.name}
                      onChangeText={(t) => setFormData({ ...formData, name: t })}
                      placeholder="Patient full name"
                      placeholderTextColor={colors.subtext}
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>National ID</Text>
                    <TextInput
                      style={styles.input}
                      value={formData.national_id}
                      onChangeText={(t) => setFormData({ ...formData, national_id: t })}
                      placeholder="e.g., UG-123456"
                      placeholderTextColor={colors.subtext}
                    />
                  </View>

                  <View style={styles.row}>
                    <View style={[styles.inputGroup, { flex: 1 }]}>
                      <Text style={styles.label}>Age *</Text>
                      <TextInput
                        style={styles.input}
                        value={formData.age}
                        onChangeText={(t) => setFormData({ ...formData, age: t })}
                        placeholder="Age"
                        placeholderTextColor={colors.subtext}
                        keyboardType="numeric"
                      />
                    </View>
                    <View style={[styles.inputGroup, { flex: 1, marginLeft: 12 }]}>
                      <Text style={styles.label}>Sex</Text>
                      <View style={styles.sexRow}>
                        {["M", "F"].map((s) => (
                          <TouchableOpacity
                            key={s}
                            style={[styles.sexBtn, formData.sex === s && styles.sexBtnActive]}
                            onPress={() => setFormData({ ...formData, sex: s })}
                          >
                            <Text style={[styles.sexBtnText, formData.sex === s && styles.sexBtnTextActive]}>
                              {s}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Hospital</Text>
                    <TextInput
                      style={styles.input}
                      value={formData.hospital}
                      onChangeText={(t) => setFormData({ ...formData, hospital: t })}
                      placeholder="Hospital or facility name"
                      placeholderTextColor={colors.subtext}
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Weight (kg)</Text>
                    <TextInput
                      style={styles.input}
                      value={formData.weight_kg}
                      onChangeText={(t) => setFormData({ ...formData, weight_kg: t })}
                      placeholder="Weight in kg"
                      placeholderTextColor={colors.subtext}
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Clinical information</Text>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Diagnosis *</Text>
                    <TextInput
                      style={[styles.input, styles.textArea]}
                      value={formData.diagnosis}
                      onChangeText={(t) => setFormData({ ...formData, diagnosis: t })}
                      placeholder="Primary diagnosis"
                      placeholderTextColor={colors.subtext}
                      multiline
                      numberOfLines={3}
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Infection site</Text>
                    <TextInput
                      style={styles.input}
                      value={formData.infection_site}
                      onChangeText={(t) => setFormData({ ...formData, infection_site: t })}
                      placeholder="e.g., Urinary tract, Respiratory"
                      placeholderTextColor={colors.subtext}
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Culture results</Text>
                    <TextInput
                      style={[styles.input, styles.textArea]}
                      value={formData.culture_results}
                      onChangeText={(t) => setFormData({ ...formData, culture_results: t })}
                      placeholder="e.g., E. coli, ESBL-positive"
                      placeholderTextColor={colors.subtext}
                      multiline
                      numberOfLines={2}
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Allergies (comma-separated)</Text>
                    <TextInput
                      style={styles.input}
                      value={formData.allergies}
                      onChangeText={(t) => setFormData({ ...formData, allergies: t })}
                      placeholder="e.g., Penicillin, Sulfa drugs"
                      placeholderTextColor={colors.subtext}
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Pregnancy status</Text>
                    <TextInput
                      style={styles.input}
                      value={formData.pregnancy_status}
                      onChangeText={(t) => setFormData({ ...formData, pregnancy_status: t })}
                      placeholder="Not pregnant / Pregnant (weeks)"
                      placeholderTextColor={colors.subtext}
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Renal function</Text>
                    <TextInput
                      style={styles.input}
                      value={formData.renal_function}
                      onChangeText={(t) => setFormData({ ...formData, renal_function: t })}
                      placeholder="Normal / Impaired (eGFR)"
                      placeholderTextColor={colors.subtext}
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Liver function</Text>
                    <TextInput
                      style={styles.input}
                      value={formData.liver_function}
                      onChangeText={(t) => setFormData({ ...formData, liver_function: t })}
                      placeholder="Normal / Impaired"
                      placeholderTextColor={colors.subtext}
                    />
                  </View>
                </View>

                <View style={styles.buttonRow}>
                  <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={() => router.back()}
                    disabled={loading}
                  >
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.submitBtn, loading && { opacity: 0.6 }]}
                    onPress={handleSubmit}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator color={colors.onPrimary} />
                    ) : (
                      <Text style={styles.submitBtnText}>
                        {editId ? "Save changes" : "Register patient"}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </>
        )}
      </Screen>
    </>
  );
}

function DetailRow({ label, value, styles }: { label: string; value: string; styles: any }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    header: { marginBottom: 20 },
    title: { fontSize: 22, fontWeight: "800", color: c.text },
    subtitle: { fontSize: 13, color: c.subtext, marginTop: 6, lineHeight: 19 },
    section: { marginBottom: 20 },
    sectionTitle: { fontSize: 16, fontWeight: "700", color: c.text, marginBottom: 12 },
    inputGroup: { marginBottom: 12 },
    label: { fontSize: 13, fontWeight: "600", color: c.text, marginBottom: 6 },
    input: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      color: c.text,
    },
    textArea: { minHeight: 80, textAlignVertical: "top" },
    row: { flexDirection: "row" },
    sexRow: { flexDirection: "row", gap: 8 },
    sexBtn: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: "center",
      backgroundColor: c.surface,
    },
    sexBtnActive: { backgroundColor: c.primary, borderColor: c.primary },
    sexBtnText: { fontSize: 14, color: c.text },
    sexBtnTextActive: { color: c.onPrimary, fontWeight: "700" },

    primaryBtn: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      gap: 8,
      backgroundColor: c.primary,
      paddingVertical: 14,
      borderRadius: 10,
      marginTop: 8,
    },
    primaryBtnText: { fontSize: 15, fontWeight: "700", color: c.onPrimary },

    matchCard: {
      backgroundColor: c.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
      padding: 16,
      marginBottom: 14,
    },
    matchHeader: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
    avatar: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: c.primarySoft,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 12,
    },
    avatarText: { color: c.primary, fontWeight: "800", fontSize: 16 },
    matchName: { fontSize: 16, fontWeight: "700", color: c.text },
    matchMeta: { fontSize: 13, color: c.subtext, marginTop: 2 },
    detailRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: 8,
      borderTopWidth: 1,
      borderTopColor: c.border,
      gap: 12,
    },
    detailLabel: { fontSize: 13, color: c.subtext },
    detailValue: { fontSize: 13, fontWeight: "600", color: c.text, flexShrink: 1, textAlign: "right" },

    secondaryBtn: {
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
      paddingVertical: 14,
      borderRadius: 10,
      alignItems: "center",
      marginTop: 4,
    },
    secondaryBtnText: { fontSize: 14, fontWeight: "600", color: c.text },
    linkBtn: { paddingVertical: 14, alignItems: "center" },
    linkBtnText: { fontSize: 14, fontWeight: "600", color: c.primary },

    buttonRow: { flexDirection: "row", gap: 12, marginTop: 10 },
    cancelBtn: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 10,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: "center",
    },
    cancelBtnText: { fontSize: 15, fontWeight: "600", color: c.text },
    submitBtn: {
      flex: 2,
      paddingVertical: 14,
      borderRadius: 10,
      backgroundColor: c.primary,
      alignItems: "center",
    },
    submitBtnText: { fontSize: 15, fontWeight: "700", color: c.onPrimary },
  });
}
