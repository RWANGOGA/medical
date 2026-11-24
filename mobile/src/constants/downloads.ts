/**
 * Distribution links and install helpers.
 *
 * The Android APK is published by .github/workflows/build-apk.yml to the
 * `apk-latest` GitHub Release on every push that touches mobile/.
 * Keep these in sync if the repository or release tag ever changes.
 */
import { Linking, Platform } from "react-native";

export const APK_DOWNLOAD_URL =
  "https://github.com/RWANGOGA/medical/releases/download/apk-latest/medical.apk";

export const RELEASE_PAGE_URL =
  "https://github.com/RWANGOGA/medical/releases/tag/apk-latest";

/** Served by GitHub Pages from mobile/public/download.html */
export const DOWNLOAD_PAGE_PATH = "/medical/download.html";

/** PWA assets served from mobile/public on GitHub Pages. */
export const PWA_MANIFEST_PATH = "/medical/manifest.json";
export const PWA_SERVICE_WORKER_PATH = "/medical/sw.js";

/**
 * Start an APK download.
 *
 * On the web a hidden anchor with `download` gives the expected "save file"
 * behaviour; on Android/iOS the system browser handles the release redirect.
 */
export async function downloadApk(): Promise<void> {
  if (Platform.OS === "web") {
    if (typeof document === "undefined") return;
    const anchor = document.createElement("a");
    anchor.href = APK_DOWNLOAD_URL;
    anchor.download = "medical.apk";
    anchor.rel = "noopener noreferrer";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    return;
  }
  await Linking.openURL(APK_DOWNLOAD_URL);
}

/** Open the installation help page (or the release page off-web). */
export async function openInstallHelp(): Promise<void> {
  if (Platform.OS === "web") {
    if (typeof window === "undefined") return;
    window.open(new URL(DOWNLOAD_PAGE_PATH, window.location.origin).toString(), "_blank", "noopener");
    return;
  }
  await Linking.openURL(RELEASE_PAGE_URL);
}
