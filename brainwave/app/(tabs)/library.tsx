import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  RefreshControl
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../contexts/ThemeContext";
import { Theme } from "../types";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "../contexts/AuthContext";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { SearchIcon, CloseIcon } from "@/components/Icons"
import { useContent } from "../hooks/useContent";

// Types for Library items matching your Firestore structure
interface Material {
  id: string;
  title: string;
  createdAt: any;
  aiPlan: string;
}

const MaterialSkeleton = ({ theme }: { theme: Theme }) => (
  <View
    style={[
      styles.skeletonCard,
      {
        backgroundColor: theme.colors.surface,
        borderColor: theme.colors.border,
      },
    ]}
  >
    <View
      style={[
        styles.skeletonIcon,
        { backgroundColor: theme.colors.border + "40" },
      ]}
    />
    <View style={{ flex: 1, gap: 8 }}>
      <View
        style={[
          styles.skeletonLine,
          { width: "60%", backgroundColor: theme.colors.border + "40" },
        ]}
      />
      <View
        style={[
          styles.skeletonLine,
          {
            width: "30%",
            height: 10,
            backgroundColor: theme.colors.border + "20",
          },
        ]}
      />
    </View>
  </View>
);

export default function Library() {
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const { refresh } = useContent(); 

  const [activeTab, setActiveTab] = useState<"library" | "insights">("library");
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing ] = useState(false);

  const styles = createStyles(theme, isDark);

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh(true);
    setRefreshing(false);
  }

  useEffect(() => {
    if (!user?.id) return;

    const docRef = doc(db, "users", user.id, "data", "materials")

    const unsubscribe = onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          const list = data.syllabus_list || [];

          const formattedMaterials = list.map((item: any, index: number) => ({
            id: item.id || index.toString(),
            title: item.title || "Untitled Syllabus",
            createdAt: item.createdAt || item.timestamp,
            aiPlan: item.aiPlan,
          }));

          setMaterials(formattedMaterials);
        } else {
          setMaterials([]);
        }
        setLoading(false);
      },
      (error) => {
        console.error("Firestore Library Error:", error);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [user]);

  const filteredMaterials = useMemo(() => {
    return materials.filter((item) =>
      item.title.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [searchQuery, materials]);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header & Switcher */}
      <View style={styles.stickyHeader}>
        <Text style={styles.headerTitle}>
          {activeTab === "library" ? "Knowledge Vault" : "Analytics"}
        </Text>
        <View style={styles.tabSwitcher}>
          <TouchableOpacity
            style={[
              styles.tabButton,
              activeTab === "library" && styles.tabButtonActive,
            ]}
            onPress={() => setActiveTab("library")}
          >
            <Text
              style={[
                styles.tabButtonText,
                activeTab === "library" && styles.tabButtonTextActive,
              ]}
            >
              Library
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.tabButton,
              activeTab === "insights" && styles.tabButtonActive,
            ]}
            onPress={() => setActiveTab("insights")}
          >
            <Text
              style={[
                styles.tabButtonText,
                activeTab === "insights" && styles.tabButtonTextActive,
              ]}
            >
              Insights
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
          />
        }
      >
        {/* --- Search Bar --- */}
        {activeTab === "library" && (
          <View style={styles.searchContainer}>
            <SearchIcon
              size={18}
              color={theme.colors.text.secondary}
              style={styles.searchIcon}
            />
            <TextInput
              placeholder="Search your vault..."
              placeholderTextColor={theme.colors.text.secondary + "80"}
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <CloseIcon size={18} color={theme.colors.text.secondary} />
              </TouchableOpacity>
            )}
          </View>
        )}
        {activeTab === "library" ? (
          <View style={styles.libraryContent}>
            {loading ? (
              // Show 4 skeletons while loading
              <View style={{ gap: 12 }}>
                {[1, 2, 3, 4].map((key) => (
                  <MaterialSkeleton key={key} theme={theme} />
                ))}
              </View>
            ) : filteredMaterials.length > 0 ? (
              filteredMaterials.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.materialCard}
                  onPress={() => router.push(`/material/${item.id}`)}
                >
                  <View style={styles.materialIcon}>
                    <Ionicons
                      name="document-text"
                      size={24}
                      color={theme.colors.primary}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.materialTitle} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={styles.materialDate}>
                      {item.createdAt?.seconds
                        ? new Date(
                            item.createdAt.seconds * 1000,
                          ).toLocaleDateString()
                        : "Just now"}
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={theme.colors.border}
                  />
                </TouchableOpacity>
              ))
            ) : (
              <View style={styles.emptyState}>
                <View style={styles.emptyIconCircle}>
                  <Ionicons
                    name={
                      searchQuery ? "search-outline" : "cloud-upload-outline"
                    }
                    size={40}
                    color={theme.colors.text.secondary}
                  />
                </View>
                <Text style={styles.emptyText}>
                  {searchQuery ? "No matches found" : "Vault is empty"}
                </Text>
                <Text style={styles.emptySubtext}>
                  {searchQuery
                    ? "Try searching for a different keyword."
                    : "Upload a syllabus to see your AI-generated study plans here."}
                </Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.content}>
            <Text
              style={{
                color: theme.colors.text.secondary,
                textAlign: "center",
                marginTop: 40,
              }}
            >
              Analytics charts go here...
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  skeletonCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  skeletonIcon: { width: 44, height: 44, borderRadius: 12, marginRight: 16 },
  skeletonLine: { height: 14, borderRadius: 4 },
});

