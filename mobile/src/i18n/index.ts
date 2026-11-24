import { en } from "./en";
import { lg } from "./lg";
import { sw } from "./sw";

export type Locale = "en" | "lg" | "sw";
export const LOCALES: Locale[] = ["en", "lg", "sw"];
export const LOCALE_LABEL_KEY: Record<Locale, string> = {
  en: "lang.en",
  lg: "lang.lg",
  sw: "lang.sw",
};

const DICTS: Record<Locale, Record<string, string>> = {
  en: en as Record<string, string>,
  lg,
  sw,
};

export function translate(locale: Locale, key: string, fallback?: string): string {
  const dict = DICTS[locale];
  if (dict && Object.prototype.hasOwnProperty.call(dict, key)) return dict[key];
  if (locale !== "en" && Object.prototype.hasOwnProperty.call(DICTS.en, key)) return (DICTS.en as any)[key];
  return fallback ?? key;
}

export const DEFAULT_LOCALE: Locale = "en";