// app/(tabs)/Planner.tsx - Study Planner Page
import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
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
  RefreshControl,
} from "react-native";
import { useAuth } from "../contexts/AuthContext";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../contexts/ThemeContext";
import { Theme } from "../types";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { doc, setDoc, onSnapshot } from "firebase/firestore";
import { db as firestore } from "../../firebaseConfig";
import brainwaveApi from "@/api/brAInwaveApi";
import { useAlert } from "../contexts/AlertContext";
import DateTimePicker from "@react-native-community/datetimepicker";
import {
  PlannerIcon,
  SunIcon,
  InsightIcon,
  DeleteIcon,
  ICONS,
} from "@/components/Icons";
import { useContent } from "../hooks/useContent";
import { LocalDB } from "../database/localDb";
import {
  scheduleDailyNotifications,
  sortTasksByTime,
  parseStartDate,
  parseDurationMinutes,
  formatTimeTo24h,
} from "@/utils/notifications";

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
  const { plans, refresh } = useContent();

  //This is for state management
  const [planItems, setPlanItems] = useState<any[]>([]);
  const [isLoading, setLoading] = useState(true);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [weeklyTemplate, setWeeklyTemplate] = useState<Record<string, any[]>>(
    {},
  );

  //Modal States
  const [isModalVisible, setModalVisible] = useState(false);
  const [newTask, setNewTask] = useState({
    task: "",
    time: "12:00",
    duration: "1 hour",
    difficulty: "unset",
  });
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [timeValue, setTimeValue] = useState(new Date());

  //AI Regeneration Options Modal State
  const [isRegenerateModalVisible, setRegenerateModalVisible] = useState(false);
  const [tempIntensity, setTempIntensity] = useState("Balanced"); // "Light", "Balanced", "Intense"
  const [tempSessionLength, setTempSessionLength] = useState("medium"); // "short", "medium", "long"

  //Difficulty Selection State
  const [selectedDifficultyTask, setSelectedDifficultyTask] = useState<
    string | null
  >(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    if (!user?.id) return;
    setLoading(true); // Show skeleton
    setRefreshing(true);
    try {
      if (refresh) await refresh(true);
    } catch (e) {
      console.error("Refresh failed:", e);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (refresh) refresh();
    }, [refresh]),
  );

  const isTaskActive = (item: any) => {
    const start = parseStartDate(item);
    if (!start) return false;
    const now = new Date();
    // Only apply to today's tasks
    if (selectedDay !== weekDays[0].id) return false;

    const durationMins = parseDurationMinutes(item.duration);
    const end = new Date(start.getTime() + durationMins * 60000);
    return now >= start && now <= end;
  };

  const isTaskPast = (item: any) => {
    if (item.completed) return false; // Don't dim if completed, that's handled by completed style
    const start = parseStartDate(item);
    if (!start) return false;
    const now = new Date();
    // Only apply to today's tasks
    if (selectedDay !== weekDays[0].id) return false;

    const durationMins = parseDurationMinutes(item.duration);
    const end = new Date(start.getTime() + durationMins * 60000);
    return now > end;
  };

  const PulseDot = () => {
    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.4,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    }, [pulseAnim]);

    return (
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          backgroundColor: "#4CAF5015",
          paddingHorizontal: 8,
          paddingVertical: 4,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: "#4CAF5030",
        }}
      >
        <Animated.View
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: "#4CAF50",
            opacity: pulseAnim,
          }}
        />
        <Text
          style={{
            color: "#4CAF50",
            fontSize: 10,
            fontWeight: "800",
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
        >
          Active
        </Text>
      </View>
    );
  };

  const handleSetDifficulty = async (difficulty: string) => {
    if (!selectedDifficultyTask || !user?.id) return;

    // Close modal instantly for offline-first responsiveness
    setSelectedDifficultyTask(null);

    // Optimistic UI update
    setPlanItems((items) =>
      items.map((item) =>
        item.id === selectedDifficultyTask ? { ...item, difficulty } : item,
      ),
    );

    const updatedTask = planItems.find(
      (item) => item.id === selectedDifficultyTask,
    );
    const updatedItems = planItems.map((item) =>
      item.id === selectedDifficultyTask ? { ...item, difficulty } : item,
    );

    // Save locally immediately
    const itemsToSave = updatedItems.map((item) => {
      const { isTemplate, ...rest } = item;
      return rest;
    });
    LocalDB.upsertPlan(user.id, selectedDay, itemsToSave);

    // Sync to firestore in background without blocking UI
    try {
      const planRef = doc(firestore, "users", user.id, "plans", selectedDay);
      setDoc(
        planRef,
        {
          items: itemsToSave,
        },
        { merge: true },
      ).catch((e) => {
        console.error("Failed to sync difficulty setting to cloud", e);
      });
    } catch (e) {
      console.error("Local save error", e);
      // Revert optimism if local logic fails
      setPlanItems((items) =>
        items.map((item) =>
          item.id === selectedDifficultyTask
            ? { ...item, difficulty: updatedTask?.difficulty || "unset" }
            : item,
        ),
      );
    }
  };

  const styles = createStyles(theme);

  const normalizeSubject = (value?: string) =>
    value
      ?.toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim() ?? "";

  const aiInsight = useMemo(() => {
    const priorities = user?.studyPreferences?.subjectPriorities || [];
    const topSubjectRaw = priorities[0];
    const topSubject = normalizeSubject(topSubjectRaw);

    const hasHardestSubject =
      !!topSubject &&
      planItems.some((item) => {
        const subject = normalizeSubject(item.subject);
        return subject === topSubject || subject.includes(topSubject);
      });

    if (topSubject && hasHardestSubject) {
      return {
        title: "Priority Focus",
        text: `I've prioritized ${topSubjectRaw} today. Get it done early!`,
        icon: "rocket",
      };
    }

    if (topSubject && !hasHardestSubject) {
      return {
        title: "Light Day?",
        text: `No ${topSubjectRaw} sessions today. Use this extra headspace to review your #2 priority: ${
          priorities[1] || "your notes"
        }.`,
        icon: "leaf",
      };
    }

    return {
      title: "AI Insight",
      text: "You're most productive in the evening. I've planned challenging tasks after 6pm.",
      icon: "bulb",
    };
  }, [planItems, user?.studyPreferences?.subjectPriorities]);

  const weekDays = useMemo(() => {
    const days = [];
    const now = new Date();

    for (let i = 0; i < 5; i++) {
      // change the 5 to alter how many days the scroller shows
      const date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      date.setDate(date.getDate() + i);

      // YYYY-MM-DD in local time to avoid UTC shift
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const id = `${year}-${month}-${day}`;

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
  // this is then mirrored into Firestore by the backend
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

  //Fetches data for day switching and mirrors Firestore into LocalDB
  useEffect(() => {
    if (!user?.id) return;

    setLoading(true);

    const unsubPlan = onSnapshot(
      doc(firestore, "users", user.id, "plans", selectedDay),
      (docSnap) => {
        if (docSnap.exists()) {
          // If there is a generated plan, show that and mirror it into LocalDB
          const items = docSnap.data().items || [];
          const sorted = sortTasksByTime(items);
          setPlanItems(sorted);
          LocalDB.upsertPlan(user.id, selectedDay, sorted);
        } else {
          // FALLBACK: if there is no plan, then just show classes from the template
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
              difficulty: "unset",
              isTemplate: true,
            }),
          );

          setPlanItems(sortTasksByTime(formattedItems));
        }
        setLoading(false);
      },
      (error) => {
        console.error("Plan fetch error: ", error);
        setLoading(false);
      },
    );
    return () => unsubPlan();
  }, [user?.id, selectedDay, weeklyTemplate]);

  // Offline fallback: if we don't have a Firestore plan yet, try LocalDB via useContent
  useEffect(() => {
    if (!user?.id) return;
    if (planItems.length > 0) return;

    const localPlan = plans.find(
      (p) => p.date === selectedDay || p.id === selectedDay,
    );

    if (localPlan?.tasks?.length) {
      setPlanItems(sortTasksByTime(localPlan.tasks));
      setLoading(false);
      return;
    }

    // If no cached plan, fall back to timetable template
    const dateObj = new Date(selectedDay);
    const dayName = dateObj
      .toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" })
      .toLowerCase();

    const templateClasses = weeklyTemplate?.[dayName] || [];

    if (templateClasses.length) {
      const formattedItems = templateClasses.map((cls: any, index: number) => ({
        id: `temp-offline-${index}`,
        time: cls.time,
        subject: cls.subject,
        task: "Class Lecture",
        duration: "1 hour",
        completed: false,
        difficulty: "unset",
        isTemplate: true,
      }));

      setPlanItems(sortTasksByTime(formattedItems));
      setLoading(false);
    }
  }, [user?.id, selectedDay, plans, weeklyTemplate, planItems.length]);

  // Schedule notifications when plan items change for today
  useEffect(() => {
    if (
      !user?.id ||
      !planItems.length ||
      !user?.studyPreferences?.notifications?.studyReminders
    )
      return;

    const todayId = weekDays[0].id;
    if (selectedDay === todayId) {
      const leadMinutes = user?.studyPreferences.notificationLeadMinutes ?? 10;
      scheduleDailyNotifications(planItems, leadMinutes);
    }
  }, [
    planItems,
    selectedDay,
    weekDays,
    user?.id,
    user?.studyPreferences?.notifications?.studyReminders,
    user?.studyPreferences?.notificationLeadMinutes,
  ]);

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "easy":
        return theme.colors.success + "30";
      case "medium":
        return theme.colors.warning + "30";
      case "hard":
        return theme.colors.error + "30";
      case "unset":
        return "transparent";
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
      case "unset":
        return theme.colors.text.secondary;
      default:
        return theme.colors.text.secondary;
    }
  };

  const confirmRegeneration = async () => {
    if (!user?.id) return;

    setRegenerateModalVisible(false);
    setIsOptimizing(true);

    try {
      // Map intensity to a 'mode'
      let overrideMode = "stay_consistent";
      // Ensure the string values match Python backend ENUM assumptions if any,
      // but otherwise the backend is robust enough to handle the mapping provided
      if (tempIntensity === "Light") overrideMode = "catch_up";
      if (tempIntensity === "Intense") overrideMode = "exam_prep";

      const overridenPreferences = {
        ...user.studyPreferences,
        mode: overrideMode,
        preferredSessionLength: tempSessionLength,
      };

      const response = await brainwaveApi.generateDailyPlan(
        user.id,
        selectedDay,
        overridenPreferences,
        [], // <-- custom tasks btw
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
        message:
          "We couldn't connect to the server. Please check your internet connection and try again",
        iconPath: ICONS.ERROR,
        iconColor: "#F44336",
        confirmText: "Retry",
        showCancel: true,
        onConfirm: confirmRegeneration,
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
        hour12: false,
      });
      setNewTask({ ...newTask, time: formattedTime });
    }
  };

  const handleAddTask = async () => {
    if (!user?.id) return;

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
      duration: newTask.duration.trim() || "1 hour",
      completed: false,
      difficulty: newTask.difficulty || "unset",
      isCustom: true,
    };

    const taskDate = parseStartDate(newTaskItem);
    const todayId = weekDays[0].id;

    if (selectedDay === todayId && !editingTaskId) {
      if (taskDate && taskDate < new Date()) {
        showAlert({
          title: "Back to the Future ahh",
          message:
            "You can't add a task for a time that has already passed bromine 😭✌️!",
        });
        return;
      }
    }

    let updatedItems;
    if (editingTaskId) {
      updatedItems = planItems.map((item) =>
        item.id === editingTaskId
          ? {
              ...item,
              task: newTask.task,
              time: newTask.time,
              duration: newTask.duration,
              difficulty: newTask.difficulty,
            }
          : item,
      );
    } else {
      const currentItems = planItems.filter((item) => !item.isTemplate);
      updatedItems = [...currentItems, newTaskItem];
    }

    const sortedItems = sortTasksByTime(updatedItems);

    // Close modal instantly and clear state
    setNewTask({
      task: "",
      time: "12:00",
      duration: "1 hour",
      difficulty: "unset",
    });
    setEditingTaskId(null);
    setModalVisible(false);

    // Filter out template properties before saving
    const itemsToSave = sortedItems.map((item: any) => {
      const { isTemplate, ...rest } = item;
      return rest;
    });

    // Optimistic Update
    setPlanItems(sortedItems);
    LocalDB.upsertPlan(user.id, selectedDay, itemsToSave);

    // Sync to Firestore
    try {
      const planRef = doc(firestore, "users", user.id, "plans", selectedDay);
      await setDoc(
        planRef,
        {
          items: itemsToSave,
        },
        { merge: true },
      );
    } catch (e) {
      console.error("Failed to add task to cloud, will retry later", e);
    }
  };

  const handleDeleteTask = async (taskId: string | number) => {
    if (!user?.id) return;

    showAlert({
      title: "Delete Task?",
      message:
        "Are you sure you want to remove this task from your plan? THIS ACTION IS PERMANENT!",
      showCancel: true,
      confirmText: "Delete",
      cancelText: "Keep it",
      onConfirm: async () => {
        // Optimistic UI update
        const updatedItems = planItems.filter(
          (item) => item.id.toString() !== taskId.toString(),
        );
        setPlanItems(updatedItems);
        LocalDB.upsertPlan(user.id, selectedDay, updatedItems);

        try {
          // 1. Delete from Firestore
          const planRef = doc(
            firestore,
            "users",
            user.id,
            "plans",
            selectedDay,
          );
          setDoc(planRef, { items: updatedItems }, { merge: true });

          // 2. Delete from Backend
          await brainwaveApi.deleteTask(user.id, selectedDay, taskId);
        } catch (e) {
          console.error("Error deleting task:", e);
          // If it fails, the next fetch will restore it, or we could revert here
        }
      },
    });
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
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Study planner</Text>
            <Text style={styles.headerSubtitle}>
              AI-optimized planner for your success
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
                onPress={() => setRegenerateModalVisible(true)}
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
              const isHighPriority =
                user?.studyPreferences?.subjectPriorities?.[0] === item.subject;
              return (
                <View
                  key={item.id}
                  style={[
                    styles.planCard,
                    item.completed && styles.planCardCompleted,
                    isTaskPast(item) && { opacity: 0.4 },
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
                    style={styles.planContent}
                    onPress={() => {
                      if (item.isTemplate) return;
                      setEditingTaskId(item.id);
                      setNewTask({
                        task: item.task,
                        time: item.time,
                        duration: item.duration || "1 hour",
                        difficulty: item.difficulty || "unset",
                      });
                      // Parse time for the picker
                      const start = parseStartDate(item);
                      if (start) setTimeValue(start);
                      setModalVisible(true);
                    }}
                  >
                    <View style={styles.planTimeContainer}>
                      <View style={styles.timeRow}>
                        <PlannerIcon
                          color={theme.colors.text.secondary}
                          size={12}
                        />
                        <Text style={styles.timeText}>
                          {formatTimeTo24h(item.time)}
                        </Text>
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

                    {item.isTemplate ? null : (
                      <View
                        style={[
                          styles.difficultyBadge,
                          {
                            backgroundColor: getDifficultyColor(
                              item.difficulty,
                            ),
                            ...(item.difficulty === "unset"
                              ? {
                                  borderWidth: 1,
                                  borderColor: theme.colors.border,
                                  borderStyle: "dashed",
                                }
                              : {}),
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.difficultyText,
                            { color: getDifficultyTextColor(item.difficulty) },
                          ]}
                        >
                          {item.difficulty === "unset"
                            ? "Tap to set difficulty"
                            : item.difficulty}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  {/* Actions Column on the Right */}
                  <View style={styles.taskActions}>
                    {isTaskActive(item) ? (
                      <PulseDot />
                    ) : (
                      <View
                        style={[
                          styles.actionButton,
                          item.completed && {
                            backgroundColor: theme.colors.primary + "20",
                          },
                        ]}
                      >
                        {item.completed && (
                          <Ionicons
                            name="checkmark-circle"
                            size={22}
                            color={theme.colors.primary}
                          />
                        )}
                      </View>
                    )}

                    <TouchableOpacity
                      onPress={() => handleDeleteTask(item.id)}
                      style={[styles.actionButton, { marginTop: 8 }]}
                    >
                      <DeleteIcon
                        size={20}
                        color={theme.colors.error || "#FF4B4B"}
                      />
                    </TouchableOpacity>
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
            onPress={() => {
              setEditingTaskId(null);
              setNewTask({
                task: "",
                time: "12:00",
                duration: "1 hour",
                difficulty: "unset",
              });
              setModalVisible(true);
            }}
          >
            <Text style={styles.addTaskText}>+ Add custom task</Text>
          </TouchableOpacity>
        </View>

        {/* Modal for adding task */}
        <Modal visible={isModalVisible} animationType="fade" transparent={true}>
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => {
              setModalVisible(false);
              setEditingTaskId(null);
            }}
          >
            <TouchableWithoutFeedback>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>
                  {editingTaskId ? "Edit Task" : "Add Custom Task"}
                </Text>
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

                <Text style={styles.inputLabel}>Duration</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ width: "100%", alignSelf: "stretch" }}
                  contentContainerStyle={{
                    gap: 10,
                    marginBottom: 15,
                    flexDirection: "row",
                    flexWrap: "wrap",
                  }}
                >
                  {["30 mins", "1 hour", "1.5 hours", "2 hours", "3 hours"].map(
                    (dur) => (
                      <TouchableOpacity
                        key={dur}
                        style={[
                          styles.difficultyOption,
                          {
                            paddingHorizontal: 16,
                            paddingVertical: 10,
                            backgroundColor:
                              newTask.duration === dur
                                ? theme.colors.primary + "20"
                                : theme.colors.background,
                            borderColor:
                              newTask.duration === dur
                                ? theme.colors.primary
                                : theme.colors.border,
                            borderWidth: 1,
                          },
                        ]}
                        onPress={() =>
                          setNewTask({ ...newTask, duration: dur })
                        }
                      >
                        <Text
                          style={[
                            styles.difficultyOptionText,
                            {
                              fontSize: 14,
                              color:
                                newTask.duration === dur
                                  ? theme.colors.primary
                                  : theme.colors.text.secondary,
                            },
                          ]}
                        >
                          {dur}
                        </Text>
                      </TouchableOpacity>
                    ),
                  )}
                </ScrollView>

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
                    is24Hour={true}
                    display="spinner" // Use 'default' for Android/iOS specific style
                    onChange={onTimeChange}
                  />
                )}

                <Text style={[styles.inputLabel, { marginTop: 15 }]}>
                  Difficulty
                </Text>
                <View
                  style={{
                    flexDirection: "row",
                    gap: 10,
                    width: "100%",
                    marginBottom: 15,
                  }}
                >
                  {["easy", "medium", "hard"].map((lvl) => (
                    <TouchableOpacity
                      key={lvl}
                      style={[
                        styles.difficultyOption,
                        {
                          flex: 1,
                          paddingVertical: 10,
                          backgroundColor:
                            newTask.difficulty === lvl
                              ? getDifficultyColor(lvl)
                              : theme.colors.background,
                          borderColor: getDifficultyColor(lvl),
                          borderWidth: 1,
                        },
                      ]}
                      onPress={() =>
                        setNewTask({ ...newTask, difficulty: lvl })
                      }
                    >
                      <Text
                        style={[
                          styles.difficultyOptionText,
                          {
                            fontSize: 14,
                            color:
                              newTask.difficulty === lvl
                                ? getDifficultyTextColor(lvl)
                                : theme.colors.text.secondary,
                          },
                        ]}
                      >
                        {lvl.charAt(0).toUpperCase() + lvl.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.cancelButton]}
                    onPress={() => {
                      setModalVisible(false);
                      setEditingTaskId(null);
                    }}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.confirmButton]}
                    onPress={handleAddTask}
                  >
                    <Text style={styles.confirmButtonText}>
                      {editingTaskId ? "Update" : "Add Task"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </TouchableOpacity>
        </Modal>
        {/* Difficulty Selection Modal */}
        <Modal
          visible={selectedDifficultyTask !== null}
          animationType="fade"
          transparent={true}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setSelectedDifficultyTask(null)}
          >
            <TouchableWithoutFeedback>
              <View style={[styles.modalContent, { paddingBottom: 20 }]}>
                <Text style={styles.modalTitle}>Set Task Difficulty</Text>

                <View style={{ width: "100%", gap: 12, marginTop: 10 }}>
                  <TouchableOpacity
                    style={[
                      styles.difficultyOption,
                      { backgroundColor: theme.colors.success + "20" },
                    ]}
                    onPress={() => handleSetDifficulty("easy")}
                  >
                    <Text
                      style={[
                        styles.difficultyOptionText,
                        { color: theme.colors.success },
                      ]}
                    >
                      Easy
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.difficultyOption,
                      { backgroundColor: theme.colors.warning + "20" },
                    ]}
                    onPress={() => handleSetDifficulty("medium")}
                  >
                    <Text
                      style={[
                        styles.difficultyOptionText,
                        { color: theme.colors.warning },
                      ]}
                    >
                      Medium
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.difficultyOption,
                      { backgroundColor: theme.colors.error + "20" },
                    ]}
                    onPress={() => handleSetDifficulty("hard")}
                  >
                    <Text
                      style={[
                        styles.difficultyOptionText,
                        { color: theme.colors.error },
                      ]}
                    >
                      Hard
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </TouchableOpacity>
        </Modal>
        {/* AI Options Modal */}
        <Modal
          visible={isRegenerateModalVisible}
          animationType="slide"
          transparent={true}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setRegenerateModalVisible(false)}
          >
            <TouchableWithoutFeedback>
              <View style={[styles.modalContent, { paddingBottom: 30 }]}>
                <Text style={styles.modalTitle}>AI Optimization</Text>
                <Text
                  style={{
                    color: theme.colors.text.secondary,
                    textAlign: "center",
                    marginBottom: 20,
                  }}
                >
                  How should brAInwave plan your day?
                </Text>

                <Text style={styles.inputLabel}>Intensity</Text>
                <View
                  style={[
                    styles.presetRow,
                    {
                      justifyContent: "space-between",
                      width: "100%",
                      marginBottom: 15,
                    },
                  ]}
                >
                  {["Light", "Balanced", "Intense"].map((opt) => (
                    <TouchableOpacity
                      key={opt}
                      style={[
                        styles.intensityOption,
                        {
                          borderColor:
                            tempIntensity === opt
                              ? theme.colors.primary
                              : theme.colors.border,
                        },
                        tempIntensity === opt && {
                          backgroundColor: theme.colors.primary + "15",
                        },
                      ]}
                      onPress={() => setTempIntensity(opt)}
                    >
                      <Text
                        style={{
                          color:
                            tempIntensity === opt
                              ? theme.colors.primary
                              : theme.colors.text.secondary,
                          fontWeight: tempIntensity === opt ? "600" : "400",
                        }}
                      >
                        {opt}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.inputLabel}>Session Length</Text>
                <View
                  style={[
                    styles.presetRow,
                    { justifyContent: "space-between", width: "100%" },
                  ]}
                >
                  {[
                    { label: "Short", val: "short" },
                    { label: "Medium", val: "medium" },
                    { label: "Long", val: "long" },
                  ].map((opt) => (
                    <TouchableOpacity
                      key={opt.val}
                      style={[
                        styles.intensityOption,
                        {
                          borderColor:
                            tempSessionLength === opt.val
                              ? theme.colors.primary
                              : theme.colors.border,
                        },
                        tempSessionLength === opt.val && {
                          backgroundColor: theme.colors.primary + "15",
                        },
                      ]}
                      onPress={() => setTempSessionLength(opt.val)}
                    >
                      <Text
                        style={{
                          color:
                            tempSessionLength === opt.val
                              ? theme.colors.primary
                              : theme.colors.text.secondary,
                          fontWeight:
                            tempSessionLength === opt.val ? "600" : "400",
                        }}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={[styles.modalButtons, { marginTop: 30 }]}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.cancelButton]}
                    onPress={() => setRegenerateModalVisible(false)}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.confirmButton]}
                    onPress={confirmRegeneration}
                  >
                    <Text style={styles.confirmButtonText}>Generate</Text>
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
    intensityOption: {
      flex: 1,
      borderWidth: 1,
      borderRadius: 10,
      paddingVertical: 10,
      alignItems: "center",
      marginHorizontal: 4,
    },
    difficultyOption: {
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    difficultyOptionText: {
      fontFamily: theme.fonts.bold,
      fontSize: 16,
    },
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
    taskActions: {
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
      gap: 8,
    },
    actionButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: "center",
      alignItems: "center",
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
    presetRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      width: "100%",
      marginBottom: 15,
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
