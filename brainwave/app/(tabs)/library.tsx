import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../contexts/ThemeContext";
import { Theme } from "../types";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

const { width } = Dimensions.get("window");

// Mock / Types for logic
interface WeeklyStat {
  day: string;
  hours: number;
}
interface Subject {
  name: string;
  hours: number;
  progress: number;
  color: string;
}
interface Achievement {
  id: number;
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
}

export default function Library() {
  const { theme, isDark } = useTheme();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"insights" | "library">(
    "insights",
  );
  const styles = createStyles(theme, isDark);

  // --- MOCK DATA (Replace with your actual hooks/context) ---
  const materials = [
    { id: "1", title: "CS101 Syllabus", createdAt: new Date().toISOString() },
    { id: "2", title: "Calculus II Prep", createdAt: new Date().toISOString() },
  ];

  const weeklyStats: WeeklyStat[] = [
    { day: "Mon", hours: 3.5 },
    { day: "Tue", hours: 4.2 },
    { day: "Wed", hours: 2.8 },
    { day: "Thu", hours: 4.5 },
    { day: "Fri", hours: 3.1 },
    { day: "Sat", hours: 1.5 },
    { day: "Sun", hours: 2.0 },
  ];

  const subjects: Subject[] = [
    { name: "Data structures", hours: 12.5, progress: 78, color: "#1a1a1a" },
    { name: "Calculus ii", hours: 10.2, progress: 65, color: "#4a4a4a" },
    { name: "English literature", hours: 8.3, progress: 82, color: "#6a6a6a" },
    { name: "Physics", hours: 6.8, progress: 45, color: "#8a8a8a" },
  ];

  const achievements: Achievement[] = [
    {
      id: 1,
      title: "7-day streak",
      description: "Studied every day this week",
      icon: "🔥",
      unlocked: true,
    },
    {
      id: 2,
      title: "Early bird",
      description: "Completed 5 morning sessions",
      icon: "🌅",
      unlocked: true,
    },
    {
      id: 3,
      title: "Night owl",
      description: "10 late night study sessions",
      icon: "🦉",
      unlocked: false,
    },
    {
      id: 4,
      title: "Perfect week",
      description: "Met all weekly goals",
      icon: "⭐",
      unlocked: true,
    },
  ];

  const maxHours = Math.max(...weeklyStats.map((s) => s.hours));

  return (
    <SafeAreaView style={styles.container}>
      {/* 1. Header with Segmented Switcher */}
      <View style={styles.stickyHeader}>
        <Text style={styles.headerTitle}>Analytics</Text>
        <View style={styles.tabSwitcher}>
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
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === "insights" ? (
          <View style={styles.content}>
            {/* Overview Stats Grid */}
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <View style={styles.statHeader}>
                  <Ionicons
                    name="time-outline"
                    size={16}
                    color={theme.colors.text.primary}
                  />
                  <Text style={styles.statLabel}>This week</Text>
                </View>
                <Text style={styles.statValue}>21.6 hrs</Text>
                <View style={styles.statTrend}>
                  <Ionicons
                    name="trending-up"
                    size={12}
                    color={theme.colors.success}
                  />
                  <Text style={styles.statTrendText}>+15%</Text>
                </View>
              </View>

              <View style={styles.statCard}>
                <View style={styles.statHeader}>
                  <Ionicons
                    name="flag-outline"
                    size={16}
                    color={theme.colors.text.primary}
                  />
                  <Text style={styles.statLabel}>Weekly goal</Text>
                </View>
                <Text style={styles.statValue}>87%</Text>
                <View style={styles.progressBarMini}>
                  <View style={[styles.progressBarMiniFill, { width: "87%" }]}>
                    <LinearGradient
                      colors={[theme.colors.primary, theme.colors.secondary]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.progressGradient}
                    />
                  </View>
                </View>
              </View>
            </View>

            {/* Weekly Chart */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Study hours this week</Text>
              <View style={styles.chartContainer}>
                {weeklyStats.map((stat) => (
                  <View key={stat.day} style={styles.chartBar}>
                    <View style={styles.chartBarContainer}>
                      <View
                        style={[
                          styles.chartBarFill,
                          { height: `${(stat.hours / maxHours) * 100}%` },
                        ]}
                      />
                    </View>
                    <Text style={styles.chartDay}>{stat.day}</Text>
                    <Text style={styles.chartHours}>{stat.hours}h</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Subject Progress */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Subject progress</Text>
              <View style={styles.subjectList}>
                {subjects.map((subject, index) => (
                  <View
                    key={subject.name}
                    style={[
                      styles.subjectItem,
                      index !== subjects.length - 1 && styles.subjectItemMargin,
                    ]}
                  >
                    <View style={styles.subjectHeader}>
                      <View style={styles.subjectNameContainer}>
                        <View
                          style={[
                            styles.subjectDot,
                            { backgroundColor: subject.color },
                          ]}
                        />
                        <Text style={styles.subjectName}>{subject.name}</Text>
                      </View>
                      <View style={styles.subjectStats}>
                        <Text style={styles.subjectHours}>
                          {subject.hours}h
                        </Text>
                        <View style={styles.progressBadge}>
                          <Text style={styles.progressBadgeText}>
                            {subject.progress}%
                          </Text>
                        </View>
                      </View>
                    </View>
                    <View style={styles.progressBar}>
                      <View
                        style={[
                          styles.progressBarFill,
                          { width: `${subject.progress}%` },
                        ]}
                      >
                        <LinearGradient
                          colors={[
                            theme.colors.primary,
                            theme.colors.secondary,
                          ]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={styles.progressGradient}
                        />
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {/* Achievements */}
            <View style={styles.card}>
              <View style={styles.achievementHeader}>
                <View style={styles.achievementTitleContainer}>
                  <Ionicons
                    name="trophy-outline"
                    size={20}
                    color={theme.colors.text.primary}
                  />
                  <Text style={styles.cardTitle}>Achievements</Text>
                </View>
                <View style={styles.achievementBadge}>
                  <Text style={styles.achievementBadgeText}>3/4</Text>
                </View>
              </View>
              <View style={styles.achievementGrid}>
                {achievements.map((achievement) => (
                  <View
                    key={achievement.id}
                    style={[
                      styles.achievementCard,
                      !achievement.unlocked && styles.achievementCardLocked,
                    ]}
                  >
                    <Text style={styles.achievementIcon}>
                      {achievement.icon}
                    </Text>
                    <Text style={styles.achievementTitle}>
                      {achievement.title}
                    </Text>
                    <Text style={styles.achievementDescription}>
                      {achievement.description}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.libraryContent}>
            <Text style={styles.sectionTitle}>Knowledge Vault</Text>
            {materials.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.materialCard}
                onPress={() => router.push(`./material/${item.id}`)}
              >
                <View style={styles.materialIcon}>
                  <Ionicons
                    name="document-text"
                    size={24}
                    color={theme.colors.primary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.materialTitle}>{item.title}</Text>
                  <Text style={styles.materialDate}>
                    Added {new Date(item.createdAt).toLocaleDateString()}
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={theme.colors.border}
                />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (theme: Theme, isDark: boolean) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    scrollView: { flex: 1 },
    stickyHeader: {
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
      backgroundColor: theme.colors.background,
    },
    headerTitle: {
      fontSize: 28,
      fontFamily: theme.fonts.bold,
      color: theme.colors.text.primary,
      marginBottom: 16,
    },
    tabSwitcher: {
      flexDirection: "row",
      backgroundColor: isDark ? "#2d2d2d" : "#efefef",
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
    content: { padding: theme.spacing.lg, paddingBottom: 100 },
    libraryContent: { padding: theme.spacing.lg },
    sectionTitle: {
      fontSize: 20,
      fontFamily: theme.fonts.bold,
      color: theme.colors.text.primary,
      marginBottom: 20,
    },
    statsGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.lg,
    },
    statCard: {
      width: (width - theme.spacing.lg * 2 - theme.spacing.sm) / 2,
      backgroundColor: theme.colors.surface,
      borderRadius: 16,
      padding: theme.spacing.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    statHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginBottom: 8,
    },
    statLabel: {
      fontSize: 12,
      fontFamily: theme.fonts.regular,
      color: theme.colors.text.secondary,
    },
    statValue: {
      fontSize: 24,
      fontFamily: theme.fonts.bold,
      color: theme.colors.text.primary,
      marginBottom: 4,
    },
    statTrend: { flexDirection: "row", alignItems: "center", gap: 4 },
    statTrendText: {
      fontSize: 12,
      fontFamily: theme.fonts.medium,
      color: theme.colors.success,
    },
    progressBarMini: {
      height: 6,
      backgroundColor: theme.colors.border + "40",
      borderRadius: 3,
      overflow: "hidden",
      marginTop: 8,
    },
    progressBarMiniFill: { height: "100%", borderRadius: 3 },
    progressGradient: { flex: 1 },
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
    chartHours: {
      fontSize: 11,
      fontFamily: theme.fonts.medium,
      color: theme.colors.text.primary,
    },
    subjectList: { gap: 0 },
    subjectItem: { marginBottom: theme.spacing.md },
    subjectItemMargin: { marginBottom: theme.spacing.lg },
    subjectHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8,
    },
    subjectNameContainer: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    subjectDot: { width: 12, height: 12, borderRadius: 6 },
    subjectName: {
      fontSize: 14,
      fontFamily: theme.fonts.medium,
      color: theme.colors.text.primary,
    },
    subjectStats: { flexDirection: "row", alignItems: "center", gap: 8 },
    subjectHours: {
      fontSize: 14,
      fontFamily: theme.fonts.regular,
      color: theme.colors.text.secondary,
    },
    progressBadge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      backgroundColor: theme.colors.border + "40",
      borderRadius: 6,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    progressBadgeText: {
      fontSize: 11,
      fontFamily: theme.fonts.medium,
      color: theme.colors.text.secondary,
    },
    progressBar: {
      height: 8,
      backgroundColor: theme.colors.border + "40",
      borderRadius: 4,
      overflow: "hidden",
    },
    progressBarFill: { height: "100%", borderRadius: 4 },
    achievementHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: theme.spacing.md,
    },
    achievementTitleContainer: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    achievementBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      backgroundColor: theme.colors.border + "40",
      borderRadius: 8,
    },
    achievementBadgeText: {
      fontSize: 12,
      fontFamily: theme.fonts.medium,
      color: theme.colors.text.secondary,
    },
    achievementGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing.xs,
    },
    achievementCard: {
      width:
        (width -
          theme.spacing.lg * 2 -
          theme.spacing.md * 2 -
          theme.spacing.sm) /
        2,
      padding: theme.spacing.sm,
      backgroundColor: theme.colors.background,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: theme.colors.border,
    },
    achievementCardLocked: { opacity: 0.5 },
    achievementIcon: { fontSize: 32, marginBottom: 8 },
    achievementTitle: {
      fontSize: 14,
      fontFamily: theme.fonts.semiBold,
      color: theme.colors.text.primary,
      marginBottom: 4,
    },
    achievementDescription: {
      fontSize: 11,
      fontFamily: theme.fonts.regular,
      color: theme.colors.text.secondary,
      lineHeight: 16,
    },
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
  });
