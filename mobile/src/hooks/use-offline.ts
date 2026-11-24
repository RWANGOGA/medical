import { useEffect, useState } from "react";
import { flushPendingMutations } from "../services/api";
import {
  OfflineState,
  getOfflineState,
  initOfflineDetection,
  subscribeOffline,
} from "../services/offline";

let detectionStarted = false;

/**
 * Observable offline state plus manual/automatic queue syncing.
 * Shared by the top bar, navigation bar and footer badges.
 */
export function useOffline() {
  const [state, setState] = useState<OfflineState>(getOfflineState);

  useEffect(() => subscribeOffline(setState), []);

  useEffect(() => {
    if (!detectionStarted) {
      detectionStarted = true;
      initOfflineDetection();
    }
    if (typeof window === "undefined") return;
    const onOnline = () => {
      flushPendingMutations().catch(() => undefined);
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);

  // Keep retrying queued writes while the connection looks usable.
  useEffect(() => {
    if (!state.online || state.pending === 0 || state.syncing) return;
    const timer = setInterval(() => {
      flushPendingMutations().catch(() => undefined);
    }, 25000);
    return () => clearInterval(timer);
  }, [state.online, state.pending, state.syncing]);

  return {
    ...state,
    syncNow: () => flushPendingMutations().catch(() => undefined),
  };
}
