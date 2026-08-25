/**
 * Design-token integrity: every screen depends on these palettes, so both
 * themes must expose the exact same token surface and stay clinically tuned.
 */
import { BRANDING, PALETTES, Palette } from "../branding";

const REQUIRED_TOKENS: (keyof Palette)[] = [
  "background", "surface", "surfaceAlt", "text", "subtext", "border",
  "primary", "primarySoft", "onPrimary", "access", "watch", "reserve", "dangerSoft",
];

describe("PALETTES", () => {
  it("provides light and dark palettes", () => {
    expect(PALETTES.light).toBeDefined();
    expect(PALETTES.dark).toBeDefined();
  });

  it.each(["light", "dark"] as const)("%s palette defines every clinical token", (mode) => {
    for (const token of REQUIRED_TOKENS) {
      expect(typeof PALETTES[mode][token]).toBe("string");
      // every token is a hex color
      expect(PALETTES[mode][token]).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it("light and dark are actually different themes", () => {
    expect(PALETTES.light.background).not.toBe(PALETTES.dark.background);
    expect(PALETTES.light.text).not.toBe(PALETTES.dark.text);
    expect(PALETTES.light.surface).not.toBe(PALETTES.dark.surface);
  });

  it("dark theme uses dark backgrounds with light text", () => {
    // crude luminance sanity: dark bg is low, dark text is high
    const luminance = (hex: string) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    expect(luminance(PALETTES.dark.background)).toBeLessThan(60);
    expect(luminance(PALETTES.dark.text)).toBeGreaterThan(180);
    expect(luminance(PALETTES.light.background)).toBeGreaterThan(180);
    expect(luminance(PALETTES.light.text)).toBeLessThan(60);
  });

  it("keeps AWaRe accent categories in both modes", () => {
    for (const mode of ["light", "dark"] as const) {
      expect(PALETTES[mode].access).not.toBe(PALETTES[mode].watch);
      expect(PALETTES[mode].watch).not.toBe(PALETTES[mode].reserve);
      expect(PALETTES[mode].access).not.toBe(PALETTES[mode].reserve);
    }
  });
});

describe("BRANDING", () => {
  it("exposes neutral professional identity fields", () => {
    expect(BRANDING.appName).toBe("Steward AMR");
    expect(BRANDING.officialName).toBeTruthy();
  });

  it("legacy BRANDING.colors resolves to the light palette", () => {
    expect(BRANDING.colors).toBe(PALETTES.light);
  });
});
