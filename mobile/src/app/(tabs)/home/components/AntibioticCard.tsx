import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
import { LayoutAnimation, Platform, UIManager } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../../../services/api";
import { Palette } from "../../../../constants/branding";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export interface AntibioticSummary {
  overview: string;
  when_to_use: string[];
  cautions: string[];
  stewardship_note: string;
}

interface AntibioticCardProps {
  abx: { id: string; generic_name: string; drug_class: string; aware_category: string };
  awareColor: (c: string) => string;
  colors: Palette;
}

export function AntibioticCard({ abx, awareColor, colors }: AntibioticCardProps) {
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

  const styles = makeStyles(colors);

  return (
    <View style={styles.card}>
      <TouchableOpacity style={styles.header} onPress={handleToggle} activeOpacity={0.8}>
        <View style={styles.iconContainer}>
          <Ionicons name="medical-outline" size={16} color={colors.primary} />
        </View>
        <View style={styles.titleContainer}>
          <Text style={styles.name}>{abx.generic_name}</Text>
          <Text style={styles.drugClass}>{abx.drug_class}</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: awareColor(abx.aware_category) + "20" }]}>
          <Text style={[styles.badgeText, { color: awareColor(abx.aware_category) }]}>{abx.aware_category}</Text>
        </View>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={16}
          color={colors.subtext}
          style={{ marginLeft: 8 }}
        />
      </TouchableOpacity>

      {expanded && (
        <View style={styles.expanded}>
          <View style={styles.divider} />

          {mutation.isPending && !summary && (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.loadingText}>Loading clinical summary…</Text>
            </View>
          )}

          {mutation.isError && (
            <TouchableOpacity style={styles.errorRow} onPress={() => mutation.mutate()}>
              <Ionicons name="alert-circle" size={14} color={colors.reserve} />
              <Text style={styles.errorText}>Failed to load. Tap to retry.</Text>
            </TouchableOpacity>
          )}

          {summary && (
            <>
              <Text style={styles.overview}>{summary.overview}</Text>

              <Text style={styles.subLabel}>Preferred indications</Text>
              {summary.when_to_use.map((b: string, i: number) => (
                <View key={i} style={styles.bulletItem}>
                  <View style={[styles.bulletDot, { backgroundColor: colors.access }]} />
                  <Text style={styles.bulletText}>{b}</Text>
                </View>
              ))}

              <Text style={styles.subLabel}>Key cautions</Text>
              {summary.cautions.map((b: string, i: number) => (
                <View key={i} style={styles.bulletItem}>
                  <View style={[styles.bulletDot, { backgroundColor: colors.reserve }]} />
                  <Text style={styles.bulletText}>{b}</Text>
                </View>
              ))}

              <View style={styles.stewardshipBox}>
                <Ionicons name="shield-checkmark" size={14} color={colors.access} style={{ marginTop: 2 }} />
                <Text style={styles.stewardshipText}>{summary.stewardship_note}</Text>
              </View>
            </>
          )}
        </View>
      )}
    </View>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    card: { backgroundColor: c.surface, borderRadius: 12, borderWidth: 1, borderColor: c.border, marginBottom: 10, overflow: "hidden" },
    header: { flexDirection: "row", alignItems: "center", padding: 14 },
    iconContainer: { width: 30, height: 30, borderRadius: 8, backgroundColor: c.primarySoft, justifyContent: "center", alignItems: "center", marginRight: 10 },
    titleContainer: { flex: 1, marginRight: 8 },
    name: { fontSize: 14, fontWeight: "700", color: c.text },
    drugClass: { fontSize: 11, color: c.subtext, marginTop: 2 },
    badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    badgeText: { fontSize: 10, fontWeight: "700" },
    expanded: { paddingHorizontal: 14, paddingBottom: 14 },
    divider: { height: 1, backgroundColor: c.border, marginBottom: 12 },
    loadingRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 12 },
    loadingText: { fontSize: 12, color: c.subtext },
    errorRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 10 },
    errorText: { fontSize: 12, color: c.reserve },
    overview: { fontSize: 13, color: c.text, lineHeight: 19, marginBottom: 12 },
    subLabel: { fontSize: 10.5, fontWeight: "700", color: c.subtext, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6, marginTop: 4 },
    bulletItem: { flexDirection: "row", marginBottom: 5 },
    bulletDot: { width: 4, height: 4, borderRadius: 2, marginTop: 7, marginRight: 8 },
    bulletText: { fontSize: 12.5, color: c.text, lineHeight: 18, flex: 1 },
    stewardshipBox: { flexDirection: "row", backgroundColor: c.access + "14", borderRadius: 8, padding: 10, marginTop: 12, gap: 8 },
    stewardshipText: { fontSize: 12, color: c.text, lineHeight: 17, flex: 1 },
  });
}
