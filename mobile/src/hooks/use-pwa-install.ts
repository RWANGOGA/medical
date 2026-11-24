import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

function detectStandalone(): boolean {
  if (Platform.OS !== "web" || typeof window === "undefined") return false;
  const standalone = window.matchMedia?.("(display-mode: standalone)")?.matches;
  const iosStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone;
  return Boolean(standalone || iosStandalone);
}

/**
 * Exposes the browser's PWA install prompt.
 *
 * Chrome/Edge fire `beforeinstallprompt` once the manifest, service worker and
 * HTTPS requirements are met. We capture it so the app can offer an explicit
 * "Install app" button at the top of every page instead of relying on users
 * finding the small install icon in the address bar.
 */
export function usePwaInstall() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState<boolean>(detectStandalone);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = useCallback(async (): Promise<"accepted" | "dismissed" | "unavailable"> => {
    if (!promptEvent) return "unavailable";
    setInstalling(true);
    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      setPromptEvent(null);
      if (choice.outcome === "accepted") setInstalled(true);
      return choice.outcome;
    } catch {
      return "unavailable";
    } finally {
      setInstalling(false);
    }
  }, [promptEvent]);

  return {
    canInstall: Platform.OS === "web" && !installed && Boolean(promptEvent),
    installed,
    installing,
    install,
  };
}
