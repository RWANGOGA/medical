import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet,
  LayoutAnimation, Platform, UIManager,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../../services/api";
import { Palette } from "../../constants/branding";
import { useTheme } from "../../context/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import { CONTENT_MAX_WIDTH } from "../../components/screen";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Tab = "organisms" | "antibiotics" | "patients";

function OrganismCard({ o, styles, colors }: { o: any; styles: any; colors: Palette }) {
  const [open, setOpen] = useState(false);
  return (
    <TouchableOpacity style={styles.card} onPress={() => { LayoutAnimation.easeInEaseOut(); setOpen(!open); }} activeOpacity={0.85}>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.orgName}>{o.name}</Text>
          <Text style={styles.sub}>{o.gram}</Text>
        </View>
        <View style={styles.badge}><Text style={styles.badgeText}>{o.resistance_rate}% R</Text></View>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={16} color={colors.subtext} style={{ marginLeft: 8 }} />
      </View>
      {open && (
        <View style={styles.expanded}>
          <Text style={styles.expLabel}>Clinical importance</Text>
          <Text style={styles.expText}>{o.clinical_importance}</Text>
          <Text style={styles.expLabel}>Common diseases</Text>
          <View style={styles.chipRow}>
            {(o.diseases || []).map((d: string) => <Text key={d} style={styles.chip}>{d}</Text>)}
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}

function AntibioticCard({ a, styles, colors }: { a: any; styles: any; colors: Palette }) {
  const [open, setOpen] = useState(false);
  const awareColor = a.aware_category === "Access" ? colors.access : a.aware_category === "Watch" ? colors.watch : colors.reserve;
  return (
    <TouchableOpacity style={styles.card} onPress={() => { LayoutAnimation.easeInEaseOut(); setOpen(!open); }} activeOpacity={0.85}>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.abxName}>{a.generic_name}</Text>
          <Text style={styles.sub}>{a.drug_class}</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: awareColor + "20" }]}>
          <Text style={[styles.badgeText, { color: awareColor }]}>{a.aware_category}</Text>
        </View>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={16} color={colors.subtext} style={{ marginLeft: 8 }} />
      </View>
      {open && (
        <View style={styles.expanded}>
          <Text style={styles.expLabel}>Mechanism of action</Text>
          <Text style={styles.expText}>{a.mechanism_of_action}</Text>
          <Text style={styles.expLabel}>Spectrum</Text>
          <Text style={styles.expText}>{a.spectrum}</Text>
          <Text style={styles.expLabel}>Adult dosing</Text>
          <Text style={styles.expText}>{a.dosing_adult}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function SearchScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [q, setQ] = useState("");
  const [tab, setTab] = useState<Tab>("organisms");

  const { data: organisms } = useQuery({ queryKey: ["organisms"], queryFn: api.getOrganismsPublic });
  const { data: antibiotics } = useQuery({ queryKey: ["antibiotics"], queryFn: api.getAntibioticsPublic });
  const { data: patients, isError: patientsErr } = useQuery({ queryKey: ["patients"], queryFn: api.getPatients });

  const query = q.trim().toLowerCase();

  const orgResults = useMemo(
    () => (organisms || []).filter((o: any) => o.name.toLowerCase().includes(query)),
    [organisms, query]
  );
  const abxResults = useMemo(
    () => (antibiotics || []).filter((a: any) => a.generic_name.toLowerCase().includes(query)),
    [antibiotics, query]
  );
  const patResults = useMemo(
    () => (patients || []).filter((p: any) =>
      p.name.toLowerCase().includes(query) || (p.national_id || "").toLowerCase().includes(query)
    ),
    [patients, query]
  );

  const switchTab = (t: Tab) => { LayoutAnimation.easeInEaseOut(); setTab(t); };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={styles.headerInner}>
          <Text style={styles.headerTitle}>Search</Text>

          {/* Search bar */}
          <View style={styles.searchBar}>
            <Ionicons name="search" size={16} color={colors.subtext} />
            <TextInput
              style={styles.searchInput}
              value={q}
              onChangeText={setQ}
              placeholder="e.g. Klebsiella, Vancomycin…"
              placeholderTextColor={colors.subtext}
            />
            {q.length > 0 && (
              <TouchableOpacity onPress={() => setQ("")}>
                <Ionicons name="close-circle" size={16} color={colors.subtext} />
              </TouchableOpacity>
            )}
          </View>

          {/* Tab pills */}
          <View style={styles.tabRow}>
            {(["organisms", "antibiotics", "patients"] as Tab[]).map((t) => (
              <TouchableOpacity key={t} style={[styles.tabPill, tab === t && styles.tabPillActive]} onPress={() => switchTab(t)}>
                <Text style={[styles.tabPillText, tab === t && styles.tabPillTextActive]}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.resultsContent} keyboardShouldPersistTaps="handled">
        {tab === "organisms" && (
          orgResults.length ? orgResults.map((o: any) => <OrganismCard key={o.id} o={o} styles={styles} colors={colors} />)
          : <Text style={styles.empty}>No organisms match "{q}".</Text>
        )}

        {tab === "antibiotics" && (
          abxResults.length ? abxResults.map((a: any) => <AntibioticCard key={a.id} a={a} styles={styles} colors={colors} />)
          : <Text style={styles.empty}>No antibiotics match "{q}".</Text>
        )}

        {tab === "patients" && (
          patientsErr ? (
            <Text style={styles.empty}>Sign in as a doctor to search patients.</Text>
          ) : patResults.length ? (
            patResults.map((p: any) => (
              <TouchableOpacity key={p.id} style={styles.card} onPress={() => router.push(`/patient/${p.id}`)} activeOpacity={0.85}>
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.abxName}>{p.name}</Text>
                    <Text style={styles.sub}>{p.age}y · {p.sex} · {p.diagnosis || "No diagnosis"}</Text>
                  </View>
                  {p.hospital ? (
                    <View style={[styles.badge, { backgroundColor: colors.primarySoft }]}>
                      <Text style={[styles.badgeText, { color: colors.primary }]} numberOfLines={1}>{p.hospital}</Text>
                    </View>
                  ) : null}
                  <Ionicons name="chevron-forward" size={16} color={colors.subtext} style={{ marginLeft: 8 }} />
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <Text style={styles.empty}>No patients match "{q}".</Text>
          )
        )}
      </ScrollView>
    </View>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    header: { backgroundColor: c.surface, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: c.border },
    headerInner: { width: "100%", maxWidth: CONTENT_MAX_WIDTH, alignSelf: "center", paddingHorizontal: 20 },
    headerTitle: { fontSize: 20, fontWeight: "800", color: c.text, marginBottom: 12 },
    searchBar: { flexDirection: "row", alignItems: "center", backgroundColor: c.background, borderWidth: 1, borderColor: c.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, gap: 8 },
    searchInput: { flex: 1, fontSize: 14, color: c.text, padding: 0 },
    tabRow: { flexDirection: "row", gap: 8, marginTop: 14, flexWrap: "wrap" },
    tabPill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 18, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },
    tabPillActive: { backgroundColor: c.primary, borderColor: c.primary },
    tabPillText: { fontSize: 12, fontWeight: "600", color: c.subtext },
    tabPillTextActive: { color: c.onPrimary },
    resultsContent: { padding: 16, paddingBottom: 90, width: "100%", maxWidth: CONTENT_MAX_WIDTH, alignSelf: "center" },
    card: { backgroundColor: c.surface, borderRadius: 12, borderWidth: 1, borderColor: c.border, padding: 14, marginBottom: 10 },
    row: { flexDirection: "row", alignItems: "center" },
    orgName: { fontSize: 14, fontWeight: "700", fontStyle: "italic", color: c.text },
    abxName: { fontSize: 14, fontWeight: "700", color: c.text },
    sub: { fontSize: 11.5, color: c.subtext, marginTop: 2 },
    badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: c.dangerSoft },
    badgeText: { fontSize: 10, fontWeight: "700", color: c.reserve },
    expanded: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: c.border },
    expLabel: { fontSize: 10.5, fontWeight: "700", color: c.subtext, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4, marginTop: 8 },
    expText: { fontSize: 12.5, color: c.text, lineHeight: 18 },
    chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    chip: { fontSize: 11, color: c.text, backgroundColor: c.background, borderWidth: 1, borderColor: c.border, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, overflow: "hidden" },
    empty: { textAlign: "center", color: c.subtext, marginTop: 30, fontSize: 13 },
  });
}
