import { useEffect, useMemo, useRef, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, Alert, ScrollView, Linking,
} from "react-native";
import { Audio } from "expo-av";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api, getStoredToken } from "../services/api";
import { BRANDING } from "../constants/branding";
import { useAuth } from "../context/AuthContext";

const API_BASE = process.env.EXPO_PUBLIC_API_URL || "http://localhost:8002/api/v1";
const WS_BASE = API_BASE.replace("http", "ws") + "/chat/ws";
const LANGUAGES = ["English", "Swahili", "Luganda", "French", "Arabic"];
const EMOJIS = ["😀", "😂", "🙏", "", "❤️", "🎉", "", "😢", "", "", "🩺", "💊", "🧪", "✅", "⚠️", "🔥"];

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date();
  yest.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yest.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}

const initials = (name: string) =>
  (name || "?").split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();

function Avatar({ name, online, mine }: { name: string; online?: boolean; mine?: boolean }) {
  return (
    <View>
      <View style={[styles.avatar, mine && styles.avatarMine]}>
        <Text style={styles.avatarText}>{initials(name)}</Text>
      </View>
      {online && <View style={styles.onlineDot} />}
    </View>
  );
}

export default function ChatScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [messages, setMessages] = useState<any[]>([]);
  const [online, setOnline] = useState<any[]>([]);
  const [systemEvents, setSystemEvents] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [connected, setConnected] = useState(false);
  const [replyTo, setReplyTo] = useState<any>(null);
  const [recording, setRecording] = useState<any>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [playingId, setPlayingId] = useState<number | null>(null);
  const [language, setLanguage] = useState("English");
  const [showLangs, setShowLangs] = useState(true);
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [showEmoji, setShowEmoji] = useState(false);
  const [lastIncoming, setLastIncoming] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const listRef = useRef<FlatList>(null);
  const soundRef = useRef<any>(null);
  const translatingRef = useRef<Set<string>>(new Set());
  const prevOnlineRef = useRef<Record<string, any> | null>(null);
  const joinedOnceRef = useRef(false);

  // ---------- load history ----------
  useEffect(() => {
    (async () => {
      try {
        const hist = await api.getChatMessages();
        setMessages(hist);
      } catch {}
    })();
  }, []);

  // ---------- websocket ----------
  useEffect(() => {
    let socket: WebSocket | null = null;
    let cancelled = false;

    const connect = async () => {
      const token = await getStoredToken();
      if (cancelled || !token) return;
      socket = new WebSocket(`${WS_BASE}?token=${token}`);
      wsRef.current = socket;

      socket.onopen = () => {
        setConnected(true);
        if (!joinedOnceRef.current) {
          joinedOnceRef.current = true;
          setSystemEvents((ev) => [
            ...ev,
            { id: `sys-you-${Date.now()}`, text: "You joined the channel", time: new Date().toISOString() },
          ]);
        }
      };
      socket.onclose = () => setConnected(false);

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "presence") {
            const list = data.online || [];
            const prev = prevOnlineRef.current;
            if (prev) {
              const now = new Date().toISOString();
              const joined = list.filter((d: any) => !prev[d.id] && d.id !== user?.id);
              const leftIds = Object.keys(prev).filter(
                (id) => !list.some((x: any) => x.id === id) && id !== String(user?.id)
              );
              setSystemEvents((ev) => [
                ...ev,
                ...joined.map((d: any) => ({ id: `sys-j${Date.now()}-${d.id}`, text: `${d.name} joined the channel`, time: now })),
                ...leftIds.map((id) => ({ id: `sys-l${Date.now()}-${id}`, text: `${prev[id].name} left the channel`, time: now })),
              ]);
            }
            const map: Record<string, any> = {};
            list.forEach((d: any) => (map[d.id] = d));
            prevOnlineRef.current = map;
            setOnline(list);
          } else if (data.type === "message") {
            setMessages((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev, data]));
            if (data.sender_id !== user?.id) setLastIncoming(data.created_at);
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

  // ---------- translation ----------
  useEffect(() => {
    if (language === "English") return;
    const missing = messages.filter(
      (m) =>
        m.sender_id !== user?.id && !m.audio_data && !m.file_data && m.message &&
        !translations[`${m.id}:${language}`] && !translatingRef.current.has(`${m.id}:${language}`)
    );
    missing.forEach(async (m) => {
      const key = `${m.id}:${language}`;
      translatingRef.current.add(key);
      try {
        const res = await api.translate({ text: m.message, target_language: language });
        setTranslations((prev) => ({ ...prev, [key]: res.translated }));
      } catch {}
      translatingRef.current.delete(key);
    });
  }, [messages, language]);

  // ---------- build list with day dividers + system events ----------
  const items = useMemo(() => {
    const all: any[] = [
      ...systemEvents.map((e) => ({ kind: "system", id: e.id, text: e.text, time: e.time })),
      ...messages.map((m) => ({ kind: "msg", id: `m${m.id}`, msg: m, time: m.created_at })),
    ].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

    const out: any[] = [];
    let lastDay = "";
    for (const it of all) {
      const label = dayLabel(it.time);
      if (label !== lastDay) {
        out.push({ kind: "divider", id: `div-${label}-${out.length}`, label });
        lastDay = label;
      }
      out.push(it);
    }
    return out;
  }, [messages, systemEvents]);

  useEffect(() => {
    if (items.length) listRef.current?.scrollToEnd({ animated: true });
  }, [items]);

  // ---------- actions ----------
  const send = () => {
    const text = input.trim();
    if ((!text && !replyTo) || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: "send", message: text, reply_to_id: replyTo?.id || null }));
    setInput("");
    setReplyTo(null);
    setShowEmoji(false);
  };

  const startRecording = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Permission Required", "Please allow microphone access to record voice notes.");
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setRecording(recording);
      setIsRecording(true);
    } catch {
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
          wsRef.current.send(JSON.stringify({ type: "send", message: "", audio: base64, reply_to_id: replyTo?.id || null }));
        }
      };
      setRecording(null);
      setReplyTo(null);
    } catch {
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
      if (soundRef.current) await soundRef.current.unloadAsync();
      const { sound } = await Audio.Sound.createAsync({ uri: message.audio_data }, { shouldPlay: true });
      soundRef.current = sound;
      setPlayingId(message.id);
      sound.setOnPlaybackStatusUpdate((status: any) => {
        if (status.isLoaded && status.didJustFinish) setPlayingId(null);
      });
    } catch {
      Alert.alert("Error", "Failed to play audio.");
    }
  };

  // ---------- PDF sharing ----------
  const pickPdf = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: "application/pdf", copyToCacheDirectory: true });
      if (res.canceled || !res.assets?.length) return;
      const asset = res.assets[0];
      if ((asset.size || 0) > 2 * 1024 * 1024) {
        Alert.alert("File too large", "Please share PDFs under 2 MB.");
        return;
      }
      const resp = await fetch(asset.uri);
      const blob = await resp.blob();
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(",")[1];
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: "send",
            message: "",
            file_data: base64,
            file_name: asset.name || "document.pdf",
            reply_to_id: replyTo?.id || null,
          }));
        }
      };
      setReplyTo(null);
    } catch {
      Alert.alert("Error", "Could not attach the PDF.");
    }
  };

  const openPdf = async (m: any) => {
    try {
      if (Platform.OS === "web") {
        const byteChars = atob(m.file_data);
        const byteNumbers = new Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
        const blob = new Blob([new Uint8Array(byteNumbers)], { type: "application/pdf" });
        window.open(URL.createObjectURL(blob), "_blank");
      } else {
        const path = `${FileSystem.cacheDirectory}${m.file_name || "document.pdf"}`;
        await FileSystem.writeAsStringAsync(path, m.file_data, { encoding: FileSystem.EncodingType.Base64 });
        await Linking.openURL(path);
      }
    } catch {
      Alert.alert("Error", "Could not open the PDF.");
    }
  };

  // ---------- message bubble ----------
  const renderMsg = (m: any) => {
    const mine = m.sender_id === user?.id;
    const isAudio = !!m.audio_data;
    const isFile = !!m.file_data;
    const senderOnline = online.some((o) => o.id === m.sender_id);
    const translated = translations[`${m.id}:${language}`];
    const showTranslated = language !== "English" && !mine && translated;
    const read = mine && lastIncoming && new Date(m.created_at).getTime() <= new Date(lastIncoming).getTime();

    return (
      <View style={[styles.msgRow, mine && styles.msgRowMine]}>
        {!mine && <Avatar name={m.sender_name} online={senderOnline} />}
        <View style={[styles.bubbleWrap, mine && styles.bubbleWrapMine]}>
          <View style={[styles.nameRow, mine && styles.nameRowMine]}>
            <Text style={styles.senderName}>{mine ? "You" : m.sender_name}</Text>
            <Text style={styles.msgTime}>{fmtTime(m.created_at)}</Text>
          </View>
          <TouchableOpacity
            style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}
            onLongPress={() => !isAudio && !isFile && setReplyTo(m)}
            activeOpacity={0.85}
          >
            {m.reply_context && (
              <View style={styles.replyQuote}>
                <Text style={styles.replyQuoteName}>{m.reply_context.sender_name}</Text>
                <Text style={styles.replyQuoteText} numberOfLines={2}>{m.reply_context.message}</Text>
              </View>
            )}

            {isFile ? (
              <TouchableOpacity style={styles.fileBubble} onPress={() => openPdf(m)}>
                <Ionicons name="document-text" size={26} color={mine ? BRANDING.colors.access : BRANDING.colors.primary} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.fileName} numberOfLines={1}>{m.file_name || "document.pdf"}</Text>
                  <Text style={styles.fileHint}>PDF · tap to open</Text>
                </View>
                <Ionicons name="download-outline" size={18} color={BRANDING.colors.subtext} />
              </TouchableOpacity>
            ) : isAudio ? (
              <TouchableOpacity style={styles.audioBubble} onPress={() => playAudio(m)}>
                <Ionicons name={playingId === m.id ? "pause" : "play"} size={22} color={mine ? BRANDING.colors.access : BRANDING.colors.primary} />
                <Text style={styles.audioText}>Voice message</Text>
                <Ionicons name="volume-high-outline" size={16} color={BRANDING.colors.subtext} />
              </TouchableOpacity>
            ) : (
              <>
                <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>
                  {showTranslated ? translated : m.message}
                </Text>
                {showTranslated && <Text style={styles.originalText} numberOfLines={2}>{m.message}</Text>}
              </>
            )}

            {mine && (
              <View style={styles.tickRow}>
                <Ionicons name={read ? "checkmark-done" : "checkmark"} size={13} color={read ? BRANDING.colors.access : BRANDING.colors.subtext} />
              </View>
            )}
          </TouchableOpacity>
        </View>
        {mine && <Avatar name={user?.full_name || "You"} online mine />}
      </View>
    );
  };

  const renderItem = ({ item }: { item: any }) => {
    if (item.kind === "divider") {
      return (
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerLabel}>{item.label}</Text>
          <View style={styles.dividerLine} />
        </View>
      );
    }
    if (item.kind === "system") return <Text style={styles.systemText}>{item.text}</Text>;
    return renderMsg(item.msg);
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      {/* header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={20} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.title} numberOfLines={1}>Clinical Discussion</Text>
          <Text style={styles.subtitle}>{connected ? `Connected · ${online.length + 1} online` : "Connecting…"}</Text>
        </View>
        <TouchableOpacity onPress={() => setShowLangs((v) => !v)} style={styles.headerBtn}>
          <Ionicons name="language" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* language translator */}
      {showLangs && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.langRow} contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingVertical: 10 }}>
          {LANGUAGES.map((lang) => (
            <TouchableOpacity key={lang} style={[styles.langChip, language === lang && styles.langChipActive]} onPress={() => setLanguage(lang)}>
              <Text style={[styles.langChipText, language === lang && styles.langChipTextActive]}>{lang}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <FlatList
        ref={listRef}
        data={items}
        keyExtractor={(i) => String(i.id)}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 16, paddingBottom: 12 }}
        ListHeaderComponent={
          <View style={styles.intro}>
            <View style={styles.introIcon}>
              <Ionicons name="chatbubbles" size={26} color={BRANDING.colors.primary} />
            </View>
            <Text style={styles.introTitle}>Clinical Discussion</Text>
            <Text style={styles.introDesc}>
              This is the start of the clinical channel. Any team member can join and read this channel.
            </Text>
          </View>
        }
      />

      <View style={styles.composer}>
        {replyTo && (
          <View style={styles.replyPreview}>
            <View style={styles.replyPreviewContent}>
              <Text style={styles.replyPreviewName}>Replying to {replyTo.sender_name}</Text>
              <Text style={styles.replyPreviewText} numberOfLines={1}>{replyTo.message}</Text>
            </View>
            <TouchableOpacity onPress={() => setReplyTo(null)}>
              <Ionicons name="close" size={20} color={BRANDING.colors.subtext} />
            </TouchableOpacity>
          </View>
        )}

        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Write to Clinical Discussion…"
          placeholderTextColor={BRANDING.colors.subtext}
          multiline
        />

        {showEmoji && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.emojiRow}>
            {EMOJIS.map((e, i) => (
              <TouchableOpacity key={`emoji-${i}`} onPress={() => setInput((t) => t + e)}>
                <Text style={styles.emoji}>{e}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        <View style={styles.toolbar}>
          <TouchableOpacity style={styles.toolBtn} onPress={() => setShowEmoji((v) => !v)}>
            <Ionicons name="happy-outline" size={18} color={BRANDING.colors.subtext} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolBtn} onPress={pickPdf}>
            <Ionicons name="document-attach-outline" size={18} color={BRANDING.colors.subtext} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.toolBtn, isRecording && styles.toolBtnRec]} onPress={isRecording ? stopRecording : startRecording}>
            <Ionicons name={isRecording ? "stop" : "mic"} size={18} color={isRecording ? "#fff" : BRANDING.colors.subtext} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.sendBtn, !input.trim() && styles.sendBtnDisabled]} onPress={send}>
            <Ionicons name="send" size={17} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BRANDING.colors.background },

  header: { flexDirection: "row", alignItems: "center", backgroundColor: BRANDING.colors.primary, paddingHorizontal: 12, paddingTop: 56, paddingBottom: 12, borderBottomLeftRadius: 16, borderBottomRightRadius: 16 },
  headerBtn: { padding: 6 },
  title: { color: "#fff", fontSize: 17, fontWeight: "800" },
  subtitle: { color: "rgba(255,255,255,0.8)", fontSize: 11, marginTop: 2 },

  langRow: { maxHeight: 46, borderBottomWidth: 1, borderBottomColor: BRANDING.colors.border, flexGrow: 0 },
  langChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: BRANDING.colors.surface, borderWidth: 1, borderColor: BRANDING.colors.border },
  langChipActive: { backgroundColor: BRANDING.colors.primary, borderColor: BRANDING.colors.primary },
  langChipText: { fontSize: 12, color: BRANDING.colors.text },
  langChipTextActive: { color: "#fff", fontWeight: "700" },

  intro: { alignItems: "center", paddingVertical: 20, paddingHorizontal: 20 },
  introIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: BRANDING.colors.primary + "15", justifyContent: "center", alignItems: "center", marginBottom: 12 },
  introTitle: { fontSize: 20, fontWeight: "800", color: BRANDING.colors.text },
  introDesc: { fontSize: 13, color: BRANDING.colors.subtext, textAlign: "center", marginTop: 8, lineHeight: 19 },

  dividerRow: { flexDirection: "row", alignItems: "center", marginVertical: 14 },
  dividerLine: { flex: 1, height: 1, backgroundColor: BRANDING.colors.border },
  dividerLabel: { fontSize: 12, fontWeight: "700", color: BRANDING.colors.text, marginHorizontal: 10 },
  systemText: { textAlign: "center", fontSize: 12, color: BRANDING.colors.subtext, marginVertical: 6 },

  msgRow: { flexDirection: "row", marginBottom: 14, alignItems: "flex-start" },
  msgRowMine: { justifyContent: "flex-end" },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: BRANDING.colors.primary, justifyContent: "center", alignItems: "center" },
  avatarMine: { backgroundColor: BRANDING.colors.access },
  avatarText: { color: "#fff", fontWeight: "800", fontSize: 13 },
  onlineDot: { position: "absolute", right: -1, bottom: -1, width: 10, height: 10, borderRadius: 5, backgroundColor: BRANDING.colors.access, borderWidth: 2, borderColor: BRANDING.colors.background },

  bubbleWrap: { flex: 1, marginLeft: 10, maxWidth: "80%" },
  bubbleWrapMine: { marginLeft: 0, marginRight: 10, alignItems: "flex-end" },
  nameRow: { flexDirection: "row", alignItems: "baseline", marginBottom: 4 },
  nameRowMine: { justifyContent: "flex-end" },
  senderName: { fontSize: 13, fontWeight: "800", color: BRANDING.colors.text },
  msgTime: { fontSize: 10, color: BRANDING.colors.subtext, marginLeft: 8 },

  bubble: { padding: 12, borderRadius: 12 },
  bubbleMine: { backgroundColor: "#DCF3DC", borderWidth: 1, borderColor: "#BFE6BF" },
  bubbleOther: { backgroundColor: BRANDING.colors.surface, borderWidth: 1, borderColor: BRANDING.colors.border },
  bubbleText: { fontSize: 14, color: BRANDING.colors.text, lineHeight: 20 },
  bubbleTextMine: { color: BRANDING.colors.text },
  originalText: { fontSize: 11, color: BRANDING.colors.subtext, marginTop: 4, fontStyle: "italic" },
  tickRow: { flexDirection: "row", justifyContent: "flex-end", marginTop: 4 },

  replyQuote: { backgroundColor: "rgba(0,0,0,0.05)", padding: 8, borderRadius: 8, marginBottom: 8, borderLeftWidth: 3, borderLeftColor: BRANDING.colors.primary },
  replyQuoteName: { fontSize: 10, fontWeight: "700", color: BRANDING.colors.primary, marginBottom: 2 },
  replyQuoteText: { fontSize: 11, color: BRANDING.colors.subtext },

  audioBubble: { flexDirection: "row", alignItems: "center", gap: 10 },
  audioText: { fontSize: 13, color: BRANDING.colors.text, fontStyle: "italic" },

  fileBubble: { flexDirection: "row", alignItems: "center" },
  fileName: { fontSize: 13, fontWeight: "700", color: BRANDING.colors.text },
  fileHint: { fontSize: 11, color: BRANDING.colors.subtext, marginTop: 2 },

  replyPreview: { flexDirection: "row", alignItems: "center", marginBottom: 8, gap: 12 },
  replyPreviewContent: { flex: 1, borderLeftWidth: 3, borderLeftColor: BRANDING.colors.primary, paddingLeft: 8 },
  replyPreviewName: { fontSize: 11, fontWeight: "700", color: BRANDING.colors.primary, marginBottom: 2 },
  replyPreviewText: { fontSize: 12, color: BRANDING.colors.text },

  composer: { borderTopWidth: 1, borderTopColor: BRANDING.colors.border, backgroundColor: BRANDING.colors.surface, padding: 10 },
  input: { backgroundColor: BRANDING.colors.background, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: BRANDING.colors.text, borderWidth: 1, borderColor: BRANDING.colors.border, maxHeight: 100 },
  emojiRow: { maxHeight: 44, marginTop: 8 },
  emoji: { fontSize: 22, marginHorizontal: 6 },
  toolbar: { flexDirection: "row", alignItems: "center", marginTop: 8, gap: 6 },
  toolBtn: { width: 36, height: 36, borderRadius: 8, justifyContent: "center", alignItems: "center", backgroundColor: BRANDING.colors.background, borderWidth: 1, borderColor: BRANDING.colors.border },
  toolBtnRec: { backgroundColor: BRANDING.colors.reserve, borderColor: BRANDING.colors.reserve },
  sendBtn: { flex: 1, height: 36, borderRadius: 8, backgroundColor: BRANDING.colors.primary, justifyContent: "center", alignItems: "center" },
  sendBtnDisabled: { opacity: 0.5 },
});