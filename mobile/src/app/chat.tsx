import { useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView, Platform, Alert, ScrollView,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Audio } from "expo-av";
import { api, getStoredToken } from "../services/api";
import { BRANDING } from "../constants/branding";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";

const WS_BASE = "ws://localhost:8002/api/v1/chat/ws";
const LANGUAGES = ["English", "Swahili", "Luganda", "French", "Arabic"];

export default function ChatScreen() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [online, setOnline] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [connected, setConnected] = useState(false);
  const [replyTo, setReplyTo] = useState<any>(null);
  const [recording, setRecording] = useState<any>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [playingId, setPlayingId] = useState<number | null>(null);
  const [language, setLanguage] = useState("English");
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const wsRef = useRef<WebSocket | null>(null);
  const listRef = useRef<FlatList>(null);
  const soundRef = useRef<any>(null);
  const translatingRef = useRef<Set<string>>(new Set());

  const { data: history } = useQuery({ queryKey: ["chat"], queryFn: api.getChatMessages });

  useEffect(() => {
    if (history) setMessages(history);
  }, [history]);

  useEffect(() => {
    let socket: WebSocket | null = null;
    let cancelled = false;

    const connect = async () => {
      const token = await getStoredToken();
      if (cancelled || !token) return;
      socket = new WebSocket(`${WS_BASE}?token=${token}`);
      wsRef.current = socket;

      socket.onopen = () => setConnected(true);
      socket.onclose = () => setConnected(false);

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "presence") {
            setOnline(data.online || []);
          } else if (data.type === "message") {
            setMessages((prev) => {
              if (prev.some((m) => m.id === data.id)) return prev;
              return [...prev, data];
            });
          }
        } catch {}
      };
    };

    connect();
    return () => {
      cancelled = true;
      socket?.close();
    };
  }, []);

  useEffect(() => {
    if (messages.length) listRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  // Translate messages when language changes
  useEffect(() => {
    if (language === "English") return;

    const missing = messages.filter(
      (m) =>
        m.sender_id !== user?.id &&
        !m.audio_data &&
        m.message &&
        !translations[`${m.id}:${language}`] &&
        !translatingRef.current.has(`${m.id}:${language}`)
    );

    missing.forEach(async (m) => {
      const key = `${m.id}:${language}`;
      translatingRef.current.add(key);
      try {
        const res = await api.translate({ text: m.message, target_language: language });
        setTranslations((prev) => ({ ...prev, [key]: res.translated }));
      } catch (err) {
        console.error("Translation failed:", err);
      }
      translatingRef.current.delete(key);
    });
  }, [messages, language, user?.id, translations]);

  const send = () => {
    const text = input.trim();
    if ((!text && !replyTo) || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ 
      type: "send", 
      message: text,
      reply_to_id: replyTo?.id || null,
    }));
    setInput("");
    setReplyTo(null);
  };

  const startRecording = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Permission Required", "Please allow microphone access to record voice notes.");
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setRecording(recording);
      setIsRecording(true);
    } catch (err) {
      console.error("Failed to start recording:", err);
      Alert.alert("Error", "Failed to start recording.");
    }
  };

  const stopRecording = async () => {
    if (!recording) return;
    
    try {
      setIsRecording(false);
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      
      const uri = recording.getURI();
      if (!uri) return;

      const response = await fetch(uri);
      const blob = await response.blob();
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = () => {
        const base64 = reader.result as string;
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: "send",
            message: "",
            audio: base64,
            reply_to_id: replyTo?.id || null,
          }));
        }
      };
      
      setRecording(null);
      setReplyTo(null);
    } catch (err) {
      console.error("Failed to stop recording:", err);
      Alert.alert("Error", "Failed to save recording.");
    }
  };

  const playAudio = async (message: any) => {
    try {
      if (playingId === message.id) {
        if (soundRef.current) {
          await soundRef.current.stopAsync();
          await soundRef.current.unloadAsync();
        }
        setPlayingId(null);
        return;
      }

      if (soundRef.current) {
        await soundRef.current.unloadAsync();
      }

      const { sound } = await Audio.Sound.createAsync(
        { uri: message.audio_data },
        { shouldPlay: true }
      );
      soundRef.current = sound;
      setPlayingId(message.id);

      sound.setOnPlaybackStatusUpdate((status: any) => {
        if (status.isLoaded && status.didJustFinish) {
          setPlayingId(null);
        }
      });
    } catch (err) {
      console.error("Failed to play audio:", err);
      Alert.alert("Error", "Failed to play audio.");
    }
  };

  const renderItem = ({ item }: { item: any }) => {
    const mine = item.sender_id === user?.id;
    const isAudio = !!item.audio_data;
    const key = `${item.id}:${language}`;
    const translated = translations[key];
    const showTranslated = language !== "English" && !mine && translated;

    return (
      <TouchableOpacity 
        style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}
        onLongPress={() => !isAudio && setReplyTo(item)}
        activeOpacity={0.8}
      >
        {item.reply_context && (
          <View style={styles.replyQuote}>
            <Text style={styles.replyQuoteName}>{item.reply_context.sender_name}</Text>
            <Text style={styles.replyQuoteText} numberOfLines={2}>
              {item.reply_context.message}
            </Text>
          </View>
        )}

        {!mine && <Text style={styles.senderName}>{item.sender_name}</Text>}
        
        {isAudio ? (
          <TouchableOpacity style={styles.audioBubble} onPress={() => playAudio(item)}>
            <Ionicons 
              name={playingId === item.id ? "pause" : "play"} 
              size={24} 
              color={mine ? "#fff" : BRANDING.colors.primary} 
            />
            <Text style={[styles.audioText, mine && styles.audioTextMine]}>
              Voice message
            </Text>
          </TouchableOpacity>
        ) : (
          <>
            <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>
              {showTranslated ? translated : item.message}
            </Text>
            {showTranslated && (
              <Text style={[styles.originalText, mine && styles.originalTextMine]} numberOfLines={2}>
                {item.message}
              </Text>
            )}
          </>
        )}
        
        <Text style={[styles.time, mine && styles.timeMine]}>
          {new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Clinical Discussion</Text>
          <Text style={styles.subtitle}>
            {connected ? "Connected" : "Connecting…"} · {online.length} online
          </Text>
        </View>
        <View style={[styles.dot, { backgroundColor: connected ? BRANDING.colors.access : BRANDING.colors.reserve }]} />
      </View>

      {/* Online doctors */}
      <View style={styles.onlineRow}>
        {online.length === 0 ? (
          <Text style={styles.onlineEmpty}>No other doctors online yet</Text>
        ) : (
          online.map((d) => (
            <View key={d.id} style={styles.onlineChip}>
              <View style={styles.onlineDot} />
              <Text style={styles.onlineName} numberOfLines={1}>{d.name}</Text>
            </View>
          ))
        )}
      </View>

      {/* Language selector */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false} 
        style={styles.langRow} 
        contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingVertical: 8 }}
      >
        {LANGUAGES.map((lang) => (
          <TouchableOpacity
            key={lang}
            style={[styles.langChip, language === lang && styles.langChipActive]}
            onPress={() => setLanguage(lang)}
          >
            <Text style={[styles.langChipText, language === lang && styles.langChipTextActive]}>{lang}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => String(m.id)}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 16, paddingBottom: 12 }}
        ListEmptyComponent={<Text style={styles.onlineEmpty}>Start a discussion — ask a clinical question and colleagues will respond.</Text>}
      />

      {replyTo && (
        <View style={styles.replyPreview}>
          <View style={styles.replyPreviewContent}>
            <Text style={styles.replyPreviewName}>Replying to {replyTo.sender_name}</Text>
            <Text style={styles.replyPreviewText} numberOfLines={1}>
              {replyTo.message}
            </Text>
          </View>
          <TouchableOpacity onPress={() => setReplyTo(null)}>
            <Ionicons name="close" size={20} color={BRANDING.colors.subtext} />
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Ask or share a clinical question…"
          placeholderTextColor={BRANDING.colors.subtext}
          multiline
        />
        
        {input.trim() ? (
          <TouchableOpacity style={styles.sendBtn} onPress={send}>
            <Ionicons name="send" size={18} color="#fff" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity 
            style={[styles.sendBtn, isRecording && styles.recordingBtn]} 
            onPress={isRecording ? stopRecording : startRecording}
          >
            <Ionicons 
              name={isRecording ? "stop" : "mic"} 
              size={18} 
              color="#fff" 
            />
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BRANDING.colors.background },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingTop: 60, paddingBottom: 12, backgroundColor: BRANDING.colors.primary, borderBottomLeftRadius: 20, borderBottomRightRadius: 20 },
  title: { color: "#fff", fontSize: 20, fontWeight: "800" },
  subtitle: { color: "rgba(255,255,255,0.8)", fontSize: 12, marginTop: 2 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  onlineRow: { flexDirection: "row", paddingHorizontal: 16, paddingVertical: 10, gap: 8, borderBottomWidth: 1, borderBottomColor: BRANDING.colors.border },
  onlineEmpty: { fontSize: 12, color: BRANDING.colors.subtext, fontStyle: "italic", paddingVertical: 4 },
  onlineChip: { flexDirection: "row", alignItems: "center", backgroundColor: BRANDING.colors.access + "15", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, gap: 6 },
  onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: BRANDING.colors.access },
  onlineName: { fontSize: 12, color: BRANDING.colors.text, maxWidth: 120 },
  langRow: { maxHeight: 44, borderBottomWidth: 1, borderBottomColor: BRANDING.colors.border, flexGrow: 0 },
  langChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: BRANDING.colors.surface, borderWidth: 1, borderColor: BRANDING.colors.border },
  langChipActive: { backgroundColor: BRANDING.colors.primary, borderColor: BRANDING.colors.primary },
  langChipText: { fontSize: 12, color: BRANDING.colors.text },
  langChipTextActive: { color: "#fff", fontWeight: "700" },
  bubble: { maxWidth: "80%", padding: 12, borderRadius: 14, marginBottom: 10 },
  bubbleMine: { alignSelf: "flex-end", backgroundColor: BRANDING.colors.primary },
  bubbleOther: { alignSelf: "flex-start", backgroundColor: BRANDING.colors.surface, borderWidth: 1, borderColor: BRANDING.colors.border },
  senderName: { fontSize: 11, fontWeight: "700", color: BRANDING.colors.primary, marginBottom: 4 },
  bubbleText: { fontSize: 14, color: BRANDING.colors.text, lineHeight: 19 },
  bubbleTextMine: { color: "#fff" },
  originalText: { fontSize: 11, color: BRANDING.colors.subtext, marginTop: 4, fontStyle: "italic" },
  originalTextMine: { color: "rgba(255,255,255,0.7)" },
  time: { fontSize: 10, color: BRANDING.colors.subtext, marginTop: 4, alignSelf: "flex-end" },
  timeMine: { color: "rgba(255,255,255,0.7)" },
  inputRow: { flexDirection: "row", alignItems: "flex-end", gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: BRANDING.colors.border },
  input: { flex: 1, backgroundColor: BRANDING.colors.surface, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: BRANDING.colors.text, borderWidth: 1, borderColor: BRANDING.colors.border, maxHeight: 100 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: BRANDING.colors.primary, justifyContent: "center", alignItems: "center" },
  recordingBtn: { backgroundColor: BRANDING.colors.reserve },
  replyQuote: { backgroundColor: "rgba(0,0,0,0.05)", padding: 8, borderRadius: 8, marginBottom: 8, borderLeftWidth: 3, borderLeftColor: BRANDING.colors.primary },
  replyQuoteName: { fontSize: 10, fontWeight: "700", color: BRANDING.colors.primary, marginBottom: 2 },
  replyQuoteText: { fontSize: 11, color: BRANDING.colors.subtext },
  replyPreview: { flexDirection: "row", alignItems: "center", padding: 12, backgroundColor: BRANDING.colors.surface, borderTopWidth: 1, borderTopColor: BRANDING.colors.border, gap: 12 },
  replyPreviewContent: { flex: 1, borderLeftWidth: 3, borderLeftColor: BRANDING.colors.primary, paddingLeft: 8 },
  replyPreviewName: { fontSize: 11, fontWeight: "700", color: BRANDING.colors.primary, marginBottom: 2 },
  replyPreviewText: { fontSize: 12, color: BRANDING.colors.text },
  audioBubble: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 4 },
  audioText: { fontSize: 13, color: BRANDING.colors.text, fontStyle: "italic" },
  audioTextMine: { color: "#fff" },
});