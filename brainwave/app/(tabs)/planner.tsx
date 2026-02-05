// app/(tabs)/schedule.tsx - Study Planner Page
import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useAuth } from "../contexts/AuthContext";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../contexts/ThemeContext";
import { Theme } from "../types";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Path } from "react-native-svg";
import { doc, onSnapshot } from "firebase/firestore";
import { db as firestore } from "../../firebaseConfig";
import brainwaveApi from "@/api/brAInwaveApi";
import { useAlert } from "../contexts/AlertContext";

interface IconProps {
  color: string;
  size: number;
}

const ICONS = {
  SUCCESS:
    "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z",
  ERROR:
    "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z",
  AUTO_RENEW:
    "M12 6v3l4-4-4-4v3c-4.42 0-8 3.58-8 8 0 1.57.46 3.03 1.24 4.26L6.7 14.8c-.45-.83-.7-1.79-.7-2.8 0-3.31 2.69-6 6-6zm6.76 1.74L17.3 9.2c.44.84.7 1.79.7 2.8 0 3.31-2.69 6-6 6v-3l-4 4 4 4v-3c4.42 0 8-3.58 8-8 0-1.57-.46-3.03-1.24-4.26z",
};

const BulbIcon: React.FC<IconProps> = ({ color, size }) => (
  <Svg width={size} height={size} viewBox="0 -960 960 960" fill="none">
    <Path
      d="M480-80q-33 0-56.5-23.5T400-160h160q0 33-23.5 56.5T480-80ZM320-200v-80h320v80H320Zm10-120q-69-41-109.5-110T180-580q0-125 87.5-212.5T480-880q125 0 212.5 87.5T780-580q0 81-40.5 150T630-320H330Zm24-80h252q45-32 69.5-79T700-580q0-92-64-156t-156-64q-92 0-156 64t-64 156q0 54 24.5 101t69.5 79Zm126 0Z"
      fill={color}
    />
  </Svg>
);

const ScheduleIcon: React.FC<IconProps> = ({ color, size }) => (
  <Svg width={size} height={size} viewBox="0 -960 960 960" fill="none">
    <Path
      d="m612-292 56-56-148-148v-184h-80v216l172 172ZM480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-400Zm0 320q133 0 226.5-93.5T800-480q0-133-93.5-226.5T480-800q-133 0-226.5 93.5T160-480q0 133 93.5 226.5T480-160Z"
      fill={color}
    />
  </Svg>
);
const AISessionsIcon: React.FC<IconProps> = ({ size, color }) => (
  <Svg width={size} height={size} viewBox="0 -960 960 960" fill="none">
    <Path
      d="M852-212 732-332l56-56 120 120-56 56ZM708-692l-56-56 120-120 56 56-120 120Zm-456 0L132-812l56-56 120 120-56 56ZM108-212l-56-56 120-120 56 56-120 120Zm246-75 126-76 126 77-33-144 111-96-146-13-58-136-58 135-146 13 111 97-33 143ZM233-120l65-281L80-590l288-25 112-265 112 265 288 25-218 189 65 281-247-149-247 149Zm247-361Z"
      fill={color}
    />
  </Svg>
);

