/**
 * ThemeContext: mode resolution (system/light/dark), palette switching,
 * and AsyncStorage persistence of the Appearance setting.
 */
import React from "react";
import { Text, TouchableOpacity } from "react-native";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ThemeProvider, useTheme } from "../ThemeContext";
import { PALETTES } from "../../constants/branding";

function Probe() {
  const { colors, isDark, mode, setMode } = useTheme();
  return (
    <>
      <Text testID="bg">{colors.background}</Text>
      <Text testID="isDark">{String(isDark)}</Text>
      <Text testID="mode">{mode}</Text>
      <TouchableOpacity testID="set-dark" onPress={() => setMode("dark")} />
      <TouchableOpacity testID="set-light" onPress={() => setMode("light")} />
    </>
  );
}

describe("ThemeProvider", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  const textOf = (el: any): string =>
    Array.isArray(el.props.children) ? el.props.children.join("") : String(el.props.children);

  it("defaults to system mode resolving to the light palette", async () => {
    const { getByTestId } = await render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>
    );

    await waitFor(() => expect(textOf(getByTestId("mode"))).toBe("system"));
    // jest-expo's default color scheme is light
    expect(textOf(getByTestId("bg"))).toBe(PALETTES.light.background);
    expect(textOf(getByTestId("isDark"))).toBe("false");
  });

  it("switches to the dark palette and persists the choice", async () => {
    const { getByTestId } = await render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>
    );

    fireEvent.press(getByTestId("set-dark"));

    await waitFor(() => expect(textOf(getByTestId("bg"))).toBe(PALETTES.dark.background));
    expect(textOf(getByTestId("isDark"))).toBe("true");
    await waitFor(async () => {
      expect(await AsyncStorage.getItem("themeMode")).toBe("dark");
    });
  });

  it("restores the persisted mode on mount", async () => {
    await AsyncStorage.setItem("themeMode", "dark");

    const { getByTestId } = await render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>
    );

    await waitFor(() => expect(textOf(getByTestId("bg"))).toBe(PALETTES.dark.background));
    expect(textOf(getByTestId("mode"))).toBe("dark");
  });

  it("ignores invalid stored values", async () => {
    await AsyncStorage.setItem("themeMode", "neon");

    const { getByTestId } = await render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>
    );

    await waitFor(() => expect(textOf(getByTestId("mode"))).toBe("system"));
    expect(textOf(getByTestId("bg"))).toBe(PALETTES.light.background);
  });
});

describe("useTheme", () => {
  it("throws a helpful error outside ThemeProvider", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    await expect(render(<Probe />)).rejects.toThrow("useTheme must be used within ThemeProvider");
    consoleSpy.mockRestore();
  });
});
