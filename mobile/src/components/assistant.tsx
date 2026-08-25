import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../services/api";
import { Palette } from "../constants/branding";
import { useTheme } from "../context/ThemeContext";

type Msg = { role: "user" | "assistant"; text: string };

export default function AssistantScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      text: "Clinical assistant ready. Ask about resistance mechanisms, treatment choices, or drug safety.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages, loading]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const next = [...messages, { role: "user" as const, text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await api.sendAssistantMessage(
        next.map((m) => ({ role: m.role, content: m.text }))
      );
      setMessages((cur) => [...cur, { role: "assistant", text: res.reply }]);
    } catch {
      setMessages((cur) => [
        ...cur,
        { role: "assistant", text: "The assistant is currently unavailable. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.header}>
        <Ionicons name="pulse-outline" size={18} color={colors.text} />
        <Text style={styles.headerTitle}>Clinical Assistant</Text>
      </View>

      <ScrollView ref={scrollRef} style={styles.list} contentContainerStyle={{ gap: 10, padding: 14 }}>
        {messages.map((m, i) => (
          <View key={i} style={[styles.row, m.role === "user" && { justifyContent: "flex-end" }]}>
            <View style={[styles.bubble, m.role === "user" ? styles.bubbleUser : styles.bubbleBot]}>
              <Text style={m.role === "user" ? styles.bubbleUserText : styles.bubbleBotText}>{m.text}</Text>
            </View>
          </View>
        ))}
        {loading && (
          <View style={styles.row}>
            <View style={[styles.bubble, styles.bubbleBot]}>
              <Text style={styles.bubbleBotText}>Preparing response…</Text>
            </View>
          </View>
        )}
      </ScrollView>

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Ask about resistance, dosing, safety…"
          placeholderTextColor={colors.subtext}
          onSubmitEditing={send}
        />
        <TouchableOpacity style={styles.sendBtn} onPress={send} disabled={loading}>
          {loading ? (
            <ActivityIndicator size="small" color={colors.onPrimary} />
          ) : (
            <Ionicons name="send" size={16} color={colors.onPrimary} />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: c.surface,
      paddingHorizontal: 16,
      paddingTop: 56,
      paddingBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    headerTitle: { color: c.text, fontSize: 17, fontWeight: "800" },
    list: { flex: 1 },
    row: { flexDirection: "row" },
    bubble: { maxWidth: "85%", borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
    bubbleUser: { backgroundColor: c.primary, borderBottomRightRadius: 4 },
    bubbleBot: {
      backgroundColor: c.surface,
      borderBottomLeftRadius: 4,
      borderWidth: 1,
      borderColor: c.border,
    },
    bubbleUserText: { color: c.onPrimary, fontSize: 14, lineHeight: 20 },
    bubbleBotText: { color: c.text, fontSize: 14, lineHeight: 20 },
    inputRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      padding: 12,
      borderTopWidth: 1,
      borderTopColor: c.border,
      backgroundColor: c.surface,
    },
    input: {
      flex: 1,
      backgroundColor: c.background,
      borderRadius: 22,
      paddingHorizontal: 16,
      paddingVertical: 10,
      fontSize: 14,
      color: c.text,
      borderWidth: 1,
      borderColor: c.border,
    },
    sendBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.primary,
      justifyContent: "center",
      alignItems: "center",
    },
  });
}
