import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Modal, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Palette } from "../../../constants/branding";
import { useResponsive } from "../../../utils/responsive";
import { useState } from "react";

const CATEGORIES = [
  { id: "all", label: "All Publications", icon: "newspaper" },
  { id: "amr", label: "AMR Research", icon: "bug" },
  { id: "stewardship", label: "Stewardship", icon: "shield-checkmark" },
  { id: "guidelines", label: "Guidelines", icon: "document-text" },
  { id: "research", label: "Research", icon: "flask" },
  { id: "case_study", label: "Case Studies", icon: "folder-open" },
];

const CONTENT_TYPES = [
  { id: "all", label: "All Types", icon: "apps" },
  { id: "article", label: "Articles", icon: "document-text" },
  { id: "video", label: "Videos", icon: "videocam" },
  { id: "paper", label: "Papers", icon: "newspaper" },
  { id: "url", label: "Links", icon: "link" },
  { id: "podcast", label: "Podcasts", icon: "headset" },
];

interface PublicationsSidebarProps {
  colors: Palette;
  selectedCategory: string;
  selectedType: string;
  onCategoryChange: (category: string) => void;
  onTypeChange: (type: string) => void;
}

export function PublicationsSidebar({
  colors,
  selectedCategory,
  selectedType,
  onCategoryChange,
  onTypeChange,
}: PublicationsSidebarProps) {
  const { isTabletOrLarger } = useResponsive();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const styles = makeStyles(colors);

  const sidebarContent = (
    <View style={styles.sidebarContent}>
      <View style={styles.sidebarSection}>
        <Text style={styles.sidebarSectionTitle}>Categories</Text>
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat.id}
            style={[styles.sidebarItem, selectedCategory === cat.id && styles.sidebarItemActive]}
            onPress={() => {
              onCategoryChange(cat.id);
              if (!isTabletOrLarger) setDrawerOpen(false);
            }}
          >
            <Ionicons
              name={cat.icon as any}
              size={18}
              color={selectedCategory === cat.id ? colors.onPrimary : colors.subtext}
            />
            <Text
              style={[
                styles.sidebarItemText,
                selectedCategory === cat.id && styles.sidebarItemTextActive,
              ]}
            >
              {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.sidebarDivider} />

      <View style={styles.sidebarSection}>
        <Text style={styles.sidebarSectionTitle}>Content Type</Text>
        {CONTENT_TYPES.map((type) => (
          <TouchableOpacity
            key={type.id}
            style={[styles.sidebarItem, selectedType === type.id && styles.sidebarItemActive]}
            onPress={() => {
              onTypeChange(type.id);
              if (!isTabletOrLarger) setDrawerOpen(false);
            }}
          >
            <Ionicons
              name={type.icon as any}
              size={18}
              color={selectedType === type.id ? colors.onPrimary : colors.subtext}
            />
            <Text
              style={[
                styles.sidebarItemText,
                selectedType === type.id && styles.sidebarItemTextActive,
              ]}
            >
              {type.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.sidebarDivider} />

      <View style={styles.sidebarSection}>
        <Text style={styles.sidebarSectionTitle}>Quick Links</Text>
        <TouchableOpacity style={styles.sidebarItem}>
          <Ionicons name="trending-up" size={18} color={colors.subtext} />
          <Text style={styles.sidebarItemText}>Most Viewed</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.sidebarItem}>
          <Ionicons name="time" size={18} color={colors.subtext} />
          <Text style={styles.sidebarItemText}>Recently Added</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.sidebarItem}>
          <Ionicons name="bookmark" size={18} color={colors.subtext} />
          <Text style={styles.sidebarItemText}>Bookmarked</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (isTabletOrLarger) {
    return <View style={styles.sidebar}>{sidebarContent}</View>;
  }

  return (
    <>
      <TouchableOpacity style={styles.menuButton} onPress={() => setDrawerOpen(true)}>
        <Ionicons name="menu" size={24} color={colors.text} />
      </TouchableOpacity>
      <Modal
        visible={drawerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setDrawerOpen(false)}
      >
        <Pressable style={styles.drawerBackdrop} onPress={() => setDrawerOpen(false)}>
          <View style={styles.drawer}>
            <View style={styles.drawerHeader}>
              <Text style={styles.drawerTitle}>Browse Publications</Text>
              <TouchableOpacity onPress={() => setDrawerOpen(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView>{sidebarContent}</ScrollView>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    sidebar: {
      width: 240,
      backgroundColor: c.surface,
      borderRightWidth: 1,
      borderRightColor: c.border,
      paddingTop: 20,
    },
    sidebarContent: { paddingHorizontal: 12 },
    sidebarSection: { marginBottom: 20 },
    sidebarSectionTitle: {
      fontSize: 11,
      fontWeight: "700",
      color: c.subtext,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: 8,
      paddingHorizontal: 8,
    },
    sidebarItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 10,
      paddingHorizontal: 8,
      borderRadius: 8,
      minHeight: 44,
    },
    sidebarItemActive: { backgroundColor: c.primary },
    sidebarItemText: { fontSize: 14, color: c.text, fontWeight: "500" },
    sidebarItemTextActive: { color: c.onPrimary, fontWeight: "600" },
    sidebarDivider: { height: 1, backgroundColor: c.border, marginVertical: 8 },

    menuButton: {
      position: "absolute",
      top: 50,
      left: 16,
      zIndex: 10,
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: c.surface,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1,
      borderColor: c.border,
    },
    drawerBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "flex-start",
    },
    drawer: {
      width: 280,
      height: "100%",
      backgroundColor: c.surface,
      paddingTop: 20,
    },
    drawerHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    drawerTitle: { fontSize: 18, fontWeight: "700", color: c.text },
  });
}
