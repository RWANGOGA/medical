import React, { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";
import { SafeAreaView, Edge } from "react-native-safe-area-context";
import { useTheme } from "../context/ThemeContext";
import { useResponsive } from "../utils/responsive";

/** Content column width cap so layouts stay readable on tablets and web. */
export const CONTENT_MAX_WIDTH = 720;

/** Wider content column for desktop */
export const CONTENT_MAX_WIDTH_WIDE = 1100;

interface ScreenProps {
  children: ReactNode;
  /** Wrap children in a ScrollView */
  scroll?: boolean;
  /** Avoid the on-screen keyboard (forms) */
  keyboardAvoid?: boolean;
  /** Extra style for the outer container */
  style?: StyleProp<ViewStyle>;
  /** Extra style for the centered content column */
  contentStyle?: StyleProp<ViewStyle>;
  /** Safe-area edges to respect (defaults to all) */
  edges?: Edge[];
  /** ScrollView keyboard behavior */
  keyboardShouldPersistTaps?: "always" | "never" | "handled";
  /** Use wider content column on desktop */
  wide?: boolean;
}

/**
 * Standard screen wrapper: safe-area aware, theme-aware, and responsive.
 * Content is full width on phones and capped at CONTENT_MAX_WIDTH on wide screens.
 */
export function Screen({
  children,
  scroll = false,
  keyboardAvoid = false,
  style,
  contentStyle,
  edges = ["top", "bottom", "left", "right"],
  keyboardShouldPersistTaps = "handled",
  wide = false,
}: ScreenProps) {
  const { colors } = useTheme();
  const { isDesktopOrLarger } = useResponsive();

  const maxWidth = wide && isDesktopOrLarger ? CONTENT_MAX_WIDTH_WIDE : CONTENT_MAX_WIDTH;

  const column = (
    <View style={[styles.column, { maxWidth }, contentStyle]}>{children}</View>
  );

  let body: ReactNode;
  if (scroll) {
    body = (
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        showsVerticalScrollIndicator={false}
      >
        {column}
      </ScrollView>
    );
  } else {
    body = column;
  }

  if (keyboardAvoid) {
    body = (
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {body}
      </KeyboardAvoidingView>
    );
  }

  return (
    <SafeAreaView
      edges={edges}
      style={[styles.container, { backgroundColor: colors.background }, style]}
    >
      {body}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  column: {
    width: "100%",
    alignSelf: "center",
    flex: 1,
  },
});
