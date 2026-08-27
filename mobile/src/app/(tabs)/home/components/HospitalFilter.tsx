import { useQuery } from "@tanstack/react-query";
import { ScrollView, TouchableOpacity, Text, StyleSheet } from "react-native";
import { LayoutAnimation, Platform, UIManager } from "react-native";
import { api } from "../../../services/api";
import { Palette } from "../../../constants/branding";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const ALL_HOSPITALS = "All Hospitals";

interface HospitalFilterProps {
  value: string;
  onChange: (h: string) => void;
  colors: Palette;
}

export function HospitalFilter({ value, onChange, colors }: HospitalFilterProps) {
  const { data: hospitals, isLoading } = useQuery({
    queryKey: ["hospitals"],
    queryFn: api.getHospitals,
  });

  const options = [ALL_HOSPITALS, ...(hospitals || [])];

  const styles = makeStyles(colors);

  if (isLoading) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.row}
        contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingVertical: 10 }}
      >
        <Text style={styles.loadingText}>Loading hospitals…</Text>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.row}
      contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingVertical: 10 }}
    >
      {options.map((h) => (
        <TouchableOpacity
          key={h}
          style={[styles.chip, value === h && styles.chipActive]}
          onPress={() => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            onChange(h);
          }}
        >
          <Text style={[styles.chipText, value === h && styles.chipTextActive]}>{h}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    row: { maxHeight: 46, borderBottomWidth: 1, borderBottomColor: c.border, flexGrow: 0 },
    chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },
    chipActive: { backgroundColor: c.primary, borderColor: c.primary },
    chipText: { fontSize: 12, color: c.text },
    chipTextActive: { color: c.onPrimary, fontWeight: "700" },
    loadingText: { fontSize: 12, color: c.subtext, paddingVertical: 6 },
  });
}
