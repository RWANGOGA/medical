import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ScrollView, TouchableOpacity, Text, StyleSheet, View } from "react-native";
import { LayoutAnimation, Platform, UIManager } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../../../services/api";
import { Palette } from "../../../../constants/branding";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const ALL_HOSPITALS = "All Hospitals";
const MY_HOSPITAL = "My Hospital";

interface HospitalFilterProps {
  value: string;
  onChange: (h: string) => void;
  colors: Palette;
  isAuthenticated?: boolean;
}

export function HospitalFilter({ value, onChange, colors, isAuthenticated }: HospitalFilterProps) {
  // Determine which hospitals to show — must be declared before useQuery hooks
  const [showAll, setShowAll] = useState(!isAuthenticated);

  // Fetch hospitals based on auth status
  const { data: allHospitals, isLoading: allLoading } = useQuery({
    queryKey: ["hospitals", "all"],
    queryFn: () => api.getHospitals(false),
    enabled: !isAuthenticated || showAll,
  });

  const { data: doctorHospital, isLoading: doctorLoading } = useQuery({
    queryKey: ["hospitals", "doctor"],
    queryFn: () => api.getHospitals(true),
    enabled: !!isAuthenticated,
  });

  const hospitals = isAuthenticated && !showAll ? doctorHospital : allHospitals;
  const isLoading = isAuthenticated && !showAll ? doctorLoading : allLoading;

  const options = [ALL_HOSPITALS, ...(hospitals || [])];

  const styles = makeStyles(colors);

  const toggleView = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowAll(!showAll);
    onChange(ALL_HOSPITALS);
  };

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
    <View style={styles.container}>
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

      {/* Toggle button for authenticated users */}
      {isAuthenticated && (
        <TouchableOpacity
          style={styles.toggleButton}
          onPress={toggleView}
          accessibilityRole="button"
          accessibilityLabel={showAll ? "Show only my hospital" : "Show all hospitals"}
        >
          <Ionicons
            name={showAll ? "person" : "people"}
            size={14}
            color={colors.primary}
          />
          <Text style={styles.toggleText}>
            {showAll ? MY_HOSPITAL : "All"}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    container: {
      flexDirection: "row",
      alignItems: "center",
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    row: {
      flex: 1,
      maxHeight: 46,
      flexGrow: 0,
    },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
    },
    chipActive: {
      backgroundColor: c.primary,
      borderColor: c.primary,
    },
    chipText: {
      fontSize: 12,
      color: c.text,
    },
    chipTextActive: {
      color: c.onPrimary,
      fontWeight: "700",
    },
    loadingText: {
      fontSize: 12,
      color: c.subtext,
      paddingVertical: 6,
    },
    toggleButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 12,
      paddingVertical: 8,
      marginRight: 8,
    },
    toggleText: {
      fontSize: 11,
      color: c.primary,
      fontWeight: "600",
    },
  });
}
