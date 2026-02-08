// app/(tabs)/Planner.tsx - Study Planner Page
import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  TouchableWithoutFeedback,
  ActivityIndicator,
  Animated,
  Easing,
} from "react-native";
import { useAuth } from "../contexts/AuthContext";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../contexts/ThemeContext";
import { Theme } from "../types";
import { Ionicons } from "@expo/vector-icons";
import { doc, setDoc, onSnapshot } from "firebase/firestore";
import { db as firestore } from "../../firebaseConfig";
import brainwaveApi from "@/api/brAInwaveApi";
import { useAlert } from "../contexts/AlertContext";
import DateTimePicker from "@react-native-community/datetimepicker";
import { PlannerIcon, SunIcon, InsightIcon, ICONS } from "@/components/Icons";

const PlannerSkeleton = ({ theme }: { theme: any }) => {
  const styles = createStyles(theme);
  const pulseAnimation = React.useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    // Set up the infinite pulse loop
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnimation, {
          toValue: 0.8,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnimation, {
          toValue: 0.4,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );

    pulse.start();
    return () => pulse.stop();
  }, [pulseAnimation]);

  return (
    <View style={styles.planContainer}>
      {[1, 2, 3].map((key) => (
        <Animated.View
          key={key}
          style={[
            styles.planCard,
            { opacity: pulseAnimation, marginBottom: 15 },
          ]}
        >
          <View
            style={[
              styles.checkboxContainer,
              {
                backgroundColor: theme.colors.border,
                borderRadius: 12,
                width: 24,
                height: 24,
              },
            ]}
          />
          <View style={{ flex: 1, marginLeft: 15 }}>
            <View
              style={{
                width: "40%",
                height: 10,
                backgroundColor: theme.colors.border,
                borderRadius: 4,
                marginBottom: 8,
              }}
            />
            <View
              style={{
                width: "80%",
                height: 16,
                backgroundColor: theme.colors.border,
                borderRadius: 4,
                marginBottom: 8,
              }}
            />
            <View
              style={{
                width: "30%",
                height: 20,
                backgroundColor: theme.colors.border,
                borderRadius: 10,
              }}
            />
          </View>
        </Animated.View>
      ))}
    </View>
  );
};

