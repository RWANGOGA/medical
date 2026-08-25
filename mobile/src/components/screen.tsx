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

/** Content column width cap so layouts stay readable on tablets and web. */
export const CONTENT_MAX_WIDTH = 720;

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
}: ScreenProps) {
  const { colors } = useTheme();

  const column = (
    <View style={[styles.column, contentStyle]}>{children}</View>
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
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: "center",
    flex: 1,
  },
});
