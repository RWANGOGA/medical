import { useEffect, useMemo, useRef, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, Alert, ScrollView, Linking,
  Animated, Modal, Pressable,
} from "react-native";
import {
  useAudioRecorder,
  RecordingPresets,
  setAudioModeAsync,
  requestRecordingPermissionsAsync,
  createAudioPlayer,
} from "expo-audio";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { Paths } from "expo-file-system";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Swipeable } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, getStoredToken } from "../services/api";
import { Palette } from "../constants/branding";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";

const API_BASE = process.env.EXPO_PUBLIC_API_URL || "http://localhost:8002/api/v1";
const WS_BASE = API_BASE.replace("http", "ws") + "/chat/ws";
const LANGUAGES = ["English", "Swahili", "Luganda", "French", "Arabic"];
const QUICK_REACTIONS = ["👍", "✅", "🙏", "❤️", "⚠️", "🔥"];

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

function previewFor(m: any) {
  if (!m) return "";
  if (m.audio_data) return "Voice message";
  if (m.file_data) return m.file_name || "document.pdf";
  return m.message || "";
}

function groupReactions(reactions: any[] | undefined, myId: any) {
  if (!reactions || !reactions.length) return [];
  const map: Record<string, { emoji: string; count: number; mine: boolean; names: string[] }> = {};
  for (const r of reactions) {
    if (!map[r.emoji]) map[r.emoji] = { emoji: r.emoji, count: 0, mine: false, names: [] };
    map[r.emoji].count += 1;
    map[r.emoji].names.push(r.user_name || "");
    if (r.user_id === myId) map[r.emoji].mine = true;
  }
  return Object.values(map);
}

function Avatar({ name, online, mine, size = 36, styles }: { name: string; online?: boolean; mine?: boolean; size?: number; styles: any }) {
  return (
    <View>
      <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }, mine && styles.avatarMine]}>
        <Text style={[styles.avatarText, { fontSize: size * 0.36 }]}>{initials(name)}</Text>
      </View>
      {online && <View style={styles.onlineDot} />}
    </View>
  );
}

