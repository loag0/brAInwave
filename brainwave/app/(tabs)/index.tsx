import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../contexts/ThemeContext";
import { useAuth } from "../contexts/AuthContext";
import { useAlert } from "../contexts/AlertContext";
import { useTimer } from "../contexts/TimerContext";
import { Theme } from "../types";
import { FontAwesome } from "@expo/vector-icons";
import Svg, { Path } from "react-native-svg";

const { width } = Dimensions.get("window");

interface IconProps {
  size: number;
  color: string;
}

const CloseIcon: React.FC<IconProps> = ({ size, color }) => (
    <Svg width={size} height={size} viewBox="0 -960 960 960" fill="none">
      <Path
        d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z"
        fill={color}
      />
    </Svg>
  );

export default function Home() {
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const { setIsModalVisible } = useTimer();
  const [showUploadMenu, setShowUploadMenu] = useState(false);
  const [checkedAssignments, setCheckedAssignments] = useState<number[]>([]);

  const AddIcon: React.FC<IconProps> = ({ size, color }) => (
    <Svg width={size} height={size} viewBox="0 -960 960 960" fill="none">
      <Path
        d="M440-440H200v-80h240v-240h80v240h240v80H520v240h-80v-240Z"
        fill={color}
      />
    </Svg>
  );

  const PomodoroIcon: React.FC<IconProps> = ({ size, color }) => (
    <Svg width={size} height={size} viewBox="0 -960 960 960" fill="none">
      <Path 
      d="M360-840v-80h240v80H360Zm80 440h80v-240h-80v240Zm40 320q-74 0-139.5-28.5T226-186q-49-49-77.5-114.5T120-440q0-74 28.5-139.5T226-694q49-49 114.5-77.5T480-800q62 0 119 20t107 58l56-56 56 56-56 56q38 50 58 107t20 119q0 74-28.5 139.5T734-186q-49 49-114.5 77.5T480-80Zm0-80q116 0 198-82t82-198q0-116-82-198t-198-82q-116 0-198 82t-82 198q0 116 82 198t198 82Zm0-280Z"
      fill={color}
      />
      </Svg>
  );

  const TodayIcon: React.FC<IconProps> = ({ size, color}) => (
    <Svg width = {size} height = {size} viewBox = "0 -960 960 960" fill={color}>
      <Path 
        d="M360-300q-42 0-71-29t-29-71q0-42 29-71t71-29q42 0 71 29t29 71q0 42-29 71t-71 29ZM200-80q-33 0-56.5-23.5T120-160v-560q0-33 23.5-56.5T200-800h40v-80h80v80h320v-80h80v80h40q33 0 56.5 23.5T840-720v560q0 33-23.5 56.5T760-80H200Zm0-80h560v-400H200v400Zm0-480h560v-80H200v80Zm0 0v-80 80Z"
        fill={color} />
    </Svg>
  );

  const AssignmentIcon: React.FC<IconProps> = ({ size, color }) => (
    <Svg width={size} height={size} viewBox="0, -960, 960, 960" fill={color}>
      <Path
        d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h168q13-36 43.5-58t68.5-22q38 0 68.5 22t43.5 58h168q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm0-80h560v-560H200v560Zm80-80h280v-80H280v80Zm0-160h400v-80H280v80Zm0-160h400v-80H280v80Zm200-190q13 0 21.5-8.5T510-820q0-13-8.5-21.5T480-850q-13 0-21.5 8.5T450-820q0 13 8.5 21.5T480-790ZM200-200v-560 560Z"
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

  const CheckIcon: React.FC<IconProps> = ({ size, color }) => (
    <Svg width={size} height={size} viewBox="0 -960 960 960" fill="none">
      <Path
        d="M382-240 154-468l57-57 171 171 367-367 57 57-424 424Z" fill={color} />
    </Svg>
  );

  const ScheduleIcon: React.FC<IconProps> = ({ size, color }) => (
    <Svg width={size} height={size} viewBox="0 -960 960 960" fill="none">
      <Path
        d="m612-292 56-56-148-148v-184h-80v216l172 172ZM480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-400Zm0 320q133 0 226.5-93.5T800-480q0-133-93.5-226.5T480-800q-133 0-226.5 93.5T160-480q0 133 93.5 226.5T480-160Z"
        fill={color}
      />
    </Svg>
  );

  const upcomingClasses = [
    {
      id: 1,
      name: "Data Structures",
      time: "10:00 AM",
      room: "CS-201",
      color: theme.colors.primary,
    },
    {
      id: 2,
      name: "Calculus II",
      time: "2:00 PM",
      room: "MATH-105",
      color: "#4a4a4a",
    },
    {
      id: 3,
      name: "English Literature",
      time: "4:30 PM",
      room: "ENG-302",
      color: "#6a6a6a",
    },
  ];

  const assignments = [
    {
      id: 1,
      title: "Algorithm Analysis Essay",
      subject: "Data Structures",
      due: "Tomorrow",
      priority: "high",
    },
    {
      id: 2,
      title: "Chapter 5 Practice Problems",
      subject: "Calculus II",
      due: "3 days",
      priority: "medium",
    },
    {
      id: 3,
      title: "Book Report Draft",
      subject: "English Literature",
      due: "1 week",
      priority: "low",
    },
  ];

  const studySessions = [
    {
      id: 1,
      subject: "Data Structures",
      duration: "45 min",
      time: "8:00 PM",
      type: "Review",
    },
    {
      id: 2,
      subject: "Calculus II",
      duration: "60 min",
      time: "9:00 PM",
      type: "Practice",
    },
  ];

  function toggleAssignment(id: number) {
    setCheckedAssignments((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  function getPriorityColor(priority: string) {
    if (priority === "high") return theme.colors.error;
    if (priority === "medium") return theme.colors.warning;
    return theme.colors.text.secondary;
  }

  const styles = createStyles(theme, isDark);

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerBg}>
          <View style={styles.headerContent}>
            <Text style={styles.welcomeText}>
              Welcome back, {user?.name?.split(" ")[0] || "Kirk"}!
            </Text>
            <Text style={styles.dateText}>Thursday, October 17, 2025</Text>
          </View>

          <View style={styles.progressCard}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressTitle}>Today's Progress</Text>
              <Text style={styles.progressValue}>2.5 / 4 hours</Text>
            </View>
            <View style={styles.progressBarContainer}>
              <View style={styles.progressBarFill} />
            </View>
            <Text style={styles.progressMessage}>
              Great! You're on track 🎯
            </Text>
          </View>
        </View>

        <View style={styles.content}>
          <TouchableOpacity
            style={styles.pomodoroButton}
            onPress={() => setIsModalVisible(true)}
          >
            <PomodoroIcon color={theme.colors.secondary} size={24} />
            <Text style={styles.pomodoroText}>Start Pomodoro Session</Text>
          </TouchableOpacity>

          {/* Classes Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardTitleContainer}>
                <TodayIcon size={24} color={theme.colors.text.secondary} />
                <Text style={styles.cardTitle}>Today's Classes</Text>
              </View>
              <Text style={styles.viewAllText}>View All</Text>
            </View>
            <View style={styles.cardContent}>
              {upcomingClasses.map((cls, idx) => (
                <View
                  key={cls.id}
                  style={[
                    styles.classItem,
                    idx !== upcomingClasses.length - 1 && styles.itemMargin,
                  ]}
                >
                  <View
                    style={[
                      styles.classIndicator,
                      { backgroundColor: cls.color },
                    ]}
                  />
                  <View style={styles.classInfo}>
                    <Text style={styles.className}>{cls.name}</Text>
                    <View style={styles.classDetails}>
                      <ScheduleIcon size={10} color={theme.colors.text.secondary} />
                      <Text style={styles.classTime}>{cls.time}</Text>
                      <Text style={styles.classSeparator}>•</Text>
                      <Text style={styles.classRoom}>{cls.room}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* Assignments Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardTitleContainer}>
                <AssignmentIcon color={theme.colors.text.secondary} size={24}/>
                <Text style={styles.cardTitle}>Assignments</Text>
              </View>
              <Text style={styles.viewAllText}>View All</Text>
            </View>
            <View style={styles.cardContent}>
              {assignments.map((a, idx) => (
                <View
                  key={a.id}
                  style={[
                    styles.assignmentItem,
                    idx !== assignments.length - 1 && styles.itemMargin,
                  ]}
                >
                  <TouchableOpacity
                    style={styles.checkbox}
                    onPress={() => toggleAssignment(a.id)}
                  >
                    {checkedAssignments.includes(a.id) && (
                      <CheckIcon size={18} color={theme.colors.primary} />
                    )}
                  </TouchableOpacity>
                  <View style={styles.assignmentInfo}>
                    <Text
                      style={[
                        styles.assignmentTitle,
                        checkedAssignments.includes(a.id) &&
                          styles.assignmentTitleChecked,
                      ]}
                    >
                      {a.title}
                    </Text>
                    <Text style={styles.assignmentSubject}>{a.subject}</Text>
                    <View
                      style={[
                        styles.badge,
                        {
                          backgroundColor: getPriorityColor(a.priority) + "20",
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.badgeText,
                          { color: getPriorityColor(a.priority) },
                        ]}
                      >
                        Due {a.due}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* AI Suggested Sessions */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View>
                <View style={styles.cardTitleContainer}>
                  <AISessionsIcon color={theme.colors.text.secondary} size={24} />
                  <Text style={styles.cardTitle}>AI Suggested Sessions</Text>
                </View>
                <Text style={styles.aiSubtitle}>
                  Optimized for your learning style
                </Text>
              </View>
            </View>
            <View style={styles.cardContent}>
              {studySessions.map((session, idx) => (
                <View
                  key={session.id}
                  style={[
                    styles.sessionItem,
                    idx !== studySessions.length - 1 && styles.itemMargin,
                  ]}
                >
                  <View style={styles.sessionInfo}>
                    <Text style={styles.sessionSubject}>{session.subject}</Text>
                    <View style={styles.sessionDetails}>
                      <ScheduleIcon size={12} color={theme.colors.text.secondary} />
                      <Text style={styles.sessionTime}>{session.time}</Text>
                      <Text style={styles.sessionSeparator}>•</Text>
                      <Text style={styles.sessionDuration}>
                        {session.duration}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.sessionBadge}>
                    <Text style={styles.sessionBadgeText}>{session.type}</Text>
                  </View>
                </View>
              ))}
              <TouchableOpacity style={styles.startSessionButton}>
                <Text style={styles.startSessionText}>Start Study Session</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowUploadMenu(true)}
        activeOpacity={0.8}
      >
        <AddIcon color={theme.colors.secondary} size={36} />
      </TouchableOpacity>

      {showUploadMenu && (
        <UploadMenu
          theme={theme}
          onClose={() => setShowUploadMenu(false)}
          onSelectOption={(opt: string) => console.log("selected:", opt)}
        />
      )}
    </SafeAreaView>
  );
}

