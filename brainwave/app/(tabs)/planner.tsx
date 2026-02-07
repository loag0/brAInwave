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
import Svg, { Path } from "react-native-svg";
import { doc, setDoc, onSnapshot } from "firebase/firestore";
import { db as firestore } from "../../firebaseConfig";
import brainwaveApi from "@/api/brAInwaveApi";
import { useAlert } from "../contexts/AlertContext";
import DateTimePicker from "@react-native-community/datetimepicker";

interface IconProps {
  color: string;
  size: number;
}
interface InsightIconProps {
  color: string;
  size: number;
  name: string;
}

const ICONS = {
  SUCCESS:
    "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z",
  ERROR:
    "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z",
  AUTO_RENEW:
    "M12 6v3l4-4-4-4v3c-4.42 0-8 3.58-8 8 0 1.57.46 3.03 1.24 4.26L6.7 14.8c-.45-.83-.7-1.79-.7-2.8 0-3.31 2.69-6 6-6zm6.76 1.74L17.3 9.2c.44.84.7 1.79.7 2.8 0 3.31-2.69 6-6 6v-3l-4 4 4 4v-3c4.42 0 8-3.58 8-8 0-1.57-.46-3.03-1.24-4.26z",
};

const INSIGHT_PATHS = {
  bulb: "M480-80q-33 0-56.5-23.5T400-160h160q0 33-23.5 56.5T480-80ZM320-200v-80h320v80H320Zm10-120q-69-41-109.5-110T180-580q0-125 87.5-212.5T480-880q125 0 212.5 87.5T780-580q0 81-40.5 150T630-320H330Zm24-80h252q45-32 69.5-79T700-580q0-92-64-156t-156-64q-92 0-156 64t-64 156q0 54 24.5 101t69.5 79Zm126 0Z",
  rocket:
    "m240-198 79-32q-10-29-18.5-59T287-349l-47 32v119Zm160-42h160q18-40 29-97.5T600-455q0-99-33-187.5T480-779q-54 48-87 136.5T360-455q0 60 11 117.5t29 97.5Zm23.5-223.5Q400-487 400-520t23.5-56.5Q447-600 480-600t56.5 23.5Q560-553 560-520t-23.5 56.5Q513-440 480-440t-56.5-23.5ZM720-198v-119l-47-32q-5 30-13.5 60T641-230l79 32ZM480-881q99 72 149.5 183T680-440l84 56q17 11 26.5 29t9.5 38v237l-199-80H359L160-80v-237q0-20 9.5-38t26.5-29l84-56q0-147 50.5-258T480-881Z",
  leaf: "M216-176q-45-45-70.5-104T120-402q0-63 24-124.5T222-642q35-35 86.5-60t122-39.5Q501-756 591.5-759t202.5 7q8 106 5 195t-16.5 160.5q-13.5 71.5-38 125T684-182q-53 53-112.5 77.5T450-80q-65 0-127-25.5T216-176Zm112-16q29 17 59.5 24.5T450-160q46 0 91-18.5t86-59.5q18-18 36.5-50.5t32-85Q709-426 716-500.5t2-177.5q-49-2-110.5-1.5T485-670q-61 9-116 29t-90 55q-45 45-62 89t-17 85q0 59 22.5 103.5T262-246q42-80 111-153.5T534-520q-72 63-125.5 142.5T328-192Zm0 0Zm0 0Z",
};

const InsightIcon: React.FC<InsightIconProps> = ({name, size, color}) => {
  const pathData = INSIGHT_PATHS[name as keyof typeof INSIGHT_PATHS]

  return(
    <Svg width={size} height={size} viewBox="0 -960 960 960" fill="none">
      <Path d={pathData} fill={color}/>
    </Svg>
  )
}

const PlannerIcon: React.FC<IconProps> = ({ color, size }) => (
  <Svg width={size} height={size} viewBox="0 -960 960 960" fill="none">
    <Path
      d="m612-292 56-56-148-148v-184h-80v216l172 172ZM480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-400Zm0 320q133 0 226.5-93.5T800-480q0-133-93.5-226.5T480-800q-133 0-226.5 93.5T160-480q0 133 93.5 226.5T480-160Z"
      fill={color}
    />
  </Svg>
);
const SunIcon: React.FC<IconProps> = ({ size, color }) => (
  <Svg width={size} height={size} viewBox="0, -960, 960, 960" fill="none">
    <Path
      d="M440-760v-160h80v160h-80Zm266 110-55-55 112-115 56 57-113 113Zm54 210v-80h160v80H760ZM440-40v-160h80v160h-80ZM254-652 140-763l57-56 113 113-56 54Zm508 512L651-255l54-54 114 110-57 59ZM40-440v-80h160v80H40Zm157 300-56-57 112-112 29 27 29 28-114 114Zm283-100q-100 0-170-70t-70-170q0-100 70-170t170-70q100 0 170 70t70 170q0 100-70 170t-170 70Zm0-80q66 0 113-47t47-113q0-66-47-113t-113-47q-66 0-113 47t-47 113q0 66 47 113t113 47Zm0-160Z"
      fill={color}
    />
  </Svg>
);

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
