import React, { createContext, useContext, useState, useRef, useEffect, useMemo } from "react";
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, TextInput,
  ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../services/api";
import { Palette } from "../constants/branding";
import { useTheme } from "./ThemeContext";

type Ctx = { openAssistant: () => void };
const AssistantContext = createContext<Ctx | undefined>(undefined);

export function useAssistant() {
  const ctx = useContext(AssistantContext);
  if (!ctx) throw new Error("useAssistant must be used within AssistantProvider");
  return ctx;
}

export function AssistantProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <AssistantContext.Provider value={{ openAssistant: () => setOpen(true) }}>
      {children}

      {/* Floating chatbot button — always visible on top of every screen */}
      {!open && <AssistantFab onPress={() => setOpen(true)} />}

      <AssistantSheet open={open} onClose={() => setOpen(false)} />
    </AssistantContext.Provider>
  );
}

function AssistantFab({ onPress }: { onPress: () => void }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <TouchableOpacity
      style={{
        position: "absolute",
        top: insets.top + 8,
        right: 16,
        zIndex: 1000,
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: colors.primary,
        justifyContent: "center",
        alignItems: "center",
        shadowColor: "#000",
        shadowOpacity: 0.25,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
        elevation: 8,
      }}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityLabel="Open clinical assistant"
    >
      <Ionicons name="chatbubble-ellipses" size={20} color={colors.onPrimary} />
    </TouchableOpacity>
  );
}

function AssistantSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [messages, setMessages] = useState<{ role: string; text: string }[]>([
    { role: "assistant", text: "Clinical assistant ready. Ask about resistance mechanisms, treatment choices, or drug safety — responses include the reasoning." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (open) scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages, loading, open]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const next = [...messages, { role: "user", text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await api.sendAssistantMessage(
        next.map((m) => ({ role: m.role, content: m.text }))
      );
      setMessages((cur) => [...cur, { role: "assistant", text: res.reply }]);
    } catch {
      setMessages((cur) => [...cur, { role: "assistant", text: "The assistant is currently unavailable. Please try again." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.modalWrap} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <View style={styles.sheetTitleRow}>
              <Ionicons name="pulse-outline" size={16} color={colors.primary} />
              <Text style={styles.sheetTitle}>Clinical Assistant</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={20} color={colors.subtext} />
            </TouchableOpacity>
          </View>

          <ScrollView ref={scrollRef} style={styles.messageList} contentContainerStyle={{ gap: 10, padding: 14 }}>
            {messages.map((m, i) => (
              <View key={i} style={[styles.bubbleRow, m.role === "user" ? { justifyContent: "flex-end" } : { justifyContent: "flex-start" }]}>
                <View style={[styles.bubble, m.role === "user" ? styles.bubbleUser : styles.bubbleBot]}>
                  <Text style={m.role === "user" ? styles.bubbleUserText : styles.bubbleBotText}>{m.text}</Text>
                </View>
              </View>
            ))}
            {loading && (
              <View style={styles.bubbleRow}>
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
              {loading ? <ActivityIndicator size="small" color={colors.onPrimary} /> : <Ionicons name="send" size={16} color={colors.onPrimary} />}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    modalWrap: { flex: 1 },
    backdrop: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.4)" },
    sheet: {
      position: "absolute", left: 0, right: 0, bottom: 0, height: "78%",
      backgroundColor: c.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
      overflow: "hidden",
    },
    sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: c.border },
    sheetTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    sheetTitle: { fontSize: 15, fontWeight: "700", color: c.text },
    messageList: { flex: 1, backgroundColor: c.background },
    bubbleRow: { flexDirection: "row" },
    bubble: { maxWidth: "85%", borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
    bubbleUser: { backgroundColor: c.primary, borderBottomRightRadius: 4 },
    bubbleBot: { backgroundColor: c.surface, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: c.border },
    bubbleUserText: { color: c.onPrimary, fontSize: 14, lineHeight: 20 },
    bubbleBotText: { color: c.text, fontSize: 14, lineHeight: 20 },
    inputRow: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.surface },
    input: { flex: 1, backgroundColor: c.background, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: c.text, borderWidth: 1, borderColor: c.border },
    sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.primary, justifyContent: "center", alignItems: "center" },
  });
}
