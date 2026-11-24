import React, { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import { useI18n } from "../context/I18nContext";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "steward:onboarded:v1";

interface Step {
  icon: string;
  title: string;
  body: string;
}

export function OnboardingTour() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const done = await AsyncStorage.getItem(STORAGE_KEY);
        if (!done) setVisible(true);
      } catch {
        // ignore
      }
    })();
  }, []);

  const steps: Step[] = [
    { icon: "shield-checkmark", title: "Welcome to Steward AMR", body: "Antimicrobial-resistance surveillance and stewardship for Ugandan hospitals. Works offline on any device." },
    { icon: "search", title: t("nav.search"), body: "Look up organisms and antibiotics, with WHO AWaRe categories and Uganda brand names." },
    { icon: "pulse", title: t("nav.resistance"), body: "Browse the hospital antibiogram and WHO-priority resistant organisms." },
    { icon: "cloud-offline", title: t("common.offline"), body: "Data is cached locally and writes are queued until you reconnect." },
    { icon: "download", title: t("common.getTheApp"), body: "Install the web app or download the Android APK from the bar at the top of every page." },
  ];

  const close = async () => {
    setVisible(false);
    try { await AsyncStorage.setItem(STORAGE_KEY, "1"); } catch { /* ignore */ }
  };

  if (!visible) return null;

  const current = steps[step];
  const isLast = step === steps.length - 1;

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={close}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={close} />
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.iconWrap, { backgroundColor: colors.primarySoft }]}>
            <Ionicons name={current.icon as any} size={28} color={colors.primary} />
          </View>
          <Text style={[styles.title, { color: colors.text }]}>{current.title}</Text>
          <Text style={[styles.body, { color: colors.subtext }]}>{current.body}</Text>

          <View style={styles.dots}>
            {steps.map((_, i) => (
              <View
                key={i}
                style={[styles.dot, { backgroundColor: i === step ? colors.primary : colors.border }]}
              />
            ))}
          </View>

          <View style={styles.actions}>
            <TouchableOpacity onPress={close} accessibilityRole="button">
              <Text style={[styles.skip, { color: colors.subtext }]}>Skip</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.next, { backgroundColor: colors.primary }]}
              onPress={() => (isLast ? close() : setStep((s) => s + 1))}
              accessibilityRole="button"
            >
              <Text style={[styles.nextText, { color: colors.onPrimary }]}>
                {isLast ? "Get started" : "Next"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  backdrop: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(2,6,23,0.55)" },
  card: { width: "100%", maxWidth: 420, borderRadius: 20, borderWidth: 1, padding: 24, alignItems: "center", shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 20, elevation: 10 },
  iconWrap: { width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center", marginBottom: 14 },
  title: { fontSize: 18, fontWeight: "800", textAlign: "center" },
  body: { fontSize: 13, lineHeight: 19, textAlign: "center", marginTop: 8 },
  dots: { flexDirection: "row", gap: 6, marginTop: 16, marginBottom: 18 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  actions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "100%" },
  skip: { fontSize: 13, fontWeight: "700" },
  next: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10 },
  nextText: { fontSize: 13, fontWeight: "800" },
});