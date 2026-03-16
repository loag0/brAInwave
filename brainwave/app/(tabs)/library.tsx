import React, { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../contexts/ThemeContext";
import { Theme } from "../types";
import { useRouter } from "expo-router";
import {
  SearchIcon,
  CloseIcon,
  UploadSyllabusIcon,
  ChevronRightIcon,
  AddIcon,
} from "@/components/Icons";
import { useContent } from "../hooks/useContent";
import { useAuth } from "../contexts/AuthContext";
import { LocalDB } from "../database/localDb";
import { useFocusEffect } from "@react-navigation/native";
import Svg, { Path, SvgProps } from "react-native-svg";
import { useAlert } from "../contexts/AlertContext";
import BrainwaveLoader from "@/components/BrainwaveLoader";
import * as DocumentPicker from "expo-document-picker";

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

interface IconProps extends SvgProps {
  size?: number;
  color?: string;
}

export default function Library() {
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const { refresh, createMaterial, materials, syncProgress, isLoading } = useContent();

  const [activeTab, setActiveTab] = useState<"library" | "insights">("library");
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const { showAlert } = useAlert();
  const [ isUploading, setIsUploading ] = useState(false);

  // Insights Data State
  const [streakCount, setStreakCount] = useState(0);
  const [weeklyActivity, setWeeklyActivity] = useState<any[]>([]);

  const [moduleHours, setModuleHours] = useState<{ module_tag: string; total_minutes: number }[]>([]);
  const [moduleGoals, setModuleGoals] = useState<{ module_tag: string; weekly_goal_minutes: number }[]>([]);
  const [editingGoal, setEditingGoal] = useState<string | null>(null);
  const [goalInput, setGoalInput] = useState("");

  const styles = createStyles(theme, isDark);

  const SearchQueryIcon: React.FC<IconProps> = ({ size, color }) => (
    <Svg width={size} height={size} viewBox="0 -960 960 960" fill="none">
      <Path
        d={
          searchQuery
            ? "M784-120 532-372q-30 24-69 38t-83 14q-109 0-184.5-75.5T120-580q0-109 75.5-184.5T380-840q109 0 184.5 75.5T640-580q0 44-14 83t-38 69l252 252-56 56ZM380-400q75 0 127.5-52.5T560-580q0-75-52.5-127.5T380-760q-75 0-127.5 52.5T200-580q0 75 52.5 127.5T380-400Z"
            : "M260-160q-91 0-155.5-63T40-377q0-78 47-139t123-78q25-92 100-149t170-57q117 0 198.5 81.5T760-520q69 8 114.5 59.5T920-340q0 75-52.5 127.5T740-160H520q-33 0-56.5-23.5T440-240v-206l-64 62-56-56 160-160 160 160-56 56-64-62v206h220q42 0 71-29t29-71q0-42-29-71t-71-29h-60v-80q0-83-58.5-141.5T480-720q-83 0-141.5 58.5T280-520h-20q-58 0-99 41t-41 99q0 58 41 99t99 41h100v80H260Zm220-280Z"
        }
        fill={color}
      />
    </Svg>
  );

  const onRefresh = async () => {
    setRefreshing(true);
    if (activeTab === "library") {
      await refresh(true);
    } else {
      loadInsights();
    }
    setRefreshing(false);
  };

  const loadInsights = useCallback(() => {
    if (!user?.id) return;
    const streak = LocalDB.getStreakCount(user.id);
    const activity = LocalDB.getWeeklyActivity(user.id);
    const modules = LocalDB.getModuleStudyHours(user.id);
    const goals = LocalDB.getModuleGoals(user.id);
    setStreakCount(streak);
    setWeeklyActivity(activity);
    setModuleHours(modules);
    setModuleGoals(goals);
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      if (activeTab === "library") {
        refresh(true);
      } else {
        loadInsights();
      }
    }, [refresh, activeTab, loadInsights]),
  );

  const handleUploadSyllabus = useCallback(async () => {
    if (!user?.id) {
      showAlert?.({ title: "Error", message: "You must be logged in" });
      return;
    }

    const result = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "image/*"],
      copyToCacheDirectory: true,
      multiple: true,
    });

    if (result.canceled || !result.assets) return;

    setIsUploading(true);

    try {
      for (const asset of result.assets) {
        const cleanTitle = decodeURIComponent(asset.name)
          .replace(/%20/g, " ")
          .replace(/\.[^/.]+$/, "")
          .trim();

        await createMaterial(
          cleanTitle,
          "",
          asset.uri,
          asset.mimeType || "application/pdf",
        );
      }
      showAlert?.({
        title: "Success",
        message: "Syllabus imported and planning initiated!",
      });
    } catch (e: any) {
      if(__DEV__) console.error(e.message);
      showAlert?.({ title: "Import Failed", message: "Failed to read file." });
    } finally {
      setIsUploading(false);
    }
  }, [user?.id, createMaterial, showAlert]);

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

      {syncProgress.total > 0 && (
        <View
          style={{
            padding: 12,
            backgroundColor: theme.colors.surface,
            alignItems: "center",
            flexDirection: "row",
            justifyContent: "center",
          }}
        >
          <ActivityIndicator size="small" color={theme.colors.primary} />
          <Text
            style={{
              color: theme.colors.text.primary,
              fontSize: 14,
              fontWeight: "600",
              marginLeft: 10,
            }}
          >
            Syncing {syncProgress.current}/{syncProgress.total} items...
          </Text>
        </View>
      )}
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingBottom: 200 }}
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
            {isLoading ? (
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
                    <UploadSyllabusIcon
                      size={24}
                      color={theme.colors.primary}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.materialTitle} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={styles.materialDate}>
                      {item.created_at
                        ? new Date(item.created_at).toLocaleDateString("en-GB")
                        : "Just now"}
                    </Text>
                  </View>
                  <ChevronRightIcon
                    size={20}
                    color={theme.colors.text.secondary}
                  />
                </TouchableOpacity>
              ))
            ) : (
              <View style={styles.emptyState}>
                <View style={styles.emptyIconCircle}>
                  <SearchQueryIcon
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
            {/* Streak Card */}
            <View
              style={[
                styles.card,
                {
                  backgroundColor: theme.colors.primary + "10",
                  borderColor: theme.colors.primary + "30",
                },
              ]}
            >
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
              >
                <View
                  style={[
                    styles.iconBox,
                    { backgroundColor: theme.colors.primary },
                  ]}
                >
                  <Svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                    <Path d="M12,2C12,2 10.5,5.5 10.5,8C10.5,10.21 12.29,12 14.5,12C16.71,12 18.5,10.21 18.5,8C18.5,5.5 17,2 17,2C17,2 22,8 22,13C22,18.52 17.52,23 12,23C6.48,23 2,18.52 2,13C2,8 7,2 7,2C7,2 6,5 6,8C6,10.21 7.79,12 10,12C12.21,12 14,10.21 14,8C14,5.5 12,2 12,2Z" />
                  </Svg>
                </View>
                <View>
                  <Text
                    style={[styles.cardLabel, { color: theme.colors.primary }]}
                  >
                    Current Streak
                  </Text>
                  <Text style={styles.streakValue}>{streakCount} Days</Text>
                </View>
              </View>
              <Text style={styles.insightText}>
                {streakCount > 0
                  ? "You're on fire! Keep it up to hit your goals."
                  : "Start a focus session today to begin your streak!"}
              </Text>
            </View>

            {/* Activity Chart */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Daily Study Time (Min)</Text>
              <View style={styles.chartContainer}>
                {(() => {
                  const days = [
                    "Sun",
                    "Mon",
                    "Tue",
                    "Wed",
                    "Thu",
                    "Fri",
                    "Sat",
                  ];
                  const activityMap = new Map();
                  weeklyActivity.forEach((item) => {
                    const d = new Date(item.date);
                    activityMap.set(d.getDay(), item.minutes_studied);
                  });

                  return days.map((day, idx) => {
                    const mins = activityMap.get(idx) || 0;
                    //reduced the max height for demonstration properties
                    const height = Math.min(100, (mins / 20) * 100); // 5h max height
                    return (
                      <View key={day} style={styles.chartBar}>
                        <View style={styles.chartBarContainer}>
                          {mins > 0 && (
                            <Text style={styles.chartBarLabel}>{mins}m</Text>
                          )}
                          <View
                            style={[
                              styles.chartBarFill,
                              {
                                height: `${Math.max(5, height)}%`,
                                opacity: mins > 0 ? 1 : 0.3,
                              },
                            ]}
                          />
                        </View>
                        <Text style={styles.chartDay}>{day}</Text>
                      </View>
                    );
                  });
                })()}
              </View>
            </View>

            {/* Summary Stats */}
            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={[styles.card, { flex: 1 }]}>
                <Text style={styles.statLabel}>Avg. Focus</Text>
                <Text style={styles.statValue}>
                  {weeklyActivity.length > 0
                    ? Math.round(
                        weeklyActivity.reduce(
                          (acc, curr) => acc + curr.minutes_studied,
                          0,
                        ) / 7,
                      )
                    : 0}
                  m
                </Text>
              </View>
              <View style={[styles.card, { flex: 1 }]}>
                <Text style={styles.statLabel}>Total Time</Text>
                <Text style={styles.statValue}>
                  {(
                    weeklyActivity.reduce(
                      (acc, curr) => acc + curr.minutes_studied,
                      0,
                    ) / 60
                  ).toFixed(1)}
                  h
                </Text>
              </View>
            </View>

            {/* Module Study Hours */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Hours by Module</Text>
              <Text
                style={[
                  styles.insightText,
                  { marginTop: -8, marginBottom: 12 },
                ]}
              >
                This week · Tap a module to set a goal
              </Text>
              {moduleHours.length === 0 ? (
                <Text
                  style={[
                    styles.insightText,
                    { textAlign: "center", paddingVertical: 12 },
                  ]}
                >
                  Complete a tagged focus session to see module hours.
                </Text>
              ) : (
                <View style={{ gap: 14 }}>
                  {moduleHours.map(({ module_tag, total_minutes }) => {
                    const goal = moduleGoals.find(
                      (g) => g.module_tag === module_tag,
                    );
                    const goalMins = goal?.weekly_goal_minutes ?? null;
                    const pct = goalMins
                      ? Math.min(
                          Math.round((total_minutes / goalMins) * 100),
                          100,
                        )
                      : null;
                    const hrs = Math.floor(total_minutes / 60);
                    const mins = total_minutes % 60;
                    const actualLabel =
                      hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
                    const goalLabel = goalMins
                      ? `/ ${Math.floor(goalMins / 60)}h ${goalMins % 60 > 0 ? `${goalMins % 60}m` : ""}`.trim()
                      : "";

                    const barColor =
                      pct === null
                        ? theme.colors.primary
                        : pct >= 80
                          ? theme.colors.success
                          : pct >= 50
                            ? theme.colors.warning
                            : theme.colors.error;

                    const isEditing = editingGoal === module_tag;

                    return (
                      <TouchableOpacity
                        key={module_tag}
                        onPress={() => {
                          if (isEditing) return;
                          setEditingGoal(module_tag);
                          setGoalInput(
                            goalMins ? String(Math.floor(goalMins / 60)) : "",
                          );
                        }}
                        activeOpacity={0.7}
                      >
                        {/* Row header */}
                        <View
                          style={{
                            flexDirection: "row",
                            justifyContent: "space-between",
                            marginBottom: 6,
                          }}
                        >
                          <Text style={styles.moduleRowLabel}>
                            {module_tag}
                          </Text>
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "baseline",
                              gap: 4,
                            }}
                          >
                            <Text
                              style={[
                                styles.moduleRowValue,
                                { color: barColor },
                              ]}
                            >
                              {actualLabel}
                            </Text>
                            {pct !== null && pct >= 100 ? (
                              <Text
                                style={[
                                  styles.moduleRowGoal,
                                  { color: theme.colors.success },
                                ]}
                              >
                                Goal reached!
                              </Text>
                            ) : goalLabel ? (
                              <Text style={styles.moduleRowGoal}>
                                {goalLabel}
                              </Text>
                            ) : (
                              <Text style={styles.moduleRowGoal}>
                                · set goal
                              </Text>
                            )}
                          </View>
                        </View>

                        {/* Bar */}
                        <View style={styles.moduleBarTrack}>
                          <View
                            style={[
                              styles.moduleBarFill,
                              {
                                width:
                                  pct !== null
                                    ? `${Math.max(pct, 3)}%`
                                    : "100%",
                                backgroundColor: barColor,
                                opacity: pct === null ? 0.3 : 1,
                              },
                            ]}
                          />
                        </View>

                        {/* Inline goal editor */}
                        {isEditing && (
                          <View style={styles.goalEditor}>
                            <TextInput
                              style={styles.goalInput}
                              keyboardType="numeric"
                              placeholder="Hours per week"
                              placeholderTextColor={
                                theme.colors.text.secondary + "80"
                              }
                              value={goalInput}
                              onChangeText={setGoalInput}
                              autoFocus
                              maxLength={3}
                            />
                            <TouchableOpacity
                              style={[
                                styles.goalConfirmBtn,
                                { backgroundColor: theme.colors.primary },
                              ]}
                              onPress={() => {
                                const hrs = parseFloat(goalInput);
                                if (!isNaN(hrs) && hrs > 0 && user?.id) {
                                  LocalDB.setModuleGoal(
                                    user.id,
                                    module_tag,
                                    Math.round(hrs * 60),
                                  );
                                  setModuleGoals(
                                    LocalDB.getModuleGoals(user.id),
                                  );
                                }
                                setEditingGoal(null);
                                setGoalInput("");
                              }}
                            >
                              <Text
                                style={{
                                  color: "#fff",
                                  fontSize: 13,
                                  fontFamily: theme.fonts.semiBold,
                                }}
                              >
                                Save
                              </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => {
                                setEditingGoal(null);
                                setGoalInput("");
                              }}
                            >
                              <Text
                                style={{
                                  color: theme.colors.error,
                                  fontSize: 13,
                                  fontFamily: theme.fonts.medium,
                                }}
                              >
                                Cancel
                              </Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Uploading overlay */}
      {isUploading && (
        <View
          style={{
            ...StyleSheet.absoluteFillObject,
            backgroundColor: "rgba(0,0,0,0.7)",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 999,
          }}
        >
          <BrainwaveLoader theme={theme} />
          <Text style={{ color: "#fff", marginTop: 16, fontWeight: "600" }}>
            Importing syllabus...
          </Text>
        </View>
      )}

      {/* FAB — only show on library tab */}
      {activeTab === "library" && (
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: theme.colors.primary }]}
          onPress={handleUploadSyllabus}
          activeOpacity={0.8}
        >
          <AddIcon color={theme.colors.secondary} size={36} />
        </TouchableOpacity>
      )}
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
    chartBarLabel: {
      position: "absolute",
      top: -18,
      fontSize: 10,
      fontFamily: theme.fonts.bold,
      color: theme.colors.text.secondary,
      width: "100%",
      textAlign: "center",
      opacity: 0.8,
    },
    iconBox: {
      width: 48,
      height: 48,
      borderRadius: 14,
      justifyContent: "center",
      alignItems: "center",
    },
    cardLabel: {
      fontSize: 12,
      fontFamily: theme.fonts.bold,
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    streakValue: {
      fontSize: 24,
      fontFamily: theme.fonts.bold,
      color: theme.colors.text.primary,
    },
    insightText: {
      fontSize: 14,
      fontFamily: theme.fonts.regular,
      color: theme.colors.text.secondary,
      marginTop: 12,
      lineHeight: 20,
    },
    statLabel: {
      fontSize: 12,
      fontFamily: theme.fonts.medium,
      color: theme.colors.text.secondary,
      marginBottom: 4,
    },
    statValue: {
      fontSize: 20,
      fontFamily: theme.fonts.bold,
      color: theme.colors.text.primary,
    },
    moduleRowLabel: {
      fontSize: 13,
      fontFamily: theme.fonts.medium,
      color: theme.colors.text.primary,
    },
    moduleRowValue: {
      fontSize: 13,
      fontFamily: theme.fonts.semiBold,
    },
    moduleRowGoal: {
      fontSize: 12,
      fontFamily: theme.fonts.regular,
      color: theme.colors.text.secondary,
    },
    moduleBarTrack: {
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.colors.border,
      overflow: "hidden",
    },
    moduleBarFill: {
      height: "100%",
      borderRadius: 3,
    },
    goalEditor: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginTop: 8,
      paddingTop: 8,
      borderTopWidth: 0.5,
      borderTopColor: theme.colors.border,
    },
    goalInput: {
      flex: 1,
      height: 36,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: 10,
      fontSize: 14,
      color: theme.colors.text.primary,
      fontFamily: theme.fonts.regular,
      backgroundColor: theme.colors.background,
    },
    goalConfirmBtn: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 8,
    },
    fab: {
      position: "absolute",
      bottom: 30,
      right: 20,
      width: 60,
      height: 60,
      borderRadius: 30,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.primary,
      elevation: 5,
    },
  });