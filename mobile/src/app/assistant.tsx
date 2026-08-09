import React, { createContext, useContext, useState, useRef, useEffect } from "react";
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, TextInput,
  ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../services/api";
import { BRANDING } from "../constants/branding";

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

      {/* Floating button — always on top */}
      <TouchableOpacity style={styles.fab} onPress={() => setOpen(true)} activeOpacity={0.85}>
        <Ionicons name="chatbubble-ellipses" size={20} color="#fff" />
      </TouchableOpacity>

      <AssistantSheet open={open} onClose={() => setOpen(false)} />
    </AssistantContext.Provider>
  );
}

function AssistantSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [messages, setMessages] = useState<{ role: string; text: string }[]>([
    { role: "assistant", text: "I'm your AMR clinical assistant. Ask about resistance mechanisms, treatment choices, or drug safety — I'll explain the reasoning." },
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
      setMessages((cur) => [...cur, { role: "assistant", text: "Something went wrong reaching the assistant. Please try again." }]);
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
              <Ionicons name="sparkles" size={16} color={BRANDING.colors.primary} />
              <Text style={styles.sheetTitle}>AI Clinical Assistant</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={20} color={BRANDING.colors.subtext} />
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
                  <Text style={styles.bubbleBotText}>Thinking…</Text>
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
              placeholderTextColor={BRANDING.colors.subtext}
              onSubmitEditing={send}
            />
            <TouchableOpacity style={styles.sendBtn} onPress={send} disabled={loading}>
              {loading ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="send" size={16} color="#fff" />}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute", top: 50, right: 16, zIndex: 1000,
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: BRANDING.colors.primary,
    justifyContent: "center", alignItems: "center",
    shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 8,
  },
  modalWrap: { flex: 1 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: {
    position: "absolute", left: 0, right: 0, bottom: 0, height: "78%",
    backgroundColor: BRANDING.colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    overflow: "hidden",
  },
  sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: BRANDING.colors.border },
  sheetTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  sheetTitle: { fontSize: 15, fontWeight: "700", color: BRANDING.colors.text },
  messageList: { flex: 1 },
  bubbleRow: { flexDirection: "row" },
  bubble: { maxWidth: "85%", borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleUser: { backgroundColor: BRANDING.colors.primary, borderBottomRightRadius: 4 },
  bubbleBot: { backgroundColor: BRANDING.colors.background, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: BRANDING.colors.border },
  bubbleUserText: { color: "#fff", fontSize: 14, lineHeight: 20 },
  bubbleBotText: { color: BRANDING.colors.text, fontSize: 14, lineHeight: 20 },
  inputRow: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: BRANDING.colors.border },
  input: { flex: 1, backgroundColor: BRANDING.colors.background, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: BRANDING.colors.text, borderWidth: 1, borderColor: BRANDING.colors.border },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: BRANDING.colors.primary, justifyContent: "center", alignItems: "center" },
});