
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity,
  ActivityIndicator, LayoutAnimation, Platform, UIManager,
} from "react-native";
import { api } from "../../services/api";
import { BRANDING } from "../../constants/branding";
import { Ionicons } from "@expo/vector-icons";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// --- Types ---
interface Section {
  heading: string;
  body: string;
  bullets?: string[];
}

interface ExpandedContent {
  clinical_context: Section;
  diagnostic_approach: Section;
  first_line_therapy: Section;
  alternatives: Section;
  monitoring: Section;
  escalation_criteria: Section;
  evidence_base: Section;
  key_references: string[];
}

interface Guideline {
  id: string;
  title: string;
  source: string;
  year: number;
  summary: string;
}

// --- Reference section renderer ---
function ReferenceSection({ section, index }: { section: Section; index: string }) {
  return (
    <View style={styles.refSection}>
      <View style={styles.refSectionHeader}>
        <Text style={styles.refSectionIndex}>{index}</Text>
        <Text style={styles.refSectionHeading}>{section.heading}</Text>
      </View>
      <Text style={styles.refSectionBody}>{section.body}</Text>
      {section.bullets && section.bullets.length > 0 && (
        <View style={styles.bulletList}>
          {section.bullets.map((bullet, i) => (
            <View key={i} style={styles.bulletItem}>
              <View style={styles.bulletDot} />
              <Text style={styles.bulletText}>{bullet}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// --- Expandable guideline card ---
function GuidelineCard({ guideline }: { guideline: Guideline }) {
  const [expanded, setExpanded] = useState(false);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => api.expandGuideline(guideline),
    onSuccess: (data) => {
      queryClient.setQueryData(["guideline-expansion", guideline.id], data);
    },
  });

  const expandedContent = queryClient.getQueryData<ExpandedContent>([
    "guideline-expansion",
    guideline.id,
  ]);

  const handleToggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (!expanded && !expandedContent && !mutation.isPending) {
      mutation.mutate();
    }
    setExpanded(!expanded);
  };

  const sections: { key: keyof ExpandedContent; index: string }[] = [
    { key: "clinical_context", index: "I" },
    { key: "diagnostic_approach", index: "II" },
    { key: "first_line_therapy", index: "III" },
    { key: "alternatives", index: "IV" },
    { key: "monitoring", index: "V" },
    { key: "escalation_criteria", index: "VI" },
    { key: "evidence_base", index: "VII" },
  ];

  return (
    <View style={styles.guidelineCard}>
      <TouchableOpacity
        style={styles.guidelineHeader}
        onPress={handleToggle}
        activeOpacity={0.8}
      >
        <View style={styles.guidelineIconContainer}>
          <Ionicons name="book-outline" size={16} color={BRANDING.colors.primary} />
        </View>
        <View style={styles.guidelineTitleContainer}>
          <Text style={styles.guidelineTitle} numberOfLines={expanded ? undefined : 2}>
            {guideline.title}
          </Text>
          <Text style={styles.guidelineMeta}>
            {guideline.source} · {guideline.year}
          </Text>
        </View>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={16}
          color={BRANDING.colors.subtext}
        />
      </TouchableOpacity>

      <Text style={styles.guidelineSummary}>{guideline.summary}</Text>

      {expanded && (
        <View style={styles.expandedContent}>
          <View style={styles.divider} />

          {mutation.isPending && !expandedContent && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={BRANDING.colors.primary} />
              <Text style={styles.loadingText}>Generating clinical reference…</Text>
            </View>
          )}

          {mutation.isError && (
            <TouchableOpacity
              style={styles.errorContainer}
              onPress={() => mutation.mutate()}
            >
              <Ionicons name="alert-circle" size={14} color={BRANDING.colors.reserve} />
              <Text style={styles.errorText}>Failed to load. Tap to retry.</Text>
            </TouchableOpacity>
          )}

          {expandedContent && (
            <>
              {sections.map(({ key, index }) => (
                <ReferenceSection
                  key={key}
                  section={expandedContent[key]}
                  index={index}
                />
              ))}

              {expandedContent.key_references && expandedContent.key_references.length > 0 && (
                <View style={styles.referencesContainer}>
                  <Text style={styles.referencesLabel}>References</Text>
                  {expandedContent.key_references.map((ref, i) => (
                    <Text key={i} style={styles.referenceText}>
                      {i + 1}. {ref}
                    </Text>
                  ))}
                </View>
              )}
            </>
          )}
        </View>
      )}
    </View>
  );
}

// --- Stable ID generator ---
function stableId(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

// --- Main screen ---
export default function GuidelinesScreen() {
  const { data: organisms, isLoading: lo } = useQuery({
    queryKey: ["organisms"],
    queryFn: api.getOrganisms,
  });
  const { data: antibiotics, isLoading: la } = useQuery({
    queryKey: ["antibiotics"],
    queryFn: api.getAntibiotics,
  });
  const { data: rawGuidelines } = useQuery({
    queryKey: ["guidelines"],
    queryFn: api.getGuidelinesPublic,
  });

  const guidelines: Guideline[] = useMemo(
    () =>
      (rawGuidelines || []).map((g: any) => ({
        id: stableId(g.title),
        title: g.title,
        source: g.source,
        year: g.year,
        summary: g.summary,
      })),
    [rawGuidelines]
  );

  const awareColor = (c: string) =>
    c === "Access"
      ? BRANDING.colors.access
      : c === "Watch"
      ? BRANDING.colors.watch
      : BRANDING.colors.reserve;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 90 }}>
      <View style={styles.header}>
        <Text style={styles.title}>Clinical Guidelines</Text>
        <Text style={styles.subtitle}>
          Treatment protocols, pathogen profiles & antibiotic reference
        </Text>
      </View>

      {/* Clinical Guidelines — Expandable */}
      <Text style={styles.sectionTitle}>Treatment Protocols</Text>
      {guidelines.length === 0 && (
        <Text style={styles.emptyText}>Loading guidelines…</Text>
      )}
      {guidelines.map((g) => (
        <GuidelineCard key={g.id} guideline={g} />
      ))}

      {/* Pathogen Profiles */}
      <Text style={styles.sectionTitle}>Pathogen Profiles</Text>
      {lo ? (
        <ActivityIndicator style={{ marginTop: 12 }} />
      ) : (
        organisms?.map((o: any) => (
          <View key={o.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="bug-outline" size={22} color={BRANDING.colors.primary} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.orgName}>{o.name}</Text>
                <Text style={styles.orgGram}>{o.gram}</Text>
              </View>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{o.resistance_rate}% R</Text>
              </View>
            </View>
            <Text style={styles.importance}>{o.clinical_importance}</Text>
          </View>
        ))
      )}

      {/* Antibiotic Library */}
      <Text style={styles.sectionTitle}>Antibiotic Library</Text>
      {la ? (
        <ActivityIndicator style={{ marginTop: 12 }} />
      ) : (
        antibiotics?.map((a: any) => (
          <View key={a.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="medkit-outline" size={22} color={BRANDING.colors.primary} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.orgName}>{a.generic_name}</Text>
                <Text style={styles.orgGram}>{a.drug_class}</Text>
              </View>
              <View
                style={[
                  styles.badge,
                  { backgroundColor: awareColor(a.aware_category) + "20" },
                ]}
              >
                <Text style={[styles.badgeText, { color: awareColor(a.aware_category) }]}>
                  {a.aware_category}
                </Text>
              </View>
            </View>
            <Text style={styles.importance}>{a.dosing_adult}</Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BRANDING.colors.background },
  header: {
    backgroundColor: BRANDING.colors.surface,
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: BRANDING.colors.border,
  },
  title: { fontSize: 22, fontWeight: "800", color: BRANDING.colors.text },
  subtitle: { color: BRANDING.colors.subtext, marginTop: 4, fontSize: 13 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: BRANDING.colors.subtext,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 12,
    color: BRANDING.colors.subtext,
    textAlign: "center",
    marginTop: 16,
    fontStyle: "italic",
  },

  // Guideline card
  guidelineCard: {
    backgroundColor: BRANDING.colors.surface,
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BRANDING.colors.border,
  },
  guidelineHeader: { flexDirection: "row", alignItems: "flex-start", marginBottom: 8 },
  guidelineIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: BRANDING.colors.primary + "15",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  guidelineTitleContainer: { flex: 1, marginRight: 8 },
  guidelineTitle: {
    fontSize: 13.5,
    fontWeight: "700",
    color: BRANDING.colors.text,
    lineHeight: 18,
  },
  guidelineMeta: {
    fontSize: 10.5,
    color: BRANDING.colors.primary,
    marginTop: 2,
    fontWeight: "600",
  },
  guidelineSummary: {
    fontSize: 12.5,
    color: BRANDING.colors.subtext,
    lineHeight: 17,
    paddingLeft: 38,
  },

  // Expanded content
  expandedContent: { marginTop: 14, paddingLeft: 38 },
  divider: {
    height: 1,
    backgroundColor: BRANDING.colors.border,
    marginBottom: 16,
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 16,
  },
  loadingText: {
    fontSize: 11.5,
    color: BRANDING.colors.subtext,
    fontStyle: "italic",
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 12,
  },
  errorText: { fontSize: 11.5, color: BRANDING.colors.reserve },

  // Reference sections
  refSection: { marginBottom: 16 },
  refSectionHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: 5,
  },
  refSectionIndex: {
    fontSize: 10,
    fontWeight: "700",
    color: BRANDING.colors.primary,
    marginRight: 8,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  refSectionHeading: {
    fontSize: 12,
    fontWeight: "700",
    color: BRANDING.colors.text,
    textTransform: "uppercase",
    letterSpacing: 0.3,
    flex: 1,
  },
  refSectionBody: {
    fontSize: 12.5,
    color: BRANDING.colors.text,
    lineHeight: 18,
    marginBottom: 6,
  },
  bulletList: { marginTop: 6, paddingLeft: 2 },
  bulletItem: { flexDirection: "row", marginBottom: 4 },
  bulletDot: {
    width: 3.5,
    height: 3.5,
    borderRadius: 2,
    backgroundColor: BRANDING.colors.primary,
    marginTop: 6.5,
    marginRight: 7,
  },
  bulletText: {
    fontSize: 12,
    color: BRANDING.colors.text,
    lineHeight: 17,
    flex: 1,
  },
  referencesContainer: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: BRANDING.colors.border,
  },
  referencesLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: BRANDING.colors.subtext,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  referenceText: {
    fontSize: 11,
    color: BRANDING.colors.subtext,
    lineHeight: 16,
    marginBottom: 3,
  },

  // Existing card styles
  card: {
    backgroundColor: BRANDING.colors.surface,
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BRANDING.colors.border,
  },
  cardHeader: { flexDirection: "row", alignItems: "center" },
  orgName: {
    fontSize: 14,
    fontWeight: "700",
    fontStyle: "italic",
    color: BRANDING.colors.text,
  },
  orgGram: { fontSize: 11.5, color: BRANDING.colors.subtext, marginTop: 2 },
  badge: {
    backgroundColor: "#FFF1F2",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    color: BRANDING.colors.reserve,
    fontWeight: "800",
    fontSize: 10.5,
  },
  importance: {
    fontSize: 12,
    color: BRANDING.colors.subtext,
    marginTop: 10,
    lineHeight: 17,
  },
});