export default function ChatScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [messages, setMessages] = useState<any[]>([]);
  const [online, setOnline] = useState<any[]>([]);
  const [systemEvents, setSystemEvents] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [connected, setConnected] = useState(false);
  const [replyTo, setReplyTo] = useState<any>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [playingId, setPlayingId] = useState<number | null>(null);
  const [language, setLanguage] = useState("English");
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [lastIncoming, setLastIncoming] = useState<string | null>(null);

  const [contextMenu, setContextMenu] = useState<{ visible: boolean; message: any | null }>({
    visible: false,
    message: null,
  });

  const [highlightId, setHighlightId] = useState<number | null>(null);
  const highlightTimeout = useRef<any>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const listRef = useRef<FlatList>(null);
  const playerRef = useRef<any>(null);
  const translatingRef = useRef<Set<string>>(new Set());
  const prevOnlineRef = useRef<Record<string, any> | null>(null);
  const joinedOnceRef = useRef(false);
  const swipeRefs = useRef<Record<string, any>>({});

  // Initialize Audio Recorder
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  useEffect(() => {
    (async () => {
      try {
        const hist = await api.getChatMessages();
        setMessages(hist);
      } catch {}
    })();
  }, []);

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
          } else if (data.type === "delete") {
            setMessages((prev) => prev.filter((m) => m.id !== data.id));
          } else if (data.type === "reaction") {
            setMessages((prev) => prev.map((m) => (m.id === data.id ? { ...m, reactions: data.reactions } : m)));
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
    if (items.length && !highlightId) listRef.current?.scrollToEnd({ animated: true });
  }, [items]);

  useEffect(() => {
    return () => {
      if (highlightTimeout.current) clearTimeout(highlightTimeout.current);
      if (playerRef.current) {
        try {
          playerRef.current.remove();
        } catch {}
      }
    };
  }, []);

  const closeSwipeable = (id: number) => {
    swipeRefs.current[id]?.close?.();
  };

  const handleReply = (m: any) => {
    Haptics.selectionAsync().catch(() => {});
    setReplyTo(m);
    setContextMenu({ visible: false, message: null });
    closeSwipeable(m.id);
  };

  const handleCopy = async (m: any) => {
    if (m.message) {
      await Clipboard.setStringAsync(m.message);
    }
    setContextMenu({ visible: false, message: null });
  };

  const handleDelete = (m: any) => {
    setContextMenu({ visible: false, message: null });
    Alert.alert("Delete message", "This will delete the message for everyone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: "delete", id: m.id }));
          }
          setMessages((prev) => prev.filter((x) => x.id !== m.id));
        },
      },
    ]);
  };

  const toggleReaction = (m: any, emoji: string) => {
    Haptics.selectionAsync().catch(() => {});
    const myId = user?.id;
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id !== m.id) return msg;
        const current: any[] = msg.reactions || [];
        const already = current.some((r) => r.user_id === myId && r.emoji === emoji);
        const next = already
          ? current.filter((r) => !(r.user_id === myId && r.emoji === emoji))
          : [...current.filter((r) => r.user_id !== myId), { emoji, user_id: myId, user_name: user?.full_name || "You" }];
        return { ...msg, reactions: next };
      })
    );
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "reaction", id: m.id, emoji }));
    }
    setContextMenu({ visible: false, message: null });
  };

  const openContextMenu = (m: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setContextMenu({ visible: true, message: m });
  };

  const scrollToMessage = (id: number) => {
    const index = items.findIndex((it) => it.kind === "msg" && it.msg.id === id);
    if (index === -1) return;
    try {
      listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.4 });
    } catch {
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
    }
    setHighlightId(id);
    if (highlightTimeout.current) clearTimeout(highlightTimeout.current);
    highlightTimeout.current = setTimeout(() => setHighlightId(null), 1200);
  };

  const send = () => {
    const text = input.trim();
    if ((!text && !replyTo) || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: "send", message: text, reply_to_id: replyTo?.id || null }));
    setInput("");
    setReplyTo(null);
  };

  const startRecording = async () => {
    try {
      const status = await requestRecordingPermissionsAsync();
      if (!status.granted) {
        Alert.alert("Permission Required", "Please allow microphone access to record voice notes.");
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      setIsRecording(true);
    } catch {
      Alert.alert("Error", "Failed to start recording.");
    }
  };

  const stopRecording = async () => {
    try {
      setIsRecording(false);
      await audioRecorder.stop();
      const uri = audioRecorder.uri;
      if (!uri) return;

      await setAudioModeAsync({ allowsRecording: false });

      // More reliable native file reading
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: "send",
          message: "",
          audio: base64,
          reply_to_id: replyTo?.id || null,
        }));
      }
      setReplyTo(null);
    } catch {
      Alert.alert("Error", "Failed to save recording.");
    }
  };

  const playAudio = async (message: any) => {
    try {
      if (playingId === message.id) {
        if (playerRef.current) {
          playerRef.current.pause();
          playerRef.current.remove();
          playerRef.current = null;
        }
        setPlayingId(null);
        return;
      }
      if (playerRef.current) {
        playerRef.current.pause();
        playerRef.current.remove();
        playerRef.current = null;
      }

      const player = createAudioPlayer({ uri: message.audio_data });
      playerRef.current = player;
      setPlayingId(message.id);

      player.addListener('playbackStatusUpdate', (status: any) => {
        if (status.didJustFinish) {
          setPlayingId(null);
          player.remove();
          playerRef.current = null;
        }
      });

      player.play();
    } catch {
      Alert.alert("Error", "Failed to play audio.");
    }
  };

  const pickPdf = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: "application/pdf", copyToCacheDirectory: true });
      if (res.canceled || !res.assets?.length) return;
      const asset = res.assets[0];
      if ((asset.size || 0) > 2 * 1024 * 1024) {
        Alert.alert("File too large", "Please share PDFs under 2 MB.");
        return;
      }

      // Direct base64 string conversion via FileSystem (more stable than FileReader on native)
      const base64 = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: "send",
          message: "",
          file_data: base64,
          file_name: asset.name || "document.pdf",
          reply_to_id: replyTo?.id || null,
        }));
      }
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
        const path = `${Paths.cache.uri}${m.file_name || "document.pdf"}`;
        await FileSystem.writeAsStringAsync(path, m.file_data, { encoding: FileSystem.EncodingType.Base64 });
        await Linking.openURL(path);
      }
    } catch {
      Alert.alert("Error", "Could not open the PDF.");
    }
  };

  const renderLeftActions = (
    _progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>
  ) => {
    const opacity = dragX.interpolate({ inputRange: [0, 40, 80], outputRange: [0, 0.5, 1], extrapolate: "clamp" });
    const scale = dragX.interpolate({ inputRange: [0, 80], outputRange: [0.6, 1], extrapolate: "clamp" });
    return (
      <View style={styles.swipeReplyIcon}>
        <Animated.View style={{ opacity, transform: [{ scale }] }}>
          <Ionicons name="arrow-undo" size={20} color={colors.primary} />
        </Animated.View>
      </View>
    );
  };

  const renderMsg = (m: any) => {
    const mine = m.sender_id === user?.id;
    const isAudio = !!m.audio_data;
    const isFile = !!m.file_data;
    const senderOnline = online.some((o) => o.id === m.sender_id);
    const translated = translations[`${m.id}:${language}`];
    const showTranslated = language !== "English" && !mine && translated;
    const read = mine && lastIncoming && new Date(m.created_at).getTime() <= new Date(lastIncoming).getTime();
    const isHighlighted = highlightId === m.id;
    const reactionPills = groupReactions(m.reactions, user?.id);

    const bubble = (
      <View style={[styles.msgRow, mine && styles.msgRowMine]}>
        {!mine && <Avatar name={m.sender_name} online={senderOnline} styles={styles} />}
        <View style={[styles.bubbleWrap, mine && styles.bubbleWrapMine]}>
          <View style={[styles.nameRow, mine && styles.nameRowMine]}>
            <Text style={styles.senderName}>{mine ? "You" : m.sender_name}</Text>
            <Text style={styles.msgTime}>{fmtTime(m.created_at)}</Text>
          </View>
          <TouchableOpacity
            style={[
              styles.bubble,
              mine ? styles.bubbleMine : styles.bubbleOther,
              isHighlighted && styles.bubbleHighlighted,
            ]}
            onLongPress={() => openContextMenu(m)}
            delayLongPress={220}
            activeOpacity={0.85}
          >
            {m.reply_context && (
              <TouchableOpacity
                style={styles.replyQuote}
                onPress={() => scrollToMessage(m.reply_context.id)}
                activeOpacity={0.7}
              >
                <Text style={styles.replyQuoteName}>{m.reply_context.sender_name}</Text>
                <Text style={styles.replyQuoteText} numberOfLines={2}>
                  {previewFor(m.reply_context)}
                </Text>
              </TouchableOpacity>
            )}

            {isFile ? (
              <TouchableOpacity style={styles.fileBubble} onPress={() => openPdf(m)}>
                <View style={styles.fileIconWrap}>
                  <Ionicons name="document-text" size={22} color={colors.primary} />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.fileName} numberOfLines={1}>{m.file_name || "document.pdf"}</Text>
                  <Text style={styles.fileHint}>PDF document · tap to open</Text>
                </View>
                <Ionicons name="download-outline" size={17} color={colors.subtext} />
              </TouchableOpacity>
            ) : isAudio ? (
              <TouchableOpacity style={styles.audioBubble} onPress={() => playAudio(m)}>
                <View style={styles.audioPlayWrap}>
                  <Ionicons name={playingId === m.id ? "pause" : "play"} size={16} color={colors.onPrimary} />
                </View>
                <View style={styles.audioWave}>
                  {[6, 12, 8, 16, 10, 14, 7].map((h, i) => (
                    <View key={i} style={[styles.audioBar, { height: h }]} />
                  ))}
                </View>
                <Text style={styles.audioLabel}>Voice note</Text>
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
                <Ionicons name={read ? "checkmark-done" : "checkmark"} size={13} color={read ? colors.access : colors.subtext} />
              </View>
            )}
          </TouchableOpacity>

          {reactionPills.length > 0 && (
            <View style={[styles.reactionRow, mine && styles.reactionRowMine]}>
              {reactionPills.map((r) => (
                <TouchableOpacity
                  key={r.emoji}
                  style={[styles.reactionPill, r.mine && styles.reactionPillMine]}
                  onPress={() => toggleReaction(m, r.emoji)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.reactionEmoji}>{r.emoji}</Text>
                  {r.count > 1 && <Text style={[styles.reactionCount, r.mine && styles.reactionCountMine]}>{r.count}</Text>}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
        {mine && <Avatar name={user?.full_name || "You"} online mine styles={styles} />}
      </View>
    );

    return (
      <Swipeable
        ref={(ref) => { swipeRefs.current[m.id] = ref; }}
        renderLeftActions={renderLeftActions}
        leftThreshold={70}
        friction={2}
        onSwipeableWillOpen={() => handleReply(m)}
        overshootLeft={false}
      >
        {bubble}
      </Swipeable>
    );
  };

  const renderItem = ({ item }: { item: any }) => {
    if (item.kind === "divider") {
      return (
        <View style={styles.dividerRow}>
          <View style={styles.dividerPill}>
            <Text style={styles.dividerLabel}>{item.label}</Text>
          </View>
        </View>
      );
    }
    if (item.kind === "system") return <Text style={styles.systemText}>{item.text}</Text>;
    return renderMsg(item.msg);
  };

  const menuMsg = contextMenu.message;
  const menuMine = menuMsg && menuMsg.sender_id === user?.id;

  const onlinePreview = online.slice(0, 3);
  const onlineOverflow = online.length - onlinePreview.length;

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <View style={styles.headerTitleRow}>
            <Ionicons name="medkit" size={15} color={colors.subtext} style={{ marginRight: 6 }} />
            <Text style={styles.title} numberOfLines={1}>Clinical Discussion</Text>
          </View>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: connected ? colors.access : colors.watch }]} />
            <Text style={styles.subtitle}>{connected ? "Connected" : "Connecting…"}</Text>
          </View>
        </View>
        <View style={styles.avatarStack}>
          {onlinePreview.map((o, i) => (
            <View key={o.id} style={[styles.stackAvatar, { marginLeft: i === 0 ? 0 : -10, zIndex: 10 - i }]}>
              <Text style={styles.stackAvatarText}>{initials(o.name)}</Text>
            </View>
          ))}
          {onlineOverflow > 0 && (
            <View style={[styles.stackAvatar, styles.stackAvatarMore, { marginLeft: -10 }]}>
              <Text style={styles.stackAvatarText}>+{onlineOverflow}</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.langBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.langBarContent}
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
      </View>

      <FlatList
        ref={listRef}
        data={items}
        keyExtractor={(i) => String(i.id)}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 16, paddingBottom: 12 }}
        onScrollToIndexFailed={(info) => {
          setTimeout(() => {
            listRef.current?.scrollToIndex({ index: info.index, animated: true });
          }, 100);
        }}
        ListHeaderComponent={
          <View style={styles.intro}>
            <View style={styles.introIcon}>
              <Ionicons name="pulse" size={24} color={colors.primary} />
            </View>
            <Text style={styles.introTitle}>Clinical Discussion</Text>
            <Text style={styles.introDesc}>
              This is the start of the clinical channel. Any team member can join and read this channel.
            </Text>
          </View>
        }
      />

      <Modal visible={contextMenu.visible} transparent animationType="fade" onRequestClose={() => setContextMenu({ visible: false, message: null })}>
        <Pressable style={styles.menuBackdrop} onPress={() => setContextMenu({ visible: false, message: null })}>
          <View style={styles.menuSheet}>
            <View style={styles.menuHandle} />

            <View style={styles.quickReactRow}>
              {QUICK_REACTIONS.map((e) => (
                <TouchableOpacity
                  key={e}
                  style={styles.quickReactBtn}
                  onPress={() => menuMsg && toggleReaction(menuMsg, e)}
                >
                  <Text style={styles.quickReactEmoji}>{e}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.menuItem} onPress={() => menuMsg && handleReply(menuMsg)}>
              <Ionicons name="arrow-undo-outline" size={20} color={colors.text} />
              <Text style={styles.menuItemText}>Reply</Text>
            </TouchableOpacity>
            {menuMsg && menuMsg.message ? (
              <TouchableOpacity style={styles.menuItem} onPress={() => handleCopy(menuMsg)}>
                <Ionicons name="copy-outline" size={20} color={colors.text} />
                <Text style={styles.menuItemText}>Copy</Text>
              </TouchableOpacity>
            ) : null}
            {menuMine ? (
              <TouchableOpacity style={styles.menuItem} onPress={() => menuMsg && handleDelete(menuMsg)}>
                <Ionicons name="trash-outline" size={20} color={colors.reserve} />
                <Text style={[styles.menuItemText, { color: colors.reserve }]}>Delete</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </Pressable>
      </Modal>

      <View style={styles.composer}>
        {replyTo && (
          <View style={styles.replyPreview}>
            <View style={styles.replyPreviewContent}>
              <Text style={styles.replyPreviewName}>Replying to {replyTo.sender_name}</Text>
              <Text style={styles.replyPreviewText} numberOfLines={1}>{previewFor(replyTo)}</Text>
            </View>
            <TouchableOpacity onPress={() => setReplyTo(null)} style={styles.replyCloseBtn}>
              <Ionicons name="close" size={18} color={colors.subtext} />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Write to Clinical Discussion…"
            placeholderTextColor={colors.subtext}
            multiline
          />
        </View>

        <View style={styles.toolbar}>
          <TouchableOpacity style={styles.toolBtn} onPress={pickPdf}>
            <Ionicons name="document-attach-outline" size={18} color={colors.subtext} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.toolBtn, isRecording && styles.toolBtnRec]} onPress={isRecording ? stopRecording : startRecording}>
            <Ionicons name={isRecording ? "stop" : "mic"} size={18} color={isRecording ? colors.onPrimary : colors.subtext} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.sendBtn, !input.trim() && styles.sendBtnDisabled]} onPress={send}>
            <Ionicons name="send" size={16} color={colors.onPrimary} />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },

    // ---- header ----
    header: {
      flexDirection: "row", alignItems: "center", backgroundColor: c.surface,
      paddingHorizontal: 12, paddingBottom: 14,
      borderBottomWidth: 1, borderBottomColor: c.border,
    },
    headerBtn: { padding: 6 },
    headerTitleWrap: { flex: 1, marginLeft: 8 },
    headerTitleRow: { flexDirection: "row", alignItems: "center" },
    title: { color: c.text, fontSize: 16.5, fontWeight: "700", letterSpacing: 0.2 },
    statusRow: { flexDirection: "row", alignItems: "center", marginTop: 3 },
    statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
    subtitle: { color: c.subtext, fontSize: 11.5, fontWeight: "500" },

    avatarStack: { flexDirection: "row", alignItems: "center", paddingRight: 4 },
    stackAvatar: {
      width: 28, height: 28, borderRadius: 14, backgroundColor: c.surfaceAlt,
      justifyContent: "center", alignItems: "center", borderWidth: 1.5, borderColor: c.border,
    },
    stackAvatarMore: { backgroundColor: c.border },
    stackAvatarText: { color: c.text, fontSize: 10, fontWeight: "700" },

    // ---- language bar ----
    langBar: {
      backgroundColor: c.surface,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
      zIndex: 5,
    },
    langBarContent: { paddingHorizontal: 14, paddingVertical: 10, alignItems: "center", gap: 8 },
    langChip: {
      paddingHorizontal: 13, paddingVertical: 7, borderRadius: 18,
      backgroundColor: c.background, borderWidth: 1, borderColor: c.border,
    },
    langChipActive: { backgroundColor: c.primary, borderColor: c.primary },
    langChipText: { fontSize: 12.5, color: c.text, fontWeight: "500" },
    langChipTextActive: { color: c.onPrimary, fontWeight: "700" },

    // ---- empty state ----
    intro: { alignItems: "center", paddingVertical: 22, paddingHorizontal: 20 },
    introIcon: {
      width: 52, height: 52, borderRadius: 26, backgroundColor: c.primarySoft,
      justifyContent: "center", alignItems: "center", marginBottom: 12,
      borderWidth: 1, borderColor: c.primary + "22",
    },
    introTitle: { fontSize: 18, fontWeight: "800", color: c.text },
    introDesc: { fontSize: 12.5, color: c.subtext, textAlign: "center", marginTop: 6, lineHeight: 18, maxWidth: 280 },

    // ---- day dividers ----
    dividerRow: { alignItems: "center", marginVertical: 16 },
    dividerPill: {
      backgroundColor: c.surface, borderWidth: 1, borderColor: c.border,
      paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12,
    },
    dividerLabel: { fontSize: 11.5, fontWeight: "700", color: c.subtext },
    systemText: { textAlign: "center", fontSize: 11.5, color: c.subtext, marginVertical: 8, fontStyle: "italic" },

    // ---- message rows ----
    msgRow: { flexDirection: "row", marginBottom: 16, alignItems: "flex-start" },
    msgRowMine: { justifyContent: "flex-end" },
    avatar: { backgroundColor: c.primary, justifyContent: "center", alignItems: "center" },
    avatarMine: { backgroundColor: c.access },
    avatarText: { color: c.onPrimary, fontWeight: "800" },
    onlineDot: { position: "absolute", right: -1, bottom: -1, width: 10, height: 10, borderRadius: 5, backgroundColor: c.access, borderWidth: 2, borderColor: c.background },

    bubbleWrap: { flex: 1, marginLeft: 10, maxWidth: "82%" },
    bubbleWrapMine: { marginLeft: 0, marginRight: 10, alignItems: "flex-end" },
    nameRow: { flexDirection: "row", alignItems: "baseline", marginBottom: 4 },
    nameRowMine: { justifyContent: "flex-end" },
    senderName: { fontSize: 12.5, fontWeight: "700", color: c.text },
    msgTime: { fontSize: 10, color: c.subtext, marginLeft: 8 },

    bubble: {
      padding: 12, borderRadius: 14,
    },
    bubbleMine: { backgroundColor: c.access + "17", borderWidth: 1, borderColor: c.access + "35" },
    bubbleOther: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },
    bubbleHighlighted: { backgroundColor: c.watch + "2E", borderColor: c.watch },
    bubbleText: { fontSize: 14, color: c.text, lineHeight: 20 },
    bubbleTextMine: { color: c.text },
    originalText: { fontSize: 11, color: c.subtext, marginTop: 4, fontStyle: "italic" },
    tickRow: { flexDirection: "row", justifyContent: "flex-end", marginTop: 4 },

    replyQuote: {
      backgroundColor: c.primary + "0F", padding: 8, borderRadius: 8, marginBottom: 8,
      borderLeftWidth: 3, borderLeftColor: c.primary,
    },
    replyQuoteName: { fontSize: 10, fontWeight: "700", color: c.primary, marginBottom: 2 },
    replyQuoteText: { fontSize: 11, color: c.subtext },

    audioBubble: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 2 },
    audioPlayWrap: { width: 30, height: 30, borderRadius: 15, backgroundColor: c.primary, justifyContent: "center", alignItems: "center" },
    audioWave: { flexDirection: "row", alignItems: "center", gap: 3, flex: 1 },
    audioBar: { width: 3, borderRadius: 2, backgroundColor: c.primary + "55" },
    audioLabel: { fontSize: 11.5, color: c.subtext, fontWeight: "500" },

    fileBubble: { flexDirection: "row", alignItems: "center" },
    fileIconWrap: { width: 38, height: 38, borderRadius: 10, backgroundColor: c.primarySoft, justifyContent: "center", alignItems: "center" },
    fileName: { fontSize: 13, fontWeight: "700", color: c.text },
    fileHint: { fontSize: 11, color: c.subtext, marginTop: 2 },

    // ---- reaction pills ----
    reactionRow: { flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 5 },
    reactionRowMine: { justifyContent: "flex-end" },
    reactionPill: {
      flexDirection: "row", alignItems: "center", gap: 3,
      backgroundColor: c.surface, borderWidth: 1, borderColor: c.border,
      borderRadius: 12, paddingHorizontal: 7, paddingVertical: 3,
    },
    reactionPillMine: { backgroundColor: c.primary + "14", borderColor: c.primary + "45" },
    reactionEmoji: { fontSize: 12.5 },
    reactionCount: { fontSize: 11, fontWeight: "700", color: c.subtext },
    reactionCountMine: { color: c.primary },

    swipeReplyIcon: { width: 56, justifyContent: "center", alignItems: "center" },

    // ---- context menu ----
    menuBackdrop: { flex: 1, backgroundColor: "rgba(2, 6, 23, 0.5)", justifyContent: "flex-end" },
    menuSheet: { backgroundColor: c.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingVertical: 10, paddingBottom: 26, alignItems: "stretch" },
    menuHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: c.border, alignSelf: "center", marginBottom: 10 },
    quickReactRow: {
      flexDirection: "row", justifyContent: "space-around", alignItems: "center",
      paddingHorizontal: 16, paddingVertical: 10, marginHorizontal: 16, marginBottom: 6,
      backgroundColor: c.background, borderRadius: 24, borderWidth: 1, borderColor: c.border,
    },
    quickReactBtn: { padding: 4 },
    quickReactEmoji: { fontSize: 24 },
    menuItem: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 22, paddingVertical: 14 },
    menuItemText: { fontSize: 15, color: c.text, fontWeight: "600" },

    // ---- composer ----
    replyPreview: {
      flexDirection: "row", alignItems: "center", marginBottom: 8, gap: 10,
      backgroundColor: c.primary + "0A", borderRadius: 10, padding: 8,
    },
    replyPreviewContent: { flex: 1, borderLeftWidth: 3, borderLeftColor: c.primary, paddingLeft: 8 },
    replyPreviewName: { fontSize: 11.5, fontWeight: "700", color: c.primary, marginBottom: 2 },
    replyPreviewText: { fontSize: 12.5, color: c.text },
    replyCloseBtn: { padding: 4 },

    composer: {
      borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.surface,
      padding: 10, paddingBottom: Platform.OS === "ios" ? 10 : 12,
    },
    inputRow: { flexDirection: "row", alignItems: "flex-end" },
    input: {
      flex: 1, backgroundColor: c.background, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10,
      fontSize: 14, color: c.text, borderWidth: 1, borderColor: c.border, maxHeight: 110,
    },
    toolbar: { flexDirection: "row", alignItems: "center", marginTop: 8, gap: 8 },
    toolBtn: { width: 38, height: 38, borderRadius: 10, justifyContent: "center", alignItems: "center", backgroundColor: c.background, borderWidth: 1, borderColor: c.border },
    toolBtnRec: { backgroundColor: c.reserve, borderColor: c.reserve },
    sendBtn: {
      flex: 1, height: 38, borderRadius: 10, backgroundColor: c.primary,
      flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6,
    },
    sendBtnDisabled: { opacity: 0.45 },
  });
}
