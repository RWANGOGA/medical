/**
 * Clinical design tokens for the Antimicrobial Stewardship Platform.
 * Palettes are defined for light and dark mode and consumed via useTheme().
 */

export interface Palette {
  background: string;
  surface: string;
  surfaceAlt: string;
  text: string;
  subtext: string;
  border: string;
  primary: string;
  primarySoft: string;
  onPrimary: string;
  access: string;
  watch: string;
  reserve: string;
  dangerSoft: string;
}

export const PALETTES: Record<"light" | "dark", Palette> = {
  light: {
    background: "#F8FAFC",   // Slate 50
    surface: "#FFFFFF",
    surfaceAlt: "#F1F5F9",   // Slate 100
    text: "#0F172A",         // Slate 900
    subtext: "#64748B",      // Slate 500
    border: "#E2E8F0",       // Slate 200
    primary: "#0284C7",      // Clinical sky blue
    primarySoft: "#E0F2FE",  // Sky 100
    onPrimary: "#FFFFFF",
    access: "#059669",       // AWaRe Access
    watch: "#D97706",        // AWaRe Watch
    reserve: "#E11D48",      // AWaRe Reserve
    dangerSoft: "#FEF2F2",   // Red 50
  },
  dark: {
    background: "#0B1120",   // Slate 950
    surface: "#1E293B",      // Slate 800
    surfaceAlt: "#0F172A",   // Slate 900
    text: "#F1F5F9",         // Slate 100
    subtext: "#94A3B8",      // Slate 400
    border: "#334155",       // Slate 700
    primary: "#38BDF8",      // Sky 400
    primarySoft: "#0C4A6E",  // Sky 900
    onPrimary: "#0B1120",
    access: "#34D399",       // Emerald 400
    watch: "#FBBF24",        // Amber 400
    reserve: "#FB7185",      // Rose 400
    dangerSoft: "#3B1220",   // Dark rose tint
  },
};

export const BRANDING = {
  appName: "Steward AMR",
  officialName: "Antimicrobial Stewardship Platform",
  origin: "Originally piloted with Makerere College of Health Sciences",
  /** Kept for compatibility; resolves to the light palette. Use useTheme() instead. */
  colors: PALETTES.light,
};
