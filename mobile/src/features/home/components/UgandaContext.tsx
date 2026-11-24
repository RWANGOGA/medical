import { Linking, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import type { Palette } from "../../../constants/branding";
import {
  UGANDA_AMR_RESOURCES,
  UGANDA_PRIORITY_PATHOGENS,
} from "../../../constants/uganda";

/**
 * Uganda-specific surveillance and guidance panel shown on the public home
 * page. Keeps national context (UCG 2023, NAP-AMR, CPHL, UNIPH, GLASS) in
 * front of clinicians instead of generic international references only.
 */
export function UgandaContext({ colors }: { colors: Palette }) {
  const router = useRouter();
  const styles = makeStyles(colors);

  const concernColor = (concern: string) =>
    concern === "Critical" ? colors.reserve : concern === "High" ? colors.watch : colors.access;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Uganda AMR context</Text>
      <Text style={styles.sectionHint}>
        National guidance and priority pathogens for Ugandan health facilities
      </Text>

      <View style={styles.card}>
        <View style={styles.flagRow}>
          <View style={styles.flag}>
            <View style={[styles.flagBand, { backgroundColor: "#000000" }]} />
            <View style={[styles.flagBand, { backgroundColor: "#FCDC04" }]} />
            <View style={[styles.flagBand, { backgroundColor: "#D90000" }]} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Uganda Clinical Guidelines 2023</Text>
            <Text style={styles.cardSub}>Ministry of Health · standard treatment guidelines</Text>
          </View>
        </View>
        <Text style={styles.cardBody}>
          First-line options in this app follow UCG 2023 and the Uganda AMR National
          Action Plan. Always confirm with the current national guideline and your
          facility antibiogram before prescribing.
        </Text>
        <TouchableOpacity
          style={styles.cardLink}
          onPress={() => router.push("/guidelines" as never)}
          accessibilityRole="button"
          accessibilityLabel="Open Uganda clinical guidance"
        >
          <Text style={[styles.cardLinkText, { color: colors.primary }]}>
            Open Uganda guidance
          </Text>
          <Ionicons name="arrow-forward" size={14} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <Text style={styles.subHeading}>Priority pathogens in Uganda</Text>
      {UGANDA_PRIORITY_PATHOGENS.slice(0, 4).map((pathogen) => (
        <View key={pathogen.name} style={styles.pathogenRow}>
          <View style={styles.pathogenHeader}>
            <Text style={styles.pathogenName}>{pathogen.name}</Text>
            <View style={[styles.concernChip, { backgroundColor: concernColor(pathogen.concern) + "1F" }]}>
              <Text style={[styles.concernText, { color: concernColor(pathogen.concern) }]}>
                {pathogen.concern}
              </Text>
            </View>
          </View>
          <Text style={styles.pathogenNote}>{pathogen.localNote}</Text>
        </View>
      ))}

      <Text style={styles.subHeading}>National resources</Text>
      <View style={styles.resourceGrid}>
        {UGANDA_AMR_RESOURCES.map((resource) => (
          <TouchableOpacity
            key={resource.title}
            style={styles.resourceCard}
            onPress={() => Linking.openURL(resource.url).catch(() => undefined)}
            accessibilityRole="link"
            accessibilityLabel={`Open ${resource.title}`}
          >
            <Ionicons name="open-outline" size={14} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.resourceTitle}>{resource.title}</Text>
              <Text style={styles.resourceDetail}>{resource.detail}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    section: { marginBottom: 20 },
    sectionTitle: {
      fontSize: 11,
      fontWeight: "700",
      color: c.subtext,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: 4,
      marginTop: 10,
    },
    sectionHint: { fontSize: 12, color: c.subtext, marginBottom: 12 },
    card: {
      backgroundColor: c.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
      padding: 14,
      marginBottom: 12,
    },
    flagRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
    flag: { width: 30, height: 20, borderRadius: 3, overflow: "hidden" },
    flagBand: { flex: 1, width: "100%" },
    cardTitle: { fontSize: 14, fontWeight: "800", color: c.text },
    cardSub: { fontSize: 11, color: c.subtext, marginTop: 1 },
    cardBody: { fontSize: 12.5, lineHeight: 18, color: c.text },
    cardLink: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 10 },
    cardLinkText: { fontSize: 12.5, fontWeight: "700" },
    subHeading: {
      fontSize: 11,
      fontWeight: "700",
      color: c.subtext,
      textTransform: "uppercase",
      letterSpacing: 0.4,
      marginTop: 4,
      marginBottom: 8,
    },
    pathogenRow: {
      backgroundColor: c.surface,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.border,
      padding: 12,
      marginBottom: 8,
    },
    pathogenHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
    pathogenName: { flex: 1, fontSize: 12.5, fontWeight: "700", color: c.text },
    concernChip: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
    concernText: { fontSize: 9.5, fontWeight: "800", textTransform: "uppercase" },
    pathogenNote: { fontSize: 11.5, lineHeight: 16, color: c.subtext },
    resourceGrid: { gap: 8 },
    resourceCard: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 9,
      backgroundColor: c.surface,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.border,
      padding: 12,
    },
    resourceTitle: { fontSize: 12.5, fontWeight: "700", color: c.text },
    resourceDetail: { fontSize: 11, lineHeight: 15, color: c.subtext, marginTop: 1 },
  });
}
