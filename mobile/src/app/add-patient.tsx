import { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Alert, ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { BRANDING } from "../constants/branding";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../services/api";

export default function AddPatientScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
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
  });

  const checkDuplicate = async () => {
    if (!formData.name && !formData.national_id) return true;

    try {
      const response = await api.searchPatients(formData.name || formData.national_id);
      
      if (response.patients && response.patients.length > 0) {
        const duplicateList = response.patients.map((p: any) => 
          `• ${p.name} (${p.age}y, ${p.hospital || "Unknown"})`
        ).join("\n");

        return new Promise<boolean>((resolve) => {
          Alert.alert(
            "⚠️ Possible Duplicate Found",
            `Similar patients in system:\n\n${duplicateList}\n\n${response.duplicate_warning || ""}\n\nCreate anyway?`,
            [
              { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
              { text: "Create Anyway", style: "destructive", onPress: () => resolve(true) },
            ]
          );
        });
      }
      return true;
    } catch (error) {
      console.warn("Duplicate check skipped:", error);
      return true; // If check fails, allow proceeding
    }
  };

  const handleSubmit = async () => {
    // Validate required fields
    if (!formData.name.trim() || !formData.age.trim() || !formData.diagnosis.trim()) {
      Alert.alert("Missing Info", "Please fill in Name, Age, and Diagnosis.");
      return;
    }

    // Check for duplicates (non-blocking)
    const shouldProceed = await checkDuplicate();
    if (!shouldProceed) return;

    setLoading(true);
    try {
      const payload = {
        ...formData,
        age: parseInt(formData.age),
        weight_kg: formData.weight_kg ? parseFloat(formData.weight_kg) : null,
        allergies: formData.allergies 
          ? formData.allergies.split(",").map(a => a.trim()).filter(Boolean) 
          : [],
      };

      await api.createPatient(payload);
      
      Alert.alert("✅ Success", "Patient added successfully", [
        { text: "OK", onPress: () => router.back() }
      ]);
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to add patient");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      <View style={styles.header}>
        <Text style={styles.title}>Add New Patient</Text>
        <Text style={styles.subtitle}>System will check for duplicates before creating</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Basic Information</Text>
        
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Full Name *</Text>
          <TextInput
            style={styles.input}
            value={formData.name}
            onChangeText={(text) => setFormData({ ...formData, name: text })}
            placeholder="Enter patient name"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>National ID</Text>
          <TextInput
            style={styles.input}
            value={formData.national_id}
            onChangeText={(text) => setFormData({ ...formData, national_id: text })}
            placeholder="e.g., UG-123456"
          />
        </View>

        <View style={styles.row}>
          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={styles.label}>Age *</Text>
            <TextInput
              style={styles.input}
              value={formData.age}
              onChangeText={(text) => setFormData({ ...formData, age: text })}
              placeholder="Age"
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
                  <Text style={[styles.sexBtnText, formData.sex === s && styles.sexBtnTextActive]}>{s}</Text>
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
            onChangeText={(text) => setFormData({ ...formData, hospital: text })}
            placeholder="Hospital name"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Weight (kg)</Text>
          <TextInput
            style={styles.input}
            value={formData.weight_kg}
            onChangeText={(text) => setFormData({ ...formData, weight_kg: text })}
            placeholder="Weight in kg"
            keyboardType="numeric"
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Clinical Information</Text>
        
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Diagnosis *</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={formData.diagnosis}
            onChangeText={(text) => setFormData({ ...formData, diagnosis: text })}
            placeholder="Primary diagnosis"
            multiline
            numberOfLines={3}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Infection Site</Text>
          <TextInput
            style={styles.input}
            value={formData.infection_site}
            onChangeText={(text) => setFormData({ ...formData, infection_site: text })}
            placeholder="e.g., Urinary tract, Respiratory"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Culture Results</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={formData.culture_results}
            onChangeText={(text) => setFormData({ ...formData, culture_results: text })}
            placeholder="e.g., E. coli, ESBL-positive"
            multiline
            numberOfLines={2}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Allergies (comma-separated)</Text>
          <TextInput
            style={styles.input}
            value={formData.allergies}
            onChangeText={(text) => setFormData({ ...formData, allergies: text })}
            placeholder="e.g., Penicillin, Sulfa drugs"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Pregnancy Status</Text>
          <TextInput
            style={styles.input}
            value={formData.pregnancy_status}
            onChangeText={(text) => setFormData({ ...formData, pregnancy_status: text })}
            placeholder="Not pregnant / Pregnant (weeks)"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Renal Function</Text>
          <TextInput
            style={styles.input}
            value={formData.renal_function}
            onChangeText={(text) => setFormData({ ...formData, renal_function: text })}
            placeholder="Normal / Impaired (eGFR)"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Liver Function</Text>
          <TextInput
            style={styles.input}
            value={formData.liver_function}
            onChangeText={(text) => setFormData({ ...formData, liver_function: text })}
            placeholder="Normal / Impaired"
          />
        </View>
      </View>

      <View style={styles.infoBox}>
        <Ionicons name="information-circle" size={18} color={BRANDING.colors.watch} />
        <Text style={styles.infoText}>
          System will automatically check for duplicates before creating.
        </Text>
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
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>Add Patient</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BRANDING.colors.background },
  header: { marginBottom: 20, paddingTop: 60 },
  title: { fontSize: 22, fontWeight: "800", color: BRANDING.colors.text },
  subtitle: { fontSize: 13, color: BRANDING.colors.subtext, marginTop: 4 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: BRANDING.colors.text, marginBottom: 12 },
  inputGroup: { marginBottom: 12 },
  label: { fontSize: 13, fontWeight: "600", color: BRANDING.colors.text, marginBottom: 6 },
  input: {
    backgroundColor: BRANDING.colors.surface,
    borderWidth: 1,
    borderColor: BRANDING.colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: BRANDING.colors.text,
  },
  textArea: { minHeight: 80, textAlignVertical: "top" },
  row: { flexDirection: "row" },
  sexRow: { flexDirection: "row", gap: 8 },
  sexBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BRANDING.colors.border,
    alignItems: "center",
    backgroundColor: BRANDING.colors.surface,
  },
  sexBtnActive: {
    backgroundColor: BRANDING.colors.primary,
    borderColor: BRANDING.colors.primary,
  },
  sexBtnText: { fontSize: 14, color: BRANDING.colors.text },
  sexBtnTextActive: { color: "#fff", fontWeight: "700" },
  infoBox: {
    flexDirection: "row",
    backgroundColor: BRANDING.colors.watch + "15",
    padding: 12,
    borderRadius: 10,
    marginBottom: 20,
    gap: 8,
  },
  infoText: { flex: 1, fontSize: 12, color: BRANDING.colors.watch, lineHeight: 18 },
  buttonRow: { flexDirection: "row", gap: 12, marginTop: 10 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: BRANDING.colors.surface,
    borderWidth: 1,
    borderColor: BRANDING.colors.border,
    alignItems: "center",
  },
  cancelBtnText: { fontSize: 15, fontWeight: "600", color: BRANDING.colors.text },
  submitBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: BRANDING.colors.primary,
    alignItems: "center",
  },
  submitBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },
});