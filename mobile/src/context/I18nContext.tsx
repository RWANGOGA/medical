import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Locale, translate, DEFAULT_LOCALE } from "../i18n";

const STORAGE_KEY = "steward:locale:v1";

interface I18nContextType {
  locale: Locale;
  setLocale: (l: Locale) => Promise<void>;
  t: (key: string, fallback?: string) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved === "en" || saved === "lg" || saved === "sw") setLocaleState(saved as Locale);
      } catch {
        // ignore
      }
    })();
  }, []);

  const setLocale = async (l: Locale) => {
    setLocaleState(l);
    try { await AsyncStorage.setItem(STORAGE_KEY, l); } catch { /* ignore */ }
  };

  const t = (key: string, fallback?: string) => translate(locale, key, fallback);

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}

export function useTranslation() {
  return useI18n();
}