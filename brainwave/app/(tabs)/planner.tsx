// app/(tabs)/schedule.tsx - Study Planner Page
import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../contexts/ThemeContexts";
import { Theme } from "../types";
import { Ionicons } from "@expo/vector-icons";

interface WeekDay {
  id: string;
  label: string;
  date: string;
}

interface PlanItem {
  id: number;
  time: string;
  subject: string;
  task: string;
  duration: string;
  completed: boolean;
  difficulty: "easy" | "medium" | "hard";
}

export default function Schedule() {
  const { theme } = useTheme();
  const [selectedDay, setSelectedDay] = useState("today");
  const [planItems, setPlanItems] = useState<PlanItem[]>([
    {
      id: 1,
      time: "8:00 am",
      subject: "Data structures",
      task: "Review binary trees",
      duration: "45 min",
      completed: true,
      difficulty: "medium",
    },
    {
      id: 2,
      time: "10:00 am",
      subject: "Data structures",
      task: "Class lecture",
      duration: "90 min",
      completed: false,
      difficulty: "easy",
    },
    {
      id: 3,
      time: "2:00 pm",
      subject: "Calculus ii",
      task: "Class lecture",
      duration: "90 min",
      completed: false,
      difficulty: "easy",
    },
    {
      id: 4,
      time: "4:00 pm",
      subject: "Data structures",
      task: "Complete algorithm assignment",
      duration: "120 min",
      completed: false,
      difficulty: "hard",
    },
    {
      id: 5,
      time: "8:00 pm",
      subject: "Calculus ii",
      task: "Practice integration problems",
      duration: "60 min",
      completed: false,
      difficulty: "medium",
    },
  ]);

  const styles = createStyles(theme);

  const weekDays: WeekDay[] = [
    { id: "today", label: "Today", date: "Thu 9" },
    { id: "tomorrow", label: "Tomorrow", date: "Fri 10" },
    { id: "sat", label: "Sat", date: "11" },
    { id: "sun", label: "Sun", date: "12" },
    { id: "mon", label: "Mon", date: "13" },
  ];

  const toggleTaskCompletion = (id: number) => {
    setPlanItems((items) =>
      items.map((item) =>
        item.id === id ? { ...item, completed: !item.completed } : item
      )
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
              <Ionicons name="bulb" size={20} color={theme.colors.surface} />
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
            <TouchableOpacity>
              <Text style={styles.regenerateButton}>Regenerate</Text>
            </TouchableOpacity>
          </View>

          {planItems.map((item, index) => (
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
                  name={item.completed ? "checkmark-circle" : "ellipse-outline"}
                  size={24}
                  color={
                    item.completed
                      ? theme.colors.text.primary
                      : theme.colors.border
                  }
                />
              </TouchableOpacity>

              <View style={styles.planContent}>
                <View style={styles.planTimeContainer}>
                  <View style={styles.timeRow}>
                    <Ionicons
                      name="time-outline"
                      size={14}
                      color={theme.colors.text.secondary}
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
          ))}
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
