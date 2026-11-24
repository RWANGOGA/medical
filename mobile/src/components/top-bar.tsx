import { useState } from "react";
import { Modal, Platform, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import { usePwaInstall } from "../hooks/use-pwa-install";
import { useOffline } from "../hooks/use-offline";
import { downloadApk, openInstallHelp } from "../constants/downloads";
import { useI18n } from "../context/I18nContext";
import { LOCALES, LOCALE_LABEL_KEY } from "../i18n";
import { useResponsive } from "../utils/responsive";

/**
 * Persistent download / install bar shown above the app on the web.
 *
 * Mirrors the browser's install affordance so visitors can either install the
 * PWA in a dedicated window or download the Android APK, from any page.
 */
export function AppTopBar() {
  const { colors } = useTheme();
  const { canInstall, installing, installed, install } = usePwaInstall();
  const { online, pending, syncing, syncNow } = useOffline();
  const { isPhone } = useResponsive();
  const { locale, setLocale, t } = useI18n();
  const [helpVisible, setHelpVisible] = useState(false);
  const [langVisible, setLangVisible] = useState(false);

  if (Platform.OS !== "web") return null;

  const handleInstall = async () => {
    if (canInstall) {
      const outcome = await install();
      if (outcome === "accepted") return;
    }
    setHelpVisible(true);
  };

  return (
    <>
    <View
      style={[
        styles.bar,
        {
          backgroundColor: colors.surface,
          borderBottomColor: colors.border,
        },
      ]}
    >
      <View style={styles.inner}>
        <View style={styles.brand}>
          <View style={[styles.logo, { backgroundColor: colors.primarySoft }]}>
            <Ionicons name="shield-checkmark" size={16} color={colors.primary} />
          </View>
          <Text style={[styles.brandName, { color: colors.text }]} numberOfLines={1}>
            Steward AMR
          </Text>
          {!isPhone && (
            <View style={[styles.ugandaChip, { backgroundColor: colors.surfaceAlt }]}>
              <Text style={[styles.ugandaText, { color: colors.subtext }]}>UGANDA</Text>
            </View>
          )}
        </View>

        <View style={styles.actions}>
          {!online && (
            <View style={styles.offlineChip}>
              <Ionicons name="cloud-offline-outline" size={13} color="#B45309" />
              <Text style={styles.offlineText}>
                Offline{pending > 0 ? ` · ${pending} queued` : " · saved data"}
              </Text>
            </View>
          )}

          {online && pending > 0 && (
            <TouchableOpacity
              style={[styles.syncChip, { borderColor: colors.border }]}
              onPress={syncNow}
              accessibilityRole="button"
              accessibilityLabel={`Sync ${pending} offline changes`}
            >
              <Ionicons
                name={syncing ? "sync" : "cloud-upload-outline"}
                size={13}
                color={colors.primary}
              />
              <Text style={[styles.syncText, { color: colors.primary }]}>
                {syncing ? "Syncing…" : `Sync ${pending}`}
              </Text>
            </TouchableOpacity>
          )}

          {!installed && (
            <TouchableOpacity
              style={[styles.secondaryButton, { borderColor: colors.primary }]}
              onPress={handleInstall}
              disabled={installing}
              accessibilityRole="button"
              accessibilityLabel="Install the web app on this device"
            >
              <Ionicons name="download-outline" size={15} color={colors.primary} />
              {!isPhone && (
                <Text style={[styles.secondaryText, { color: colors.primary }]}>
                  {installing ? "Installing…" : "Install app"}
                </Text>
              )}
            </TouchableOpacity>
          )}

          {installed && !isPhone && (
            <View style={styles.installedChip}>
              <Ionicons name="checkmark-circle" size={14} color="#059669" />
              <Text style={styles.installedText}>Installed</Text>
            </View>
          )}

          <TouchableOpacity
            onPress={() => setLangVisible(true)}
            style={[styles.secondaryButton, { borderColor: colors.border }]}
            accessibilityRole="button"
            accessibilityLabel={t("lang.label")}
          >
            <Ionicons name="language" size={15} color={colors.subtext} />
            {!isPhone && (
              <Text style={[styles.secondaryText, { color: colors.subtext }]}>
                {t(LOCALE_LABEL_KEY[locale])}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: colors.primary }]}
            onPress={() => downloadApk().catch(() => undefined)}
            accessibilityRole="button"
            accessibilityLabel="Download the Android APK"
          >
            <Ionicons name="logo-android" size={16} color={colors.onPrimary} />
            <Text style={[styles.primaryText, { color: colors.onPrimary }]}>
              {isPhone ? "APK" : "Download Android app"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>

    <Modal
      visible={helpVisible}
      transparent
      animationType="fade"
      onRequestClose={() => setHelpVisible(false)}
    >
      <View style={styles.modalRoot}>
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setHelpVisible(false)}
          accessibilityLabel="Dismiss install instructions"
        />
        <View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.modalTitle, { color: colors.text }]}>Install Steward AMR</Text>
          <Text style={[styles.modalBody, { color: colors.subtext }]}>
            Install the web app in its own window, or download the Android APK. Both work offline.
          </Text>

          <View style={styles.modalStep}>
            <Ionicons name="desktop-outline" size={16} color={colors.primary} />
            <Text style={[styles.modalStepText, { color: colors.text }]}>
              <Text style={styles.modalStepLabel}>Chrome / Edge:</Text> use the install icon in the
              address bar, or menu ⋮ → “Install Steward AMR”.
            </Text>
          </View>
          <View style={styles.modalStep}>
            <Ionicons name="phone-portrait-outline" size={16} color={colors.primary} />
            <Text style={[styles.modalStepText, { color: colors.text }]}>
              <Text style={styles.modalStepLabel}>Android Chrome:</Text> menu ⋮ → “Add to Home screen”.
            </Text>
          </View>
          <View style={styles.modalStep}>
            <Ionicons name="logo-apple" size={16} color={colors.primary} />
            <Text style={[styles.modalStepText, { color: colors.text }]}>
              <Text style={styles.modalStepLabel}>iPhone Safari:</Text> Share → “Add to Home Screen”.
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.modalPrimary, { backgroundColor: colors.primary }]}
            onPress={() => {
              setHelpVisible(false);
              downloadApk().catch(() => undefined);
            }}
            accessibilityRole="button"
            accessibilityLabel="Download the Android APK"
          >
            <Ionicons name="logo-android" size={17} color={colors.onPrimary} />
            <Text style={[styles.modalPrimaryText, { color: colors.onPrimary }]}>
              Download Android APK
            </Text>
          </TouchableOpacity>

          <View style={styles.modalLinks}>
            <TouchableOpacity onPress={() => openInstallHelp().catch(() => undefined)}>
              <Text style={[styles.modalLink, { color: colors.primary }]}>Installation help</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setHelpVisible(false)}>
              <Text style={[styles.modalLink, { color: colors.subtext }]}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>

    <Modal
      visible={langVisible}
      transparent
      animationType="fade"
      onRequestClose={() => setLangVisible(false)}
    >
      <View style={styles.modalRoot}>
        <Pressable style={styles.modalBackdrop} onPress={() => setLangVisible(false)} />
        <View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.modalTitle, { color: colors.text }]}>{t("lang.label")}</Text>
          {LOCALES.map((l) => (
            <TouchableOpacity
              key={l}
              style={[styles.modalStep, { paddingVertical: 10 }]}
              onPress={async () => { await setLocale(l); setLangVisible(false); }}
              accessibilityRole="button"
            >
              <Ionicons
                name={locale === l ? "checkmark-circle" : "ellipse-outline"}
                size={18}
                color={locale === l ? colors.primary : colors.subtext}
              />
              <Text style={[styles.modalStepText, { color: colors.text, fontWeight: locale === l ? "800" : "500" }]}>
                {t(LOCALE_LABEL_KEY[l])}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bar: {
    width: "100%",
    borderBottomWidth: 1,
    zIndex: 100,
  },
  inner: {
    width: "100%",
    maxWidth: 1400,
    alignSelf: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap",
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 8 },
  logo: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  brandName: { fontSize: 14, fontWeight: "800", letterSpacing: 0.2 },
  ugandaChip: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  ugandaText: { fontSize: 9, fontWeight: "800", letterSpacing: 0.8 },
  actions: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  offlineChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#FEF3C7",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  offlineText: { fontSize: 11, fontWeight: "700", color: "#B45309" },
  syncChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  syncText: { fontSize: 11, fontWeight: "700" },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  secondaryText: { fontSize: 12, fontWeight: "700" },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  primaryText: { fontSize: 12, fontWeight: "800" },
  installedChip: { flexDirection: "row", alignItems: "center", gap: 4 },
  installedText: { fontSize: 11, fontWeight: "700", color: "#059669" },
  modalRoot: { flex: 1, justifyContent: "center", alignItems: "center", padding: 18 },
  modalBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(2, 6, 23, 0.55)",
  },
  modalCard: {
    width: "100%",
    maxWidth: 460,
    borderRadius: 18,
    borderWidth: 1,
    padding: 22,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  modalTitle: { fontSize: 18, fontWeight: "800" },
  modalBody: { fontSize: 13, lineHeight: 19, marginTop: 6, marginBottom: 16 },
  modalStep: { flexDirection: "row", gap: 10, marginBottom: 12, alignItems: "flex-start" },
  modalStepText: { fontSize: 12.5, lineHeight: 18, flex: 1 },
  modalStepLabel: { fontWeight: "800" },
  modalPrimary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 11,
    paddingVertical: 12,
    marginTop: 6,
  },
  modalPrimaryText: { fontSize: 14, fontWeight: "800" },
  modalLinks: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 14,
  },
  modalLink: { fontSize: 12.5, fontWeight: "700", textDecorationLine: "underline" },
});
