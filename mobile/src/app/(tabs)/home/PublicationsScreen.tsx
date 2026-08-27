import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet, TextInput, Linking,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../services/api";
import { Palette } from "../../constants/branding";
import { useTheme } from "../../context/ThemeContext";

const CATEGORIES = ["all", "amr", "stewardship", "guidelines", "research", "case_study"];
const CONTENT_TYPES = ["all", "article", "video", "paper", "url", "podcast"];

interface PublicationsScreenProps {
  colors: Palette;
}

export function PublicationsScreen({ colors }: PublicationsScreenProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedType, setSelectedType] = useState("all");

  const { data: publications, isLoading } = useQuery({
    queryKey: ["publications", selectedCategory, selectedType],
    queryFn: () =>
      api.getPublications(
        1,
        50,
        selectedCategory === "all" ? undefined : selectedCategory
      ),
  });

  const filteredPublications = useMemo(() => {
    if (!publications?.publications) return [];
    let filtered = publications.publications;

    if (selectedType !== "all") {
      filtered = filtered.filter((p: any) => p.content_type === selectedType);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p: any) =>
          p.title.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q) ||
          p.tags?.some((t: string) => t.toLowerCase().includes(q))
      );
    }

    return filtered;
  }, [publications, selectedType, searchQuery]);

  const getContentTypeIcon = (type: string) => {
    switch (type) {
      case "video": return "videocam";
      case "paper": return "document-text";
      case "url": return "link";
      case "podcast": return "headset";
      default: return "newspaper";
    }
  };

  const getContentTypeColor = (type: string) => {
    switch (type) {
      case "video": return colors.reserve;
      case "paper": return colors.watch;
      case "url": return colors.access;
      case "podcast": return colors.primary;
      default: return colors.primary;
    }
  };

  const handleOpenPublication = async (pub: any) => {
    if (pub.content_type === "url" && pub.content_url) {
      Linking.openURL(pub.content_url);
    } else if (pub.content_type === "video" && pub.content_url) {
      Linking.openURL(pub.content_url);
    } else {
      router.push(`/publication/${pub.id}`);
    }
  };

  const styles = makeStyles(colors);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 90 }}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.title}>Medical Publications</Text>
        <Text style={styles.subtitle}>Latest research and findings</Text>
      </View>

      <View style={styles.content}>
        {/* Search */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={colors.subtext} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search publications..."
            placeholderTextColor={colors.subtext}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Category Filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[
                styles.filterChip,
                selectedCategory === cat && styles.filterChipActive,
              ]}
              onPress={() => setSelectedCategory(cat)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  selectedCategory === cat && styles.filterChipTextActive,
                ]}
              >
                {cat === "all" ? "All" : cat.replace("_", " ")}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Content Type Filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
          {CONTENT_TYPES.map((type) => (
            <TouchableOpacity
              key={type}
              style={[
                styles.filterChip,
                selectedType === type && styles.filterChipActive,
              ]}
              onPress={() => setSelectedType(type)}
            >
              <Ionicons
                name={getContentTypeIcon(type) as any}
                size={14}
                color={selectedType === type ? colors.onPrimary : colors.subtext}
              />
              <Text
                style={[
                  styles.filterChipText,
                  selectedType === type && styles.filterChipTextActive,
                ]}
              >
                {type === "all" ? "All Types" : type}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Publications List */}
        {isLoading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
        ) : filteredPublications.length > 0 ? (
          filteredPublications.map((pub: any) => (
            <TouchableOpacity
              key={pub.id}
              style={styles.publicationCard}
              onPress={() => handleOpenPublication(pub)}
              activeOpacity={0.7}
            >
              <View style={styles.publicationHeader}>
                <View
                  style={[
                    styles.typeIcon,
                    { backgroundColor: getContentTypeColor(pub.content_type) + "20" },
                  ]}
                >
                  <Ionicons
                    name={getContentTypeIcon(pub.content_type) as any}
                    size={20}
                    color={getContentTypeColor(pub.content_type)}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.publicationTitle} numberOfLines={2}>
                    {pub.title}
                  </Text>
                  <Text style={styles.publicationMeta}>
                    {pub.author_name} · {new Date(pub.created_at).toLocaleDateString()}
                  </Text>
                </View>
              </View>

              {pub.description && (
                <Text style={styles.publicationDescription} numberOfLines={3}>
                  {pub.description}
                </Text>
              )}

              <View style={styles.publicationFooter}>
                <View style={styles.tagsRow}>
                  {pub.tags?.slice(0, 3).map((tag: string, i: number) => (
                    <View key={i} style={styles.tag}>
                      <Text style={styles.tagText}>{tag}</Text>
                    </View>
                  ))}
                </View>
                <View style={styles.statsRow}>
                  <Ionicons name="eye" size={14} color={colors.subtext} />
                  <Text style={styles.statsText}>{pub.view_count || 0}</Text>
                  {pub.has_file && (
                    <>
                      <Ionicons name="attach" size={14} color={colors.subtext} style={{ marginLeft: 12 }} />
                      <Text style={styles.statsText}>{pub.file_name}</Text>
                    </>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="newspaper-outline" size={48} color={colors.subtext} />
            <Text style={styles.emptyText}>No publications found</Text>
            <Text style={styles.emptySubtext}>Try adjusting your search or filters</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    header: {
      backgroundColor: c.primary,
      padding: 20,
      borderBottomLeftRadius: 24,
      borderBottomRightRadius: 24,
    },
    title: { fontSize: 24, fontWeight: "800", color: c.onPrimary },
    subtitle: { fontSize: 13, color: c.onPrimary, opacity: 0.8, marginTop: 4 },
    content: { padding: 16 },
    searchContainer: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: c.surface,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: c.border,
      gap: 8,
    },
    searchInput: { flex: 1, fontSize: 16, color: c.text },
    filterRow: { marginBottom: 12 },
    filterChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      marginRight: 8,
      minHeight: 36,
    },
    filterChipActive: { backgroundColor: c.primary, borderColor: c.primary },
    filterChipText: { fontSize: 12, color: c.subtext, textTransform: "capitalize" },
    filterChipTextActive: { color: c.onPrimary, fontWeight: "600" },
    publicationCard: {
      backgroundColor: c.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: c.border,
    },
    publicationHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
      marginBottom: 12,
    },
    typeIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: "center",
      alignItems: "center",
    },
    publicationTitle: { fontSize: 16, fontWeight: "700", color: c.text, flex: 1 },
    publicationMeta: { fontSize: 12, color: c.subtext, marginTop: 4 },
    publicationDescription: { fontSize: 13, color: c.text, lineHeight: 19, marginBottom: 12 },
    publicationFooter: {
      borderTopWidth: 1,
      borderTopColor: c.border,
      paddingTop: 12,
    },
    tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 },
    tag: {
      backgroundColor: c.primary + "15",
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
    },
    tagText: { fontSize: 10, color: c.primary, fontWeight: "600" },
    statsRow: { flexDirection: "row", alignItems: "center" },
    statsText: { fontSize: 11, color: c.subtext, marginLeft: 4 },
    emptyState: { alignItems: "center", paddingVertical: 60 },
    emptyText: { fontSize: 16, fontWeight: "600", color: c.text, marginTop: 16 },
    emptySubtext: { fontSize: 13, color: c.subtext, marginTop: 4 },
  });
}
