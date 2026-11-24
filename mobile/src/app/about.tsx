import { useMemo } from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import { useI18n } from "../context/I18nContext";
import { useOffline } from "../hooks/use-offline";
import { LOCALES, LOCALE_LABEL_KEY } from "../i18n";
import { Palette } from "../constants/branding";
import { AppVersion } from "../constants/app-info";
import { NavigationBar } from "../components/navigation-bar";

export default function AboutScreen() {
  const router = useRouter();
  const { colors, mode, setMode } = useTheme();
  const { t, locale, setLocale } = useI18n();
  const { online, pending } = useOffline();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 120 }}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={22} color={colors.onPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>About Steward AMR</Text>
        <Text style={styles.subtitle}>Version {AppVersion}</Text>
      </View>

      <NavigationBar colors={colors} />

      <View style={styles.content}>
        <Text style={styles.sectionTitle}>Mission</Text>
        <Text style={styles.body}>
          Antimicrobial-resistance surveillance and stewardship for Ugandan hospitals —
          aligned with global standards and usable offline.
        </Text>

        <Text style={styles.sectionTitle}>Standards & benchmarks</Text>
        <View style={styles.chips}>
          {["WHO GLASS", "WHONET", "EARS-Net", "AWaRe", "UCG 2023", "CLSI M39"].map((s) => (
            <View key={s} style={[styles.chip, { borderColor: colors.border }]}>
              <Text style={{ color: colors.text, fontSize: 12, fontWeight: "600" }}>{s}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Status</Text>
        <View style={styles.card}>
          <Text style={styles.row}>
            <Text style={styles.rowLabel}>Connection</Text>
            <Text style={{ color: online ? colors.access : colors.reserve, fontWeight: "700" }}>
              {online ? "Online" : "Offline"}
            </Text>
          </Text>
          <Text style={styles.row}>
            <Text style={styles.rowLabel}>Queued changes</Text>
            <Text style={{ color: colors.text, fontWeight: "700" }}>{pending}</Text>
          </Text>
          <Text style={styles.row}>
            <Text style={styles.rowLabel}>Language</Text>
            <Text style={{ color: colors.text, fontWeight: "700" }}>{t(LOCALE_LABEL_KEY[locale])}</Text>
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Theme</Text>
        <View style={styles.chips}>
          {(["system", "light", "dark"] as const).map((m) => (
            <TouchableOpacity
              key={m}
              onPress={() => setMode(m)}
              style={[styles.langBtn, { backgroundColor: mode === m ? colors.primary : colors.surface, borderColor: colors.border }]}
            >
              <Text style={{ color: mode === m ? colors.onPrimary : colors.text, fontWeight: "700", textTransform: "capitalize" }}>
                {m}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionTitle}>{t("lang.label")}</Text>
        <View style={styles.chips}>
          {LOCALES.map((l) => (
            <TouchableOpacity
              key={l}
              onPress={() => setLocale(l)}
              style={[styles.langBtn, { backgroundColor: locale === l ? colors.primary : colors.surface, borderColor: colors.border }]}
            >
              <Text style={{ color: locale === l ? colors.onPrimary : colors.text, fontWeight: "700" }}>
                {t(LOCALE_LABEL_KEY[l])}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.footnote}>Built for Uganda. Works everywhere. Data stays on your device when offline.</Text>
      </View>
    </ScrollView>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    header: { backgroundColor: c.primary, padding: 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
    backBtn: { marginBottom: 12 },
    title: { fontSize: 22, fontWeight: "800", color: c.onPrimary },
    subtitle: { fontSize: 13, color: c.onPrimary, opacity: 0.8, marginTop: 4 },
    content: { padding: 16 },
    sectionTitle: { fontSize: 11, fontWeight: "700", color: c.subtext, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 16, marginBottom: 8 },
    body: { fontSize: 14, color: c.text, lineHeight: 20 },
    card: { backgroundColor: c.surface, borderRadius: 12, borderWidth: 1, borderColor: c.border, padding: 14 },
    row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
    rowLabel: { color: c.subtext, fontSize: 13 },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
    langBtn: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
    footnote: { fontSize: 12, color: c.subtext, marginTop: 24, textAlign: "center" },
  });
}