export const PomodoroTimer = () => {
  const { theme } = useTheme();
  const { showAlert } = useAlert();
  const {
    minutes,
    seconds,
    isRunning,
    toggleTimer,
    resetTimer,
    isModalVisible,
    setIsModalVisible,
  } = useTimer();

  if (!isModalVisible) return null;

  const handleDismiss = () => {
    if (isRunning) {
      showAlert({
        title: "Wait, don't leave!",
        message:
          "Closing this will stop your flow. Are you sure you want to quit focusing?",
        showCancel: true,
        confirmText: "I'm giving up",
        cancelText: "Keep going",
        onConfirm: () => {
          resetTimer();
          setIsModalVisible(false);
        },
      });
    } else {
      setIsModalVisible(false);
    }
  };

  return (
    <Modal
      transparent
      animationType="slide"
      visible={isModalVisible}
      onRequestClose={handleDismiss}
    >
      <View style={pomoStyles.overlay}>
        <View
          style={[pomoStyles.modal, { backgroundColor: theme.colors.surface }]}
        >
          <TouchableOpacity style={pomoStyles.close} onPress={handleDismiss}>
            <CloseIcon size={24} color={theme.colors.text.secondary}
            />
          </TouchableOpacity>

          <Text
            style={[pomoStyles.title, { color: theme.colors.text.primary }]}
          >
            Focus Mode
          </Text>

          <Text style={[pomoStyles.timer, { color: theme.colors.primary }]}>
            {String(minutes).padStart(2, "0")}:
            {String(seconds).padStart(2, "0")}
          </Text>

          <View style={pomoStyles.buttonBar}>
            <TouchableOpacity
              style={[
                pomoStyles.button,
                { backgroundColor: theme.colors.primary },
              ]}
              onPress={toggleTimer}
            >
              <Text style={pomoStyles.buttonText}>
                {isRunning ? "Pause" : "Resume"}
              </Text>
            </TouchableOpacity>

            {isRunning && (
              <TouchableOpacity
                style={[pomoStyles.button, { marginTop: 10 }]}
                onPress={handleDismiss}
              >
                <Text style={{ color: theme.colors.error, fontWeight: "600" }}>
                  End Session
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const UploadMenu = ({ theme, onClose, onSelectOption }: any) => {

  //this is for the upload menu modal. still havent gotten to mapping the different icons yet
  const CalendarIcon: React.FC<IconProps> = ({ size, color }) => (
    <Svg width={size} height={size} viewBox="0 -960 960 960" fill="none">
      <Path
        d="M200-80q-33 0-56.5-23.5T120-160v-560q0-33 23.5-56.5T200-800h40v-80h80v80h320v-80h80v80h40q33 0 56.5 23.5T840-720v560q0 33-23.5 56.5T760-80H200Zm0-80h560v-400H200v400Zm0-480h560v-80H200v80Zm0 0v-80 80Zm280 240q-17 0-28.5-11.5T440-440q0-17 11.5-28.5T480-480q17 0 28.5 11.5T520-440q0 17-11.5 28.5T480-400Zm-160 0q-17 0-28.5-11.5T280-440q0-17 11.5-28.5T320-480q17 0 28.5 11.5T360-440q0 17-11.5 28.5T320-400Zm320 0q-17 0-28.5-11.5T600-440q0-17 11.5-28.5T640-480q17 0 28.5 11.5T680-440q0 17-11.5 28.5T640-400ZM480-240q-17 0-28.5-11.5T440-280q0-17 11.5-28.5T480-320q17 0 28.5 11.5T520-280q0 17-11.5 28.5T480-240Zm-160 0q-17 0-28.5-11.5T280-280q0-17 11.5-28.5T320-320q17 0 28.5 11.5T360-280q0 17-11.5 28.5T320-240Zm320 0q-17 0-28.5-11.5T600-280q0-17 11.5-28.5T640-320q17 0 28.5 11.5T680-280q0 17-11.5 28.5T640-240Z"
        fill={color}
      />
    </Svg>
  );

  const ChevronRightIcon: React.FC<IconProps> = ({ size, color }) => (
    <Svg width={size} height={size} viewBox="0 -960 960 960" fill="none">
      <Path
        d="M504-480 320-664l56-56 240 240-240 240-56-56 184-184Z"
        fill={color}
      />
    </Svg>
  );

  const uploadOptions = [
    {
      id: "schedule",
      icon: "calendar",
      label: "Upload schedule",
      description: "Add your class timetable",
    },
    {
      id: "syllabus",
      icon: "file-text",
      label: "Upload syllabus",
      description: "Import course syllabus",
    },
    {
      id: "assignment",
      icon: "clipboard",
      label: "Add assignment",
      description: "Create a new task",
    },
    {
      id: "notes",
      icon: "sticky-note",
      label: "Upload notes",
      description: "Add study materials",
    },
  ];

  return (
    <TouchableOpacity
      style={menuStyles.overlay}
      activeOpacity={1}
      onPress={onClose}
    >
      <View
        style={[menuStyles.modal, { backgroundColor: theme.colors.surface }]}
      >
        <View style={menuStyles.header}>
          <Text
            style={[menuStyles.title, { color: theme.colors.text.primary }]}
          >
            Upload content
          </Text>
          <TouchableOpacity onPress={onClose}>
            <CloseIcon size={32} color={theme.colors.text.secondary} />
          </TouchableOpacity>
        </View>
        {uploadOptions.map((opt) => (
          <TouchableOpacity
            key={opt.id}
            style={[
              menuStyles.option,
              {
                backgroundColor: theme.colors.background,
                borderColor: theme.colors.border,
              },
            ]}
            onPress={() => {
              onSelectOption(opt.id);
              onClose();
            }}
          >
            <View
              style={[
                menuStyles.iconContainer,
                { backgroundColor: theme.colors.primary + "22" },
              ]}
            >
              <FontAwesome
                name={opt.icon as any}
                size={24}
                color={theme.colors.primary}
              />
            </View>
            <View style={menuStyles.optionText}>
              <Text
                style={[
                  menuStyles.optionLabel,
                  { color: theme.colors.text.primary },
                ]}
              >
                {opt.label}
              </Text>
              <Text
                style={[
                  menuStyles.optionDescription,
                  { color: theme.colors.text.secondary },
                ]}
              >
                {opt.description}
              </Text>
            </View>
            <ChevronRightIcon size={36} color={theme.colors.text.secondary} />
          </TouchableOpacity>
        ))}
      </View>
    </TouchableOpacity>
  );
};

const createStyles = (theme: Theme, isDark: boolean) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    scrollView: { flex: 1 },
    headerBg: {
      width: "100%",
      paddingTop: 20,
      paddingBottom: 40,
      backgroundColor: isDark ? "#2d2d2d" : "#f9f9f9",
    },
    headerContent: {
      paddingLeft: theme.spacing.lg,
      paddingBottom: theme.spacing.md,
    },
    welcomeText: {
      fontSize: 24,
      fontFamily: theme.fonts.bold,
      color: theme.colors.text.primary,
    },
    dateText: {
      fontSize: 16,
      color: theme.colors.text.secondary,
      fontFamily: theme.fonts.regular,
    },
    progressCard: {
      width: width - 48,
      alignSelf: "center",
      backgroundColor: isDark ? "#3a3a3a" : "#fff",
      borderRadius: 14,
      marginTop: 16,
      padding: 20,
      elevation: 2,
    },
    progressHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 10,
    },
    progressTitle: {
      fontSize: 14,
      fontFamily: theme.fonts.medium,
      color: theme.colors.text.primary,
    },
    progressValue: {
      fontSize: 16,
      fontFamily: theme.fonts.semiBold,
      color: theme.colors.primary,
    },
    progressBarContainer: {
      height: 10,
      borderRadius: 5,
      backgroundColor: "#eee",
      overflow: "hidden",
      marginVertical: 10,
    },
    progressBarFill: {
      height: 10,
      width: "62%",
      backgroundColor: theme.colors.primary,
    },
    progressMessage: {
      color: theme.colors.text.secondary,
      fontFamily: theme.fonts.regular,
      fontSize: 12,
    },
    content: { padding: 24, paddingBottom: 120 },
    pomodoroButton: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: theme.colors.primary,
      paddingVertical: 12,
      borderRadius: 12,
      marginBottom: 24,
    },
    pomodoroText: {
      color: "#fff",
      fontSize: 16,
      fontFamily: theme.fonts.semiBold,
      marginLeft: 8,
    },
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: 16,
      padding: 18,
      marginBottom: 24,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    cardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    },
    cardTitleContainer: { flexDirection: "row", alignItems: "center", gap: 8 },
    cardTitle: {
      fontSize: 18,
      fontFamily: theme.fonts.semiBold,
      color: theme.colors.text.primary,
    },
    viewAllText: {
      fontSize: 14,
      fontFamily: theme.fonts.medium,
      color: theme.colors.primary,
    },
    aiSubtitle: {
      fontSize: 12,
      color: theme.colors.text.secondary,
      marginLeft: 32,
    },
    cardContent: { gap: 8 },
    classItem: {
      flexDirection: "row",
      alignItems: "center",
      padding: 10,
      backgroundColor: theme.colors.background,
      borderRadius: 12,
      gap: 10,
    },
    classIndicator: { width: 4, height: 44, borderRadius: 2 },
    classInfo: { flex: 1 },
    className: {
      fontSize: 16,
      fontFamily: theme.fonts.medium,
      color: theme.colors.text.primary,
    },
    classDetails: { flexDirection: "row", alignItems: "center", gap: 6 },
    classTime: { fontSize: 12, color: theme.colors.text.secondary },
    classSeparator: { color: theme.colors.text.secondary },
    classRoom: { fontSize: 12, color: theme.colors.text.secondary },
    assignmentItem: {
      flexDirection: "row",
      padding: 10,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 12,
      gap: 10,
    },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: theme.colors.border,
      justifyContent: "center",
      alignItems: "center",
    },
    assignmentInfo: { flex: 1 },
    assignmentTitle: {
      fontSize: 16,
      fontFamily: theme.fonts.medium,
      color: theme.colors.text.primary,
    },
    assignmentTitleChecked: {
      textDecorationLine: "line-through",
      opacity: 0.5,
    },
    assignmentSubject: { fontSize: 12, color: theme.colors.text.secondary },
    badge: {
      alignSelf: "flex-start",
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
      marginTop: 4,
    },
    badgeText: { fontSize: 11, fontFamily: theme.fonts.medium },
    sessionItem: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: 10,
      backgroundColor: theme.colors.background,
      borderRadius: 12,
    },
    sessionInfo: { flex: 1 },
    sessionSubject: {
      fontSize: 16,
      fontFamily: theme.fonts.medium,
      color: theme.colors.text.primary,
    },
    sessionDetails: { flexDirection: "row", alignItems: "center", gap: 6 },
    sessionTime: { fontSize: 12, color: theme.colors.text.secondary },
    sessionSeparator: { color: theme.colors.text.secondary },
    sessionDuration: { fontSize: 12, color: theme.colors.text.secondary },
    sessionBadge: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      backgroundColor: theme.colors.border + "40",
      borderRadius: 8,
    },
    sessionBadgeText: { fontSize: 12, color: theme.colors.text.secondary },
    startSessionButton: {
      borderRadius: 10,
      alignItems: "center",
      paddingVertical: 12,
      backgroundColor: theme.colors.primary,
      marginTop: 8,
    },
    startSessionText: {
      color: "#fff",
      fontSize: 16,
      fontFamily: theme.fonts.semiBold,
    },
    itemMargin: { marginBottom: 8 },
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

const pomoStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  modal: {
    borderRadius: 28,
    padding: 32,
    width: width - 40,
    alignItems: "center",
  },
  close: { position: "absolute", top: 20, right: 20 },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 10,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  timer: {
    fontSize: 84,
    marginVertical: 30,
    fontWeight: "bold",
    fontVariant: ["tabular-nums"],
  },
  buttonBar: { width: "100%" },
  button: { paddingVertical: 18, borderRadius: 16, alignItems: "center" },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 18 },
});

const menuStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modal: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  title: { fontSize: 22, fontWeight: "bold" },
  option: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 18,
    marginBottom: 12,
    borderWidth: 1,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  optionText: { flex: 1, marginLeft: 16 },
  optionLabel: { fontSize: 16, fontWeight: "600" },
  optionDescription: { fontSize: 13, marginTop: 2 },
});