const createStyles = (theme: Theme, isDark: boolean) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    scrollView: { flex: 1 },
    centerBox: { marginTop: 100, alignItems: "center" },
    stickyHeader: {
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
      backgroundColor: isDark ? "#2d2d2d" : "#f5f5f5",
    },
    headerTitle: {
      fontSize: 28,
      fontFamily: theme.fonts.bold,
      color: theme.colors.text.primary,
      marginBottom: 16,
    },
    tabSwitcher: {
      flexDirection: "row",
      backgroundColor: isDark ? "#1a1a1a" : "#efefef",
      borderRadius: 14,
      padding: 4,
    },
    tabButton: {
      flex: 1,
      paddingVertical: 10,
      alignItems: "center",
      borderRadius: 10,
    },
    tabButtonActive: {
      backgroundColor: theme.colors.surface,
      elevation: 2,
      shadowColor: "#000",
      shadowOpacity: 0.1,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 2 },
    },
    tabButtonText: {
      fontSize: 14,
      fontFamily: theme.fonts.medium,
      color: theme.colors.text.secondary,
    },
    tabButtonTextActive: {
      color: theme.colors.text.primary,
      fontFamily: theme.fonts.bold,
    },
    searchContainer: {
      width: "80%",
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "center",
      backgroundColor: isDark ? "#2d2d2d" : "#f5f5f5",
      borderRadius: 12,
      paddingHorizontal: 12,
      height: 44,
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginTop: 24,
      marginBottom: -12,
    },
    searchIcon: { marginRight: 12 },
    searchInput: {
      flex: 1,
      color: theme.colors.text.primary,
      fontFamily: theme.fonts.regular,
      fontSize: 18,
    },
    content: { padding: theme.spacing.lg },
    libraryContent: { padding: theme.spacing.lg, paddingBottom: 40 },
    materialCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.colors.surface,
      padding: 16,
      borderRadius: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    materialIcon: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: theme.colors.primary + "15",
      justifyContent: "center",
      alignItems: "center",
      marginRight: 16,
    },
    materialTitle: {
      fontSize: 16,
      fontFamily: theme.fonts.semiBold,
      color: theme.colors.text.primary,
    },
    materialDate: {
      fontSize: 12,
      color: theme.colors.text.secondary,
      marginTop: 2,
    },
    emptyState: { alignItems: "center", marginTop: 80, paddingHorizontal: 40 },
    emptyIconCircle: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: theme.colors.surface,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 20,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    emptyText: {
      fontSize: 18,
      fontFamily: theme.fonts.bold,
      color: theme.colors.text.primary,
    },
    emptySubtext: {
      fontSize: 14,
      fontFamily: theme.fonts.regular,
      color: theme.colors.text.secondary,
      textAlign: "center",
      marginTop: 8,
      lineHeight: 20,
    },
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: 16,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    cardTitle: {
      fontSize: 18,
      fontFamily: theme.fonts.semiBold,
      color: theme.colors.text.primary,
      marginBottom: theme.spacing.md,
    },
    chartContainer: {
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "space-between",
      height: 160,
      gap: 8,
    },
    chartBar: { flex: 1, alignItems: "center", gap: 8 },
    chartBarContainer: {
      width: "100%",
      height: 128,
      justifyContent: "flex-end",
    },
    chartBarFill: {
      width: "100%",
      borderTopLeftRadius: 6,
      borderTopRightRadius: 6,
      backgroundColor: theme.colors.primary,
    },
    chartDay: {
      fontSize: 11,
      fontFamily: theme.fonts.regular,
      color: theme.colors.text.secondary,
    },
  });
