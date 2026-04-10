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
import { useRouter } from "expo-router";
import { useAuth } from "../contexts/AuthContext";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../contexts/ThemeContext";
import { Theme } from "../types";
import { useFocusEffect } from "@react-navigation/native";
import brainwaveApi from "@/api/brAInwaveApi";
import { useAlert } from "../contexts/AlertContext";
import { useDatePicker } from "../contexts/DatePickerContext";
import {
  PlannerIcon,
  SunIcon,
  InsightIcon,
  DeleteIcon,
  TimerIcon,
  ICONS,
} from "@/components/Icons";
import BrainwaveLoader from "@/components/BrainwaveLoader";
import { useContent } from "../hooks/useContent";
import { LocalDB } from "../database/localDb";
import {
  ensureBatteryOptimizationExemption,
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
  const { showPicker } = useDatePicker();
  const router = useRouter();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const { plans, timetables, materials, assignments, refresh } = useContent();

  const [planItems, setPlanItems] = useState<any[]>([]);
  const [isLoading, setLoading] = useState(true);
  const [isSavingTask, setIsSavingTask] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);

  // Derive weekly template from the most recently uploaded timetable in LocalDB
  const weeklyTemplate = useMemo(() => {
    if (!timetables || timetables.length === 0) return {};
    return timetables[0]?.structuredData || {};
  }, [timetables]);

  // Modal states
  const [isModalVisible, setModalVisible] = useState(false);
  const [newTask, setNewTask] = useState({
    task: "",
    time: "12:00",
    duration: "1 hour",
    difficulty: "unset",
    subject: "Personal",
    deadline: "",
  });

  // AI Regeneration modal state
  const [isRegenerateModalVisible, setRegenerateModalVisible] = useState(false);
  const [tempIntensity, setTempIntensity] = useState("Balanced");
  const [tempSessionLength, setTempSessionLength] = useState("medium");
  const [aiUserNote, setAiUserNote] = useState("");

  // When opening the modal, pre-fill with saved preferences
  useEffect(() => {
    if (isRegenerateModalVisible && user?.studyPreferences) {
      const modeMap = {
        catch_up: "Light",
        stay_consistent: "Balanced",
        exam_prep: "Intense",
      };
      setTempIntensity(
        modeMap[user.studyPreferences.mode as keyof typeof modeMap] ||
          "Balanced",
      );
      setTempSessionLength(
        user.studyPreferences.preferredSessionLength || "medium",
      );
      setAiUserNote(""); // clear previous note
    }
  }, [isRegenerateModalVisible, user?.studyPreferences]);

  const [selectedDifficultyTask, setSelectedDifficultyTask] = useState<
    string | null
  >(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const BUILT_IN_TAGS = useMemo(() => ["Personal", "Test/Quiz", "Revision", "Exam Prep"], []);

  const availableTags = useMemo(() => {
    const subjectSet = new Set<string>();
    if (weeklyTemplate) {
      Object.values(weeklyTemplate).forEach((dayItems: any) => {
        if (Array.isArray(dayItems)) {
          dayItems.forEach((item: any) => {
            const name = item.subject || item.course || item.name;
            if (name) {
              const cleaned = name
                .replace(
                  /\b(LAB|LECTURE|LEC|TUTORIAL|TUT|PRACTICAL|PRAC)\b/gi,
                  "",
                )
                .trim();
              if (cleaned) subjectSet.add(cleaned);
            }
          });
        }
      });
    }
    planItems.forEach((item: any) => {
      if (item.subject && !BUILT_IN_TAGS.includes(item.subject)) {
        subjectSet.add(item.subject);
      }
    });
    return [...BUILT_IN_TAGS, ...Array.from(subjectSet)];
  }, [BUILT_IN_TAGS, weeklyTemplate, planItems]);

  const computePriorityScore = (task: any) => {
    const difficultyMap: Record<string, number> = {
      easy: 20,
      medium: 50,
      hard: 80,
      unset: 35,
    };
    const diffScore = difficultyMap[task.difficulty] ?? 35;
    if (!task.deadline) return diffScore * 0.4;
    const daysLeft = Math.max(
      0,
      (new Date(task.deadline).getTime() - Date.now()) / 86400000,
    );
    const urgencyScore = Math.min(100, Math.max(0, 100 - daysLeft * 15));
    return urgencyScore * 0.6 + diffScore * 0.4;
  };

  const getPriorityBadge = (task: any) => {
    if (!task.deadline) return null;
    const score = computePriorityScore(task);
    if (score >= 70)
      return { label: "Urgent", color: "#FF4B4B", bg: "#FF4B4B15" };
    if (score >= 40)
      return { label: "Moderate", color: "#FFA726", bg: "#FFA72615" };
    return { label: "Low", color: "#4CAF50", bg: "#4CAF5015" };
  };

  const onRefresh = async () => {
    if (!user?.id) return;
    setLoading(true);
    setRefreshing(true);
    try {
      if (refresh) await refresh(true);
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
    if (selectedDay !== weekDays[0].id) return false;
    const durationMins = parseDurationMinutes(item.duration);
    const end = new Date(start.getTime() + durationMins * 60000);
    return new Date() >= start && new Date() <= end;
  };

  const isTaskPast = (item: any) => {
    if (item.completed) return false;
    const start = parseStartDate(item);
    if (!start) return false;
    if (selectedDay !== weekDays[0].id) return false;
    const durationMins = parseDurationMinutes(item.duration);
    const end = new Date(start.getTime() + durationMins * 60000);
    return new Date() > end;
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

  // Save plan locally as dirty then push to backend
  const savePlan = useCallback(
    async (items: any[], date: string) => {
      if (!user?.id) return;
      const clean = items.map(({ isTemplate, ...rest }) => rest);
      await LocalDB.upsertPlan(user.id, date, clean, true);
      try {
        await brainwaveApi.saveDailyPlan(user.id, date, clean);
        LocalDB.markPlanSynced(user.id, date);
      } catch {
        // Stays dirty - syncs on reconnect
      }
    },
    [user?.id],
  );

  const handleSetDifficulty = async (difficulty: string) => {
    if (!selectedDifficultyTask || !user?.id) return;
    setSelectedDifficultyTask(null);

    const updatedItems = planItems.map((item) =>
      item.id === selectedDifficultyTask ? { ...item, difficulty } : item,
    );
    setPlanItems(updatedItems);
    await savePlan(updatedItems, selectedDay);
  };

  const styles = createStyles(theme);

  const normalizeSubject = (value?: string) =>
    value
      ?.toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim() ?? "";

  const aiInsight = useMemo(() => {
    if (planItems.length === 0) {
      return {
        title: "Blank Slate",
        text: "No tasks or classes today! Enjoy the break or read ahead.",
        icon: "leaf",
      };
    }

    const priorities = user?.studyPreferences?.subjectPriorities || [];

    // Find the highest priority subject that IS actually on the schedule
    let highestScheduledPriorityRaw = null;
    let highestScheduledPriorityIndex = -1;

    for (let i = 0; i < priorities.length; i++) {
      const topSubjectNorm = normalizeSubject(priorities[i]);
      const isOnSchedule =
        !!topSubjectNorm &&
        planItems.some((item) => {
          const itemSubNorm = normalizeSubject(item.subject);
          return (
            itemSubNorm === topSubjectNorm ||
            itemSubNorm.includes(topSubjectNorm)
          );
        });

      if (isOnSchedule) {
        highestScheduledPriorityRaw = priorities[i];
        highestScheduledPriorityIndex = i;
        break;
      }
    }

    if (highestScheduledPriorityIndex === 0) {
      return {
        title: "Priority Focus",
        text: `${highestScheduledPriorityRaw} has top priority today. Get it done early!`,
        icon: "rocket",
      };
    } else if (highestScheduledPriorityIndex > 0) {
      return {
        title: "Focus Shift",
        text: `No ${priorities[0]} today. Your highest scheduled priority is ${highestScheduledPriorityRaw}.`,
        icon: "bulb",
      };
    } else {
      // None of the priority subjects are on the schedule today
      const firstSubject = planItems.find(
        (item) => item.subject && item.subject.toLowerCase() !== "break",
      )?.subject;

      if (firstSubject) {
        return {
          title: "Light Day?",
          text: `Use this extra headspace to review your notes on ${firstSubject} or relax!`,
          icon: "leaf",
        };
      } else {
        return {
          title: "Blank Slate",
          text: "No main classes today! Enjoy the break or read ahead.",
          icon: "leaf",
        };
      }
    }
  }, [planItems, user?.studyPreferences?.subjectPriorities]);

  const weekDays = useMemo(() => {
    const days = [];
    const now = new Date();
    for (let i = 0; i < 5; i++) {
      const date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      date.setDate(date.getDate() + i);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const id = `${year}-${month}-${day}`;
      let label =
        i === 0
          ? "Today"
          : i === 1
            ? "Tomorrow"
            : date.toLocaleDateString("en-US", { weekday: "short" });
      const dayDate = date.toLocaleDateString("en-US", {
        day: "numeric",
        month: i < 5 ? "short" : undefined,
      });
      days.push({ id, label, date: dayDate });
    }
    return days;
  }, []);

  const [selectedDay, setSelectedDay] = useState(weekDays[0].id);

  // Load plan when selected day or plans array changes
  useEffect(() => {
    if (!user?.id) return;
    setLoading(true);

    const existingPlan = plans.find((p) => p.date === selectedDay);

    if (existingPlan?.tasks?.length > 0) {
      setPlanItems(sortTasksByTime(existingPlan.tasks));
    } else {
      // Fallback to timetable classes for this day
      const dateObj = new Date(selectedDay + "T00:00:00");
      const dayName = dateObj
        .toLocaleDateString("en-US", { weekday: "long" })
        .toLowerCase();
      const templateClasses = weeklyTemplate?.[dayName] || [];
      const formattedItems = templateClasses.map((cls: any, index: number) => ({
        id: `temp-${index}`,
        time: cls.time,
        subject: cls.subject || cls.course || cls.name || "Class",
        task: "Class Lecture",
        duration: "1 hour",
        completed: false,
        difficulty: cls.difficulty || "unset",
        isTemplate: true,
      }));

      // Inject assignments due on this day
      const dueAssignments =
        assignments?.filter((a: any) => a.due_date === selectedDay) || [];
      const assignmentItems = dueAssignments.map((ass: any) => ({
        id: `ass-${ass.id}`,
        time: "11:59 PM",
        subject: ass.subject || "Assignment",
        task: `Deadline: ${ass.title}`,
        duration: "",
        completed: false,
        difficulty:
          ass.priority?.toLowerCase() === "high"
            ? "hard"
            : ass.priority?.toLowerCase() === "medium"
              ? "medium"
              : "easy",
        isTemplate: true,
      }));

      setPlanItems(sortTasksByTime([...formattedItems, ...assignmentItems]));
    }

    setLoading(false);
  }, [selectedDay, plans, weeklyTemplate, assignments, user?.id]);

  useEffect(() => {
    if (!user?.id || !planItems.length) return;
    if (selectedDay !== weekDays[0].id) return;
    if (!user?.studyPreferences?.notifications?.studyReminders) return;
    const leadMinutes = user?.studyPreferences?.notificationLeadMinutes ?? 10;
    (async () => {
      await ensureBatteryOptimizationExemption();
      await scheduleDailyNotifications(planItems, leadMinutes);
    })();
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
      default:
        return theme.colors.text.secondary;
    }
  };

  const getIntensityColor = (intensity: string) => {
    switch (intensity) {
      case "Light":
        return theme.colors.success;
      case "Balanced":
        return theme.colors.warning;
      case "Intense":
        return theme.colors.error;
      default:
        return theme.colors.primary;
    }
  };

  const getSessionLengthColor = (length: string) => {
    switch (length) {
      case "short":
        return theme.colors.success;
      case "medium":
        return theme.colors.warning;
      case "long":
        return theme.colors.error;
      default:
        return theme.colors.primary;
    }
  };

  const confirmRegeneration = async () => {
    if (!user?.id) return;
    setRegenerateModalVisible(false);
    setIsOptimizing(true);

    try {
      let overrideMode = user.studyPreferences.mode || "stay_consistent";
      if (tempIntensity === "Light") overrideMode = "catch_up";
      if (tempIntensity === "Intense") overrideMode = "exam_prep";

      const overridenPreferences = {
        ...user.studyPreferences,
        mode: overrideMode,
        preferredSessionLength: tempSessionLength,
      };

      if (__DEV__) console.log("Sending preferences:", JSON.stringify(overridenPreferences));

      const response = await brainwaveApi.generateDailyPlan(
        user.id,
        selectedDay,
        overridenPreferences,
        [],
        aiUserNote.trim() || undefined,
      );

      if (response.success) {
        // Save newly generated plan locally + to backend
        await savePlan(response.items, selectedDay);
        // Refresh so plans array updates and the useEffect re-derives planItems
        await refresh?.(false);
        showAlert({
          title: "Schedule Optimized",
          message: "brAInwave has successfully updated your schedule!",
          iconPath: ICONS.SUCCESS,
          confirmText: "Ok",
        });
      }
    } catch (error: any) {
      showAlert({
        title: "Optimization Failed",
        message:
          "We couldn't connect to the server. Please check your internet connection and try again",
        iconPath: ICONS.ERROR,
        iconColor: theme.colors.error,
        confirmText: "Retry",
        showCancel: true,
        onConfirm: confirmRegeneration,
      });
      console.error("422 detail:", JSON.stringify(error.response?.data));
    } finally {
      setIsOptimizing(false);
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

    setIsSavingTask(true);

    const existingPlan = plans.find((p) => p.date === selectedDay);
    const baseItems = existingPlan?.tasks || planItems;

    const newTaskItem: any = {
      id: editingTaskId || Date.now().toString(),
      task: newTask.task,
      time: newTask.time,
      subject: newTask.subject || "Personal",
      duration: newTask.duration.trim() || "1 hour",
      completed: false,
      difficulty: newTask.difficulty || "unset",
      isCustom: !editingTaskId,
    };
    if (newTask.deadline) newTaskItem.deadline = newTask.deadline;

    const updatedItems = editingTaskId
      ? baseItems.map((it: any) => (it.id === editingTaskId ? newTaskItem : it))
      : [...baseItems, newTaskItem];

    const sortedItems = sortTasksByTime(updatedItems);
    setPlanItems(sortedItems);

    try {
      await savePlan(sortedItems, selectedDay);
      if (!editingTaskId) {
        showAlert({
          title: "Added!",
          message: `${newTask.task} added to your ${selectedDay} plan`,
          iconPath: ICONS.SUCCESS,
        });
      }
    } catch (e) {
      showAlert({
        title: "Save Error",
        message: "Failed to save your changes.",
      });
      console.error("Error saving plan:", e);
    } finally {
      setIsSavingTask(false);
      setNewTask({
        task: "",
        time: "12:00",
        duration: "1 hour",
        difficulty: "unset",
        subject: "Personal",
        deadline: "",
      });
      setEditingTaskId(null);
      setIsSavingTask(false);
      setModalVisible(false);
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
      iconPath: ICONS.ERROR,
      iconColor: theme.colors.error,
      onConfirm: async () => {
        const updatedItems = planItems.filter(
          (item) => item.id.toString() !== taskId.toString(),
        );
        setPlanItems(updatedItems);

        await savePlan(updatedItems, selectedDay);

        try {
          await brainwaveApi.deleteTask(user.id, selectedDay, taskId);
        } catch (e) {
          console.error("Error deleting task from backend:", e);
        }
      },
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <Modal transparent visible={isOptimizing} animationType="fade">
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0, 0, 0, 0.75)",
            justifyContent: "center",
            alignItems: "center",
            paddingHorizontal: 40,
          }}
        >
          <View
            style={{
              backgroundColor: theme.colors.background,
              borderRadius: 24,
              padding: 32,
              alignItems: "center",
              width: "100%",
              borderWidth: 1,
              borderColor: theme.colors.border,
            }}
          >
            <BrainwaveLoader theme={theme} />
            <Text
              style={{
                color: theme.colors.text.primary,
                marginTop: 24,
                fontSize: 18,
                fontWeight: "600",
                letterSpacing: 0.3,
                textAlign: "center",
              }}
            >
              brAInwave is thinking...
            </Text>
            <Text
              style={{
                color: theme.colors.text.secondary,
                marginTop: 8,
                fontSize: 13,
                textAlign: "center",
                lineHeight: 18,
              }}
            >
              Optimizing your peak productivity hours
            </Text>
          </View>
        </View>
      </Modal>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
          />
        }
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Study planner</Text>
            <Text style={styles.headerSubtitle}>
              AI-optimized planner for your success
            </Text>
          </View>
        </View>

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

        {materials.length === 0 && (
          <TouchableOpacity
            style={[
              styles.nudgeCard,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.primary + "40",
              },
            ]}
            onPress={() => router.push("/library")}
            activeOpacity={0.8}
          >
            <Text style={styles.nudgeTitle}>Make your plan smarter</Text>
            <Text
              style={[styles.nudgeText, { color: theme.colors.text.secondary }]}
            >
              Upload a syllabus and brAInwave will plan around your actual
              course content
            </Text>
          </TouchableOpacity>
        )}

        <View style={styles.planContainer}>
          <View style={styles.planHeader}>
            <View
              style={{
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                marginRight: 8,
              }}
            >
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                style={styles.planTitle}
              >
                {planItems.some((item) => item.isTemplate)
                  ? "Class Schedule"
                  : "Daily Plan"}
              </Text>
              {user?.studyPreferences?.mode && (
                <View
                  style={{
                    backgroundColor: theme.colors.primary + "15",
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: theme.colors.primary + "30",
                    flexShrink: 0,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 10,
                      color: theme.colors.primary,
                      fontWeight: "700",
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                    }}
                  >
                    {user.studyPreferences.mode.replace("_", " ")}
                  </Text>
                </View>
              )}
            </View>
            {!isLoading && planItems.length > 0 && (
              <TouchableOpacity
                onPress={() => setRegenerateModalVisible(true)}
                disabled={isOptimizing}
                style={{
                  paddingVertical: 4,
                  paddingHorizontal: 8,
                  flexShrink: 0,
                }}
              >
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
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
              const topPriority =
                user?.studyPreferences?.subjectPriorities?.[0];
              let isHighPriority = false;
              if (topPriority) {
                const topNorm = normalizeSubject(topPriority);
                const itemNorm = normalizeSubject(item.subject);
                isHighPriority =
                  !!topNorm &&
                  (itemNorm === topNorm || itemNorm.includes(topNorm));
              }
              return (
                <View
                  key={item.id}
                  style={[
                    styles.planCard,
                    item.completed && styles.planCardCompleted,
                    isTaskPast(item) && { opacity: 0.4 },
                    styles.planCardMargin,
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
                      setEditingTaskId(item.id);
                      setNewTask({
                        task: item.task,
                        time: item.time,
                        duration: item.duration || "1 hour",
                        difficulty: item.difficulty || "unset",
                        subject: item.subject || "Personal",
                        deadline: item.deadline || "",
                      });
                      if (item.deadline) setModalVisible(true);
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

                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 4,
                        flexWrap: "wrap",
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
                      {(() => {
                        const badge = getPriorityBadge(item);
                        if (!badge || item.completed) return null;
                        return (
                          <View
                            style={{
                              backgroundColor: badge.bg,
                              paddingHorizontal: 6,
                              paddingVertical: 2,
                              borderRadius: 4,
                              borderWidth: 1,
                              borderColor: badge.color + "40",
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 10,
                                color: badge.color,
                                fontWeight: "800",
                              }}
                            >
                              {badge.label}
                            </Text>
                          </View>
                        );
                      })()}
                      {item.deadline && !item.completed && (
                        <Text
                          style={{
                            fontSize: 10,
                            color: theme.colors.text.secondary,
                            fontStyle: "italic",
                          }}
                        >
                          Due{" "}
                          {new Date(item.deadline).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </Text>
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

                  <View style={styles.taskActions}>
                    {isTaskActive(item) && <PulseDot />}
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
                subject: "Personal",
                deadline: "",
              });
              setModalVisible(true);
            }}
          >
            <Text style={styles.addTaskText}>+ Add custom task</Text>
          </TouchableOpacity>
        </View>

        {/* Add/Edit Task Modal */}
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
                  placeholder="e.g., Gym, Study for finals..."
                  placeholderTextColor={theme.colors.text.secondary}
                  value={newTask.task}
                  onChangeText={(text) =>
                    setNewTask({ ...newTask, task: text })
                  }
                />

                <Text style={styles.inputLabel}>Subject</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ width: "100%", alignSelf: "stretch" }}
                  contentContainerStyle={{
                    gap: 8,
                    marginBottom: 15,
                    flexDirection: "row",
                  }}
                >
                  {availableTags.map((tag) => (
                    <TouchableOpacity
                      key={tag}
                      style={[
                        styles.difficultyOption,
                        {
                          paddingHorizontal: 14,
                          paddingVertical: 8,
                          backgroundColor:
                            newTask.subject === tag
                              ? tag === "Exam Prep"
                                ? theme.colors.error + "20"
                                : theme.colors.primary + "20"
                              : theme.colors.background,
                          borderColor:
                            newTask.subject === tag
                              ? tag === "Exam Prep"
                                ? theme.colors.error
                                : theme.colors.primary
                              : theme.colors.border,
                          borderWidth: 1,
                        },
                      ]}
                      onPress={() =>
                        setNewTask({
                          ...newTask,
                          subject: tag,
                          deadline:
                            tag === "Exam Prep" || tag === "Test/Quiz"
                              ? newTask.deadline
                              : "",
                        })
                      }
                    >
                      <Text
                        style={[
                          styles.difficultyOptionText,
                          {
                            fontSize: 13,
                            color:
                              newTask.subject === tag
                                ? tag === "Exam Prep"
                                  ? theme.colors.error
                                  : theme.colors.primary
                                : theme.colors.text.secondary,
                          },
                        ]}
                      >
                        {tag}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

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
                  onPress={() => {
                    const timeArr = newTask.time.split(" ");
                    const [h, m] = timeArr[0].split(":").map(Number);
                    const isPM = timeArr[1] === "PM";
                    const d = new Date();
                    d.setHours(isPM ? (h % 12) + 12 : h % 12, m);

                    showPicker({
                      value: d,
                      mode: "time",
                      title: "Set Task Time",
                      onConfirm: (date) => {
                        const hours = date.getHours();
                        const minutes = date.getMinutes();
                        const ampm = hours >= 12 ? "PM" : "AM";
                        const h12 = hours % 12 || 12;
                        const timeStr = `${h12}:${minutes < 10 ? "0" + minutes : minutes} ${ampm}`;
                        setNewTask({ ...newTask, time: timeStr });
                      },
                    });
                  }}
                >
                  <TimerIcon size={20} color={theme.colors.primary} />
                  <Text style={styles.timePickerText}>{newTask.time}</Text>
                </TouchableOpacity>

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

                {(newTask.subject === "Exam Prep" ||
                  newTask.subject === "Test/Quiz") && (
                  <>
                    <Text style={styles.inputLabel}>
                      {newTask.subject === "Test/Quiz"
                        ? "Test Date"
                        : "Exam Date"}
                    </Text>
                    <TouchableOpacity
                      style={styles.timePickerButton}
                      onPress={() => {
                        showPicker({
                          value: newTask.deadline
                            ? new Date(newTask.deadline)
                            : new Date(),
                          mode: "date",
                          minimumDate: new Date(),
                          onConfirm: (date) => {
                            setNewTask({
                              ...newTask,
                              deadline: date.toISOString().split("T")[0],
                            });
                          },
                        });
                      }}
                    >
                      <TimerIcon size={20} color={theme.colors.primary} />
                      <Text style={styles.timePickerText}>
                        {newTask.deadline
                          ? new Date(newTask.deadline).toLocaleDateString(
                              "en-US",
                              {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              },
                            )
                          : "Tap to set deadline"}
                      </Text>
                      {newTask.deadline ? (
                        <TouchableOpacity
                          onPress={() =>
                            setNewTask({ ...newTask, deadline: "" })
                          }
                          style={{ marginLeft: "auto" }}
                        >
                          <Text
                            style={{ color: theme.colors.error, fontSize: 12 }}
                          >
                            Clear
                          </Text>
                        </TouchableOpacity>
                      ) : null}
                    </TouchableOpacity>
                  </>
                )}

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
                    style={[
                      styles.modalButton,
                      styles.confirmButton,
                      isSavingTask && { opacity: 0.7 },
                    ]}
                    onPress={handleAddTask}
                    disabled={isSavingTask}
                  >
                    {isSavingTask ? (
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <ActivityIndicator size="small" color="#fff" />
                        <Text style={styles.confirmButtonText}>Saving...</Text>
                      </View>
                    ) : (
                      <Text style={styles.confirmButtonText}>
                        {editingTaskId ? "Update" : "Add Task"}
                      </Text>
                    )}
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
                  {[
                    { label: "Easy", val: "easy", color: theme.colors.success },
                    {
                      label: "Medium",
                      val: "medium",
                      color: theme.colors.warning,
                    },
                    { label: "Hard", val: "hard", color: theme.colors.error },
                  ].map((opt) => (
                    <TouchableOpacity
                      key={opt.val}
                      style={[
                        styles.difficultyOption,
                        { backgroundColor: opt.color + "20" },
                      ]}
                      onPress={() => handleSetDifficulty(opt.val)}
                    >
                      <Text
                        style={[
                          styles.difficultyOptionText,
                          { color: opt.color },
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
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
                          borderColor: getIntensityColor(opt),
                          backgroundColor:
                            tempIntensity === opt
                              ? getIntensityColor(opt) + "20"
                              : theme.colors.background,
                          borderWidth: 1,
                        },
                      ]}
                      onPress={() => setTempIntensity(opt)}
                    >
                      <Text
                        style={{
                          color:
                            tempIntensity === opt
                              ? getIntensityColor(opt)
                              : theme.colors.text.secondary,
                          fontWeight: tempIntensity === opt ? "400" : "300",
                          fontSize: 13,
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
                          borderColor: getSessionLengthColor(opt.val),
                          backgroundColor:
                            tempSessionLength === opt.val
                              ? getSessionLengthColor(opt.val) + "20"
                              : theme.colors.background,
                          borderWidth: 1,
                        },
                      ]}
                      onPress={() => setTempSessionLength(opt.val)}
                    >
                      <Text
                        style={{
                          color:
                            tempSessionLength === opt.val
                              ? getSessionLengthColor(opt.val)
                              : theme.colors.text.secondary,
                          fontWeight:
                            tempSessionLength === opt.val ? "700" : "500",
                          fontSize: 13,
                        }}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={[styles.inputLabel, { marginTop: 15 }]}>
                  Instructions (optional)
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    { minHeight: 70, textAlignVertical: "top" },
                    aiUserNote.length >= 200 && {
                      borderColor: theme.colors.error,
                    },
                  ]}
                  placeholder="e.g., Focus more on math..."
                  placeholderTextColor={theme.colors.text.secondary}
                  value={aiUserNote}
                  onChangeText={(text) => {
                    if (text.length >= 200 && aiUserNote.length < 200) {
                      showAlert({
                        title: "Note length limit",
                        message:
                          "The custom AI note is limited to 200 characters.",
                        iconPath: ICONS.ERROR,
                        iconColor: theme.colors.error,
                      });
                    }
                    setAiUserNote(text.slice(0, 200));
                  }}
                  multiline
                  maxLength={200}
                />

                <Text
                  style={{
                    fontSize: 12,
                    fontFamily: theme.fonts.regular,
                    color: theme.colors.text.secondary,
                    textAlign: "center",
                    marginTop: 15,
                    fontStyle: "italic",
                    opacity: 0.7,
                  }}
                >
                  Tip: fine-tune your energy pattern and subject priorities in{" "}
                  <TouchableOpacity onPress={() => router.push("/settings")}>
                    <Text
                      style={{
                        color: theme.colors.primary,
                        fontSize: 12,
                        marginTop: 9.8,
                      }}
                    >
                      Settings
                    </Text>
                  </TouchableOpacity>
                </Text>

                <View style={[styles.modalButtons, { marginTop: 20 }]}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.cancelButton]}
                    onPress={() => {
                      setRegenerateModalVisible(false);
                      setAiUserNote("");
                    }}
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
    difficultyOptionText: { fontFamily: theme.fonts.bold, fontSize: 16 },
    container: { flex: 1, backgroundColor: theme.colors.background },
    scrollView: { flex: 1 },
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
    insightContainer: { padding: theme.spacing.lg },
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
    insightText: { flex: 1 },
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
    weekSelector: { gap: 8, paddingBottom: 8 },
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
    dayButtonActive: { backgroundColor: theme.colors.primary },
    dayLabel: {
      fontSize: 14,
      fontFamily: theme.fonts.medium,
      color: theme.colors.text.primary,
    },
    dayLabelActive: { color: "#f5f5f5" },
    dayDate: {
      fontSize: 12,
      fontFamily: theme.fonts.regular,
      color: theme.colors.text.secondary,
      marginTop: 4,
    },
    dayDateActive: { color: "#f5f5f5", opacity: 0.7 },
    nudgeCard: {
      marginHorizontal: theme.spacing.lg,
      marginBottom: theme.spacing.md,
      padding: theme.spacing.md,
      borderRadius: 14,
      borderWidth: 1,
    },
    nudgeTitle: {
      fontSize: 14,
      fontFamily: theme.fonts.semiBold,
      color: theme.colors.text.primary,
      marginBottom: 4,
    },
    nudgeText: {
      fontSize: 13,
      fontFamily: theme.fonts.regular,
      lineHeight: 18,
    },
    planContainer: { paddingHorizontal: theme.spacing.lg },
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
      borderStyle: "dashed",
    },
    emptyIconContainer: { marginBottom: 12 },
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
    planCardCompleted: { opacity: 0.6 },
    planCardMargin: { marginBottom: theme.spacing.sm },
    checkboxContainer: { paddingTop: 4 },
    planContent: { flex: 1 },
    planTimeContainer: { marginBottom: theme.spacing.xs },
    timeRow: { flexDirection: "row", alignItems: "center", gap: 6 },
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
    taskTitleCompleted: { textDecorationLine: "line-through" },
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
    difficultyText: { fontSize: 12, fontFamily: theme.fonts.medium },
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
    addTaskContainer: { padding: theme.spacing.lg, paddingBottom: 100 },
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
    confirmButton: { backgroundColor: theme.colors.primary },
    cancelButton: { backgroundColor: theme.colors.border },
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
    inputError: { borderColor: theme.colors.error + "50" },
  });