export default function Planner() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { showAlert } = useAlert();

  //This is for state management
  const [planItems, setPlanItems] = useState<any[]>([]);
  const [isLoading, setLoading] = useState(true);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [weeklyTemplate, setWeeklyTemplate] = useState<Record<string, any[]>>(
    {},
  );

  //This is for modal states and for the picker
  const [isModalVisible, setModalVisible] = useState(false);
  const [newTask, setNewTask] = useState({ task: "", time: "12:00 PM" });
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [timeValue, setTimeValue] = useState(new Date());

  const styles = createStyles(theme);

  const aiInsight = useMemo(() => {
    const priorities = user?.studyPreferences?.subjectPriorities || [];
    const topSubject = priorities[0];

    const hasHardestSubject = planItems.some(
      (item) => item.subject?.toLowerCase() === topSubject?.toLowerCase()
    );

    if (topSubject && hasHardestSubject){
      return {
        title: "Priority Focus",
        text: `I've prioritized ${topSubject} today. Get it done early!`,
        icon: "rocket"
      };
    }

    if(topSubject && !hasHardestSubject){
      return {
        title: "Light Day?",
        text: `No ${topSubject} sessions today. Use this extra headspace to review your #2 priority: ${priorities[1] || 'your notes'}.`,
        icon: "leaf",
      };
    }
    return{
      title: "AI Insight",
      text: "You're most productive in the evening. I've planned challenging tasks after 6pm.",
      icon: "bulb"
    };
  }, [planItems, user?.studyPreferences?.subjectPriorities]);

  const weekDays = useMemo(() => {
    const days = [];
    const now = new Date();

    for (let i = 0; i < 5; i++) { // change the 5 to alter how many days the scroller shows
      const date = new Date();
      date.setDate(now.getDate() + i);

      const id = date.toISOString().split("T")[0];

      let label = "";
      if (i === 0) label = "Today";
      else if (i === 1) label = "Tomorrow";
      else label = date.toLocaleDateString("en-US", { weekday: "short" });

      const dayDate = date.toLocaleDateString("en-US", {
        day: "numeric",
        month: i < 5 ? "short" : undefined, //edit if you wanna limit how far it shows the month under the day
      });

      days.push({ id, label, date: dayDate });
    }
    return days;
  }, []);

  const [selectedDay, setSelectedDay] = useState(weekDays[0].id);

  //Initial fetch from db for timetable
  useEffect(() => {
    if (!user?.id) return;

    setLoading(true);

    const unsubTemplate = onSnapshot(
      doc(firestore, "users", user.id, "data", "timetable"),
      (docSnap) => {
        if (docSnap.exists()) {
          setWeeklyTemplate(docSnap.data().weekly_template || {});
        }
        setLoading(false);
      },
      (error) => {
        console.error("Firebase error: ", error);
        setLoading(false);
      },
    );

    return () => unsubTemplate();
  }, [user?.id]);

  //Fetches data for day switching
  useEffect(() => {
    if (!user?.id) return;

    setLoading(true);

    const unsubPlan = onSnapshot(
      doc(firestore, "users", user.id, "plans", selectedDay),
      (docSnap) => {
        if (docSnap.exists()) {
          //if there is a generated plan, show that
          setPlanItems(docSnap.data().items || []);

        } else {
          //FALLBACK: if there is no plan, then just show classes from the template
          const dateObj = new Date(selectedDay);
          const dayName = dateObj
            .toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" })
            .toLowerCase();

          const templateClasses = weeklyTemplate?.[dayName] || [];

          const formattedItems = templateClasses.map(
            (cls: any, index: number) => ({
              id: `temp-${index}`,
              time: cls.time,
              subject: cls.subject,
              task: "Class Lecture",
              duration: "1 hour",
              completed: false,
              difficulty: "medium",
              isTemplate: true,
            }),
          );

          setPlanItems(formattedItems);
        }
        setLoading(false);
      },
      (error) => {
        console.error("Plan fetch error: ", error);
        setLoading(false);
      }
    );
    return () => unsubPlan();
  }, [user?.id, selectedDay, weeklyTemplate]);

  const toggleTaskCompletion = (id: string | number) => {
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
    if (!user?.id) return;

    setIsOptimizing(true);

    try {
      if (!user?.id) {
        showAlert({
          title: "Error",
          message: "User info is not available",
        });
        return;
      }
      // This calls the API
      // We pass the selectedDay so the AI knows which date to plan for
      const response = await brainwaveApi.generateDailyPlan(
        user.id,
        selectedDay,
        user.studyPreferences,
        [] // <-- custom tasks btw
      );

      if (response.success) {
        showAlert({
          title: "Schedule Optimized",
          message: "brAInwave has successfully updated your schedule!",
          iconPath: ICONS.SUCCESS,
          confirmText: "Ok",
        });
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
        onConfirm: handleRegenerate,
      });
    } finally {
      setIsOptimizing(false);
    }
  };

  const onTimeChange = (event: any, selectedDate?: Date) => {
    setShowTimePicker(false);

    if (selectedDate) {
      setTimeValue(selectedDate);
      const formattedTime = selectedDate.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
      setNewTask({ ...newTask, time: formattedTime });
    }
  };

  const handleAddTask = async () => {

    if(!user?.id) return;

    if (!newTask.task.trim()) {
      showAlert({
        title: "Hold Up!",
        message: "What's the name of the task homeblud?",
      });
      return;
    }
    const newTaskItem = {
      id: Date.now().toString(),
      task: newTask.task,
      time: newTask.time,
      subject: "Personal",
      duration: "1 hour",
      completed: false,
      difficulty: "easy",
      isCustom: true
    }

    try{
      const planRef = doc(firestore, "users", user.id, "plans", selectedDay);

      const currentItems = planItems.filter(item => !item.isTemplate);

      await setDoc(planRef, {
        items: [...currentItems, newTaskItem]
      }, {merge: true});

      setNewTask({ task: "", time: "12:00 PM" });
      setModalVisible(false);
    } catch(e){
      console.error("Error adding task: ", e);
      showAlert({ title: "Oooooops!", message: "Gomen. Could not add the task desu" })
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* OVERLAY FOR AI OPTIMIZATION */}
      <Modal transparent visible={isOptimizing} animationType="fade">
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0, 0, 0, 0.67)",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text
            style={{
              color: "#FFF",
              marginTop: 20,
              fontSize: 18,
              fontWeight: "600",
              letterSpacing: 0.5,
            }}
          >
            brAInwave is thinking...
          </Text>
          <Text style={{ color: "rgba(255, 255, 255, 0.6)", marginTop: 8 }}>
            Optimizing your peak productivity hours
          </Text>
        </View>
      </Modal>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Study planner</Text>
            <Text style={styles.headerSubtitle}>
              AI-optimized Planner for your success
            </Text>
          </View>
        </View>

        {/* AI Insights Banner */}
        <View style={styles.insightContainer}>
          <View
            style={[
              styles.insightCard,
              { borderColor: theme.colors.primary + "40", borderWidth: 1 },
            ]}
          >
            <View
              style={[
                styles.insightIcon,
                { backgroundColor: theme.colors.primary },
              ]}
            >
              <InsightIcon name={aiInsight.icon} color="#FFF" size={22} />
            </View>
            <View style={styles.insightText}>
              <Text style={styles.insightTitle}>{aiInsight.title}</Text>
              <Text style={styles.insightDescription}>{aiInsight.text}</Text>
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

        {/* Study Plan Section */}
        <View style={styles.planContainer}>
          <View style={styles.planHeader}>
            <Text style={styles.planTitle}>
              {planItems.some((item) => item.isTemplate)
                ? "Class Schedule"
                : "Daily Plan"}
            </Text>
            {!isLoading && planItems.length > 0 && (
              <TouchableOpacity
                onPress={handleRegenerate}
                disabled={isOptimizing}
                style={{ paddingVertical: 4, paddingHorizontal: 8 }}
              >
                <Text
                  style={[
                    styles.regenerateButton,
                    { color: theme.colors.primary },
                  ]}
                >
                  {planItems.some((item) => item.isTemplate)
                    ? "Optimize with AI"
                    : "Regenerate"}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {isLoading ? (
            <PlannerSkeleton theme={theme} />
          ) : planItems.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconContainer}>
                <SunIcon size={48} color={theme.colors.warning} />
              </View>
              <Text style={styles.emptyText}>No plan for this day</Text>
            </View>
          ) : (
            planItems.map((item) => {
              // Identify if this task is for the Top Priority Subject
              const isHighPriority =
                user?.studyPreferences?.subjectPriorities?.[0] === item.subject;

              return (
                <View
                  key={item.id}
                  style={[
                    styles.planCard,
                    item.completed && styles.planCardCompleted,
                    styles.planCardMargin,
                    // APPLY RED GLOW: Only if Rank #1 and NOT completed
                    isHighPriority &&
                      !item.completed && {
                        borderColor: "#FF4B4B",
                        borderWidth: 1.5,
                        shadowColor: "#FF0000",
                        shadowOffset: { width: 0, height: 0 },
                        shadowOpacity: 0.3,
                        shadowRadius: 10,
                        elevation: 6,
                      },
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
                        <PlannerIcon
                          color={theme.colors.text.secondary}
                          size={12}
                        />
                        <Text style={styles.timeText}>{item.time}</Text>
                        <View style={styles.durationBadge}>
                          <Text style={styles.durationText}>
                            {item.duration || "60 min"}
                          </Text>
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

                    {/* Subject and High Priority Tag Row */}
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 4,
                      }}
                    >
                      <Text style={styles.subjectText}>{item.subject}</Text>
                      {isHighPriority && (
                        <View
                          style={{
                            backgroundColor: item.completed
                              ? theme.colors.success + "15"
                              : "#FF4B4B15",
                            paddingHorizontal: 6,
                            paddingVertical: 2,
                            borderRadius: 4,
                            borderWidth: 1,
                            borderColor: item.completed
                              ? theme.colors.success + "30"
                              : "#FF4B4B40",
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 10,
                              color: item.completed
                                ? theme.colors.success
                                : "#FF4B4B",
                              fontWeight: "800",
                            }}
                          >
                            {item.completed ? "Priority Met" : "High Priority"}
                          </Text>
                        </View>
                      )}
                    </View>

                    <View
                      style={[
                        styles.difficultyBadge,
                        {
                          backgroundColor: getDifficultyColor(item.difficulty),
                        },
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
              );
            })
          )}
        </View>

        {/* Add Custom Task Trigger */}
        <View style={styles.addTaskContainer}>
          <TouchableOpacity
            style={styles.addTaskButton}
            onPress={() => setModalVisible(true)}
          >
            <Text style={styles.addTaskText}>+ Add custom task</Text>
          </TouchableOpacity>
        </View>

        {/* Modal for adding task */}
        <Modal visible={isModalVisible} animationType="fade" transparent={true}>
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setModalVisible(false)}
          >
            <TouchableWithoutFeedback>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Add Custom Task</Text>
                <Text style={styles.inputLabel}>Task Name</Text>
                <TextInput
                  style={[styles.input, !newTask.task && styles.inputError]}
                  placeholder="e.g., Gym, Grocery Shopping..."
                  placeholderTextColor={theme.colors.text.secondary}
                  value={newTask.task}
                  onChangeText={(text) =>
                    setNewTask({ ...newTask, task: text })
                  }
                />

                <Text style={styles.inputLabel}>Set Time</Text>
                <TouchableOpacity
                  style={styles.timePickerButton}
                  onPress={() => setShowTimePicker(true)}
                >
                  <Ionicons
                    name="time-outline"
                    size={20}
                    color={theme.colors.primary}
                  />
                  <Text style={styles.timePickerText}>{newTask.time}</Text>
                </TouchableOpacity>

                {showTimePicker && (
                  <DateTimePicker
                    value={timeValue}
                    mode="time"
                    is24Hour={false}
                    display="spinner" // Use 'default' for Android/iOS specific style
                    onChange={onTimeChange}
                  />
                )}

                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.cancelButton]}
                    onPress={() => setModalVisible(false)}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.confirmButton]}
                    onPress={handleAddTask}
                  >
                    <Text style={styles.confirmButtonText}>Add Task</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </TouchableOpacity>
        </Modal>
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
      padding: 40,
      backgroundColor: theme.colors.surface,
      borderRadius: 16,
      marginTop: 20,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderStyle: "dashed", // Gives it a "waiting to be filled" look
    },
    emptyIconContainer: {
      marginBottom: 12,
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
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "center",
      alignItems: "center",
    },
    modalContent: {
      width: "85%",
      backgroundColor: theme.colors.surface,
      borderRadius: 20,
      padding: 20,
      elevation: 5,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: "bold",
      color: theme.colors.text.primary,
      marginBottom: 15,
    },
    input: {
      backgroundColor: theme.colors.background,
      color: theme.colors.text.primary,
      borderRadius: 10,
      padding: 12,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    modalButtons: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: 10,
    },
    modalButton: {
      flex: 1,
      padding: 12,
      borderRadius: 10,
      alignItems: "center",
      marginHorizontal: 5,
    },
    confirmButton: {
      backgroundColor: theme.colors.primary,
    },
    cancelButton: {
      backgroundColor: theme.colors.border,
    },
    confirmButtonText: { color: "#fff", fontWeight: "bold" },
    cancelButtonText: { color: theme.colors.text.secondary },
    inputLabel: {
      fontSize: 12,
      color: theme.colors.text.secondary,
      marginBottom: 5,
      marginLeft: 4,
      textTransform: "uppercase",
    },
    timePickerButton: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.colors.background,
      borderRadius: 10,
      padding: 15,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    timePickerText: {
      color: theme.colors.text.primary,
      marginLeft: 10,
      fontSize: 16,
    },
    inputError: {
      borderColor: theme.colors.error + "50",
    },
  });
