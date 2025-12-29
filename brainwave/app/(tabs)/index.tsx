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
import { FontAwesome, Ionicons } from "@expo/vector-icons";

const { width } = Dimensions.get("window");

export default function Home() {
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const { setIsModalVisible } = useTimer();
  const [showUploadMenu, setShowUploadMenu] = useState(false);
  const [checkedAssignments, setCheckedAssignments] = useState<number[]>([]);

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
              Welcome back, {user?.name?.split(" ")[0] || "alex"}!
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
            <FontAwesome name="clock-o" size={20} color="#fff" />
            <Text style={styles.pomodoroText}>Start Pomodoro Session</Text>
          </TouchableOpacity>

          {/* Classes Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardTitleContainer}>
                <FontAwesome
                  name="calendar-check-o"
                  size={20}
                  color={theme.colors.text.primary}
                />
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
                      <FontAwesome
                        name="clock-o"
                        size={12}
                        color={theme.colors.text.secondary}
                      />
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
                <FontAwesome
                  name="book"
                  size={20}
                  color={theme.colors.text.primary}
                />
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
                      <FontAwesome
                        name="check"
                        size={16}
                        color={theme.colors.primary}
                      />
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
                  <FontAwesome
                    name="star"
                    size={20}
                    color={theme.colors.text.primary}
                  />
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
                      <FontAwesome
                        name="clock-o"
                        size={12}
                        color={theme.colors.text.secondary}
                      />
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
        <FontAwesome name="plus" size={28} color="#fff" />
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
            <Ionicons
              name="close"
              size={28}
              color={theme.colors.text.secondary}
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
            <FontAwesome
              name="close"
              size={24}
              color={theme.colors.text.secondary}
            />
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
            <FontAwesome
              name="chevron-right"
              size={20}
              color={theme.colors.text.secondary}
            />
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
      marginLeft: 28,
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