export default function Schedule() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [ planItems, setPlanItems ] = useState<any[]>([]);
  const [ isLoading, setLoading ] = useState(true);
  const { showAlert } = useAlert();

  const styles = createStyles(theme);

  const weekDays = useMemo(() => {
    const days = [];
    const now = new Date();

    for (let i = 0; i < 5; i++) {
      const date = new Date();
      date.setDate(now.getDate() + i);

      const id = date.toISOString().split("T")[0];

      let label = "";
      if (i === 0) label = "Today";
      else if (i === 1) label = "Tomorrow";
      else label = date.toLocaleDateString("en-US", { weekday: "short" });

      const dayDate = date.toLocaleDateString("en-US", {
        day: "numeric",
        month: i < 5 ? "short" : undefined,
      });

      days.push({ id, label, date: dayDate });
    }
    return days;
  }, []);

  const [selectedDay, setSelectedDay] = useState(weekDays[0].id);

  useEffect(() => {
    if (!user?.id) return;

    setLoading(true);

    const unsub = onSnapshot(
      doc(firestore, "users", user.id, "plans", selectedDay),
      (docSnap) => {
        if (docSnap.exists()) {
          setPlanItems(docSnap.data().items || []);
        }
        setLoading(false);
      },
      (error) => {
        console.error("Firebase error: ", error);
        setLoading(false);
      },
    );

    return () => unsub();
  }, [user?.id, selectedDay]);

  const toggleTaskCompletion = (id: number) => {
    setPlanItems((items) =>
      items.map((item) =>
        item.id === id ? { ...item, completed: !item.completed } : item,
      ),
    );
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "easy":
        return theme.colors.success + "30";
      case "medium":
        return theme.colors.warning + "30";
      case "hard":
        return theme.colors.error + "30";
      default:
        return theme.colors.border;
    }
  };

  const getDifficultyTextColor = (difficulty: string) => {
    switch (difficulty) {
      case "easy":
        return theme.colors.success;
      case "medium":
        return theme.colors.warning;
      case "hard":
        return theme.colors.error;
      default:
        return theme.colors.text.secondary;
    }
  };

  const handleRegenerate = async () => {
    
    setLoading(true);
    
    try {
      if (!user?.id) {
        Alert.alert("Error", "User information is not available.");
        return;
      }

      // This calls the API
      // We pass the selectedDay so the AI knows which date to plan for
      const response = await brainwaveApi.generateDailyPlan(
        user.id,
        selectedDay,
      );

      await brainwaveApi.generateDailyPlan(user.id, selectedDay)

      if (response.success) {
        showAlert({
          title: "Schedule Optimized",
          message: `brAInwave has successfully reorganized your classes and study blocks for ${selectedDay}`,
          iconPath: ICONS.SUCCESS,
          iconColor: "#4CAF50",
          confirmText: "View Plan",
        })
      }
    } catch (error) {
      console.error("Regeneration failed:", error);
      showAlert({
        title: "Optimization Failed",
        message: "We couldn't connect to the server. Please check your internet connection and try again",
        iconPath: ICONS.ERROR,
        iconColor: "#F44336",
        confirmText: "Retry",
        showCancel: true,
        onConfirm: handleRegenerate
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Study planner</Text>
            <Text style={styles.headerSubtitle}>
              AI-optimized schedule for your success
            </Text>
          </View>
        </View>

        {/* AI Insights Banner */}
        <View style={styles.insightContainer}>
          <View style={styles.insightCard}>
            <View style={styles.insightIcon}>
              <BulbIcon color={theme.colors.surface} size={28} />
            </View>
            <View style={styles.insightText}>
              <Text style={styles.insightTitle}>AI insight</Text>
              <Text style={styles.insightDescription}>
                You're most productive in the evening. I've scheduled
                challenging tasks after 6 pm.
              </Text>
            </View>
          </View>
        </View>

        {/* Week Selector */}
        <View style={styles.weekSelectorContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.weekSelector}
          >
            {weekDays.map((day) => (
              <TouchableOpacity
                key={day.id}
                style={[
                  styles.dayButton,
                  selectedDay === day.id && styles.dayButtonActive,
                ]}
                onPress={() => setSelectedDay(day.id)}
              >
                <Text
                  style={[
                    styles.dayLabel,
                    selectedDay === day.id && styles.dayLabelActive,
                  ]}
                >
                  {day.label}
                </Text>
                <Text
                  style={[
                    styles.dayDate,
                    selectedDay === day.id && styles.dayDateActive,
                  ]}
                >
                  {day.date}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Study Plan */}
        <View style={styles.planContainer}>
          <View style={styles.planHeader}>
            <Text style={styles.planTitle}>Today's schedule</Text>
            {planItems.length > 0 && (
              <TouchableOpacity onPress={handleRegenerate}>
                <Text style={styles.regenerateButton}>Regenerate</Text>
              </TouchableOpacity>
            )}
          </View>

          {planItems.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconContainer}>
                <AISessionsIcon size={48} color={theme.colors.text.secondary} />
              </View>
              <Text style={styles.emptyText}>No plan for this day</Text>
              <TouchableOpacity
                style={styles.generateButton}
                onPress={handleRegenerate}
              >
                <Text style={styles.generateButtonText}>Generate AI Plan</Text>
              </TouchableOpacity>
            </View>
          ) : (
            planItems.map((item, index) => (
              <View
                key={item.id}
                style={[
                  styles.planCard,
                  item.completed && styles.planCardCompleted,
                  index !== planItems.length - 1 && styles.planCardMargin,
                ]}
              >
                <TouchableOpacity
                  style={styles.checkboxContainer}
                  onPress={() => toggleTaskCompletion(item.id)}
                >
                  <Ionicons
                    name={
                      item.completed ? "checkmark-circle" : "ellipse-outline"
                    }
                    size={24}
                    color={
                      item.completed
                        ? theme.colors.primary
                        : theme.colors.border
                    }
                  />
                </TouchableOpacity>

                <View style={styles.planContent}>
                  <View style={styles.planTimeContainer}>
                    <View style={styles.timeRow}>
                      <ScheduleIcon
                        color={theme.colors.text.secondary}
                        size={12}
                      />
                      <Text style={styles.timeText}>{item.time}</Text>
                      <View style={styles.durationBadge}>
                        <Text style={styles.durationText}>{item.duration}</Text>
                      </View>
                    </View>
                  </View>

                  <Text
                    style={[
                      styles.taskTitle,
                      item.completed && styles.taskTitleCompleted,
                    ]}
                  >
                    {item.task}
                  </Text>
                  <Text style={styles.subjectText}>{item.subject}</Text>

                  <View
                    style={[
                      styles.difficultyBadge,
                      { backgroundColor: getDifficultyColor(item.difficulty) },
                    ]}
                  >
                    <Text
                      style={[
                        styles.difficultyText,
                        { color: getDifficultyTextColor(item.difficulty) },
                      ]}
                    >
                      {item.difficulty}
                    </Text>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Add Custom Task Button */}
        <View style={styles.addTaskContainer}>
          <TouchableOpacity style={styles.addTaskButton}>
            <Text style={styles.addTaskText}>+ Add custom task</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollView: {
      flex: 1,
    },
    header: {
      backgroundColor: theme.colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      padding: theme.spacing.lg,
    },
    headerTitle: {
      fontSize: 28,
      fontFamily: theme.fonts.bold,
      color: theme.colors.text.primary,
      marginBottom: 4,
    },
    headerSubtitle: {
      fontSize: 14,
      fontFamily: theme.fonts.regular,
      color: theme.colors.text.secondary,
    },
    insightContainer: {
      padding: theme.spacing.lg,
    },
    insightCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: 16,
      padding: theme.spacing.md,
      flexDirection: "row",
      gap: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    insightIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.colors.text.primary,
      justifyContent: "center",
      alignItems: "center",
    },
    insightText: {
      flex: 1,
    },
    insightTitle: {
      fontSize: 16,
      fontFamily: theme.fonts.semiBold,
      color: theme.colors.text.primary,
      marginBottom: 4,
    },
    insightDescription: {
      fontSize: 14,
      fontFamily: theme.fonts.regular,
      color: theme.colors.text.secondary,
      lineHeight: 20,
    },
    weekSelectorContainer: {
      paddingHorizontal: theme.spacing.lg,
      marginBottom: theme.spacing.lg,
    },
    weekSelector: {
      gap: 8,
      paddingBottom: 8,
    },
    dayButton: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderRadius: 12,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      minWidth: 80,
      alignItems: "center",
    },
    dayButtonActive: {
      backgroundColor: theme.colors.primary,
    },
    dayLabel: {
      fontSize: 14,
      fontFamily: theme.fonts.medium,
      color: theme.colors.text.primary,
    },
    dayLabelActive: {
      color: "#f5f5f5",
    },
    dayDate: {
      fontSize: 12,
      fontFamily: theme.fonts.regular,
      color: theme.colors.text.secondary,
      marginTop: 4,
    },
    dayDateActive: {
      color: "#f5f5f5",
      opacity: 0.7,
    },
    planContainer: {
      paddingHorizontal: theme.spacing.lg,
    },
    planHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: theme.spacing.md,
    },
    planTitle: {
      fontSize: 18,
      fontFamily: theme.fonts.semiBold,
      color: theme.colors.text.primary,
    },
    regenerateButton: {
      fontSize: 14,
      fontFamily: theme.fonts.medium,
      color: theme.colors.primary,
    },
    emptyState: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 60,
      backgroundColor: theme.colors.surface,
      borderRadius: 16,
      marginTop: 20,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderStyle: "dashed", // Gives it a "waiting to be filled" look
    },
    emptyIconContainer: {
      marginBottom: 16,
      opacity: 0.5,
    },
    emptyText: {
      fontSize: 16,
      color: theme.colors.text.secondary,
      textAlign: "center",
      marginBottom: 24,
      paddingHorizontal: 40,
      lineHeight: 22,
    },
    generateButton: {
      backgroundColor: theme.colors.primary,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 12,
      elevation: 2,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
    },
    generateButtonText: {
      color: theme.colors.secondary,
      fontWeight: "600",
      fontSize: 15,
    },
    planCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: 16,
      padding: theme.spacing.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      flexDirection: "row",
      gap: 12,
    },
    planCardCompleted: {
      opacity: 0.6,
    },
    planCardMargin: {
      marginBottom: theme.spacing.sm,
    },
    checkboxContainer: {
      paddingTop: 4,
    },
    planContent: {
      flex: 1,
    },
    planTimeContainer: {
      marginBottom: theme.spacing.xs,
    },
    timeRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    timeText: {
      fontSize: 14,
      fontFamily: theme.fonts.regular,
      color: theme.colors.text.secondary,
    },
    durationBadge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      backgroundColor: theme.colors.border + "40",
      borderRadius: 6,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    durationText: {
      fontSize: 11,
      fontFamily: theme.fonts.medium,
      color: theme.colors.text.secondary,
    },
    taskTitle: {
      fontSize: 16,
      fontFamily: theme.fonts.medium,
      color: theme.colors.text.primary,
      marginBottom: 4,
    },
    taskTitleCompleted: {
      textDecorationLine: "line-through",
    },
    subjectText: {
      fontSize: 14,
      fontFamily: theme.fonts.regular,
      color: theme.colors.text.secondary,
      marginBottom: theme.spacing.sm,
    },
    difficultyBadge: {
      alignSelf: "flex-start",
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 6,
    },
    difficultyText: {
      fontSize: 12,
      fontFamily: theme.fonts.medium,
    },
    addTaskContainer: {
      padding: theme.spacing.lg,
      paddingBottom: 100,
    },
    addTaskButton: {
      borderWidth: 2,
      borderColor: theme.colors.border,
      borderStyle: "dashed",
      borderRadius: 12,
      paddingVertical: theme.spacing.md,
      alignItems: "center",
    },
    addTaskText: {
      fontSize: 14,
      fontFamily: theme.fonts.medium,
      color: theme.colors.text.secondary,
    },
  });
