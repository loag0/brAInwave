import React, { useState, useCallback, useEffect, useRef } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as DocumentPicker from "expo-document-picker";
import { useTheme } from "../contexts/ThemeContext";
import { useAuth } from "../contexts/AuthContext";
import { useAlert } from "../contexts/AlertContext";
import { Theme } from "../types";
import { useContent } from "../hooks/useContent";
import { router } from "expo-router";
import Skeleton from "@/components/HomeSkeleton";
import BrainwaveLoader from "@/components/BrainwaveLoader";
import { useTodaySchedule } from "../hooks/useTodaySchedule";
import { useTimetableUpload } from "../hooks/useTimetableUpload";
import { useNextClass } from "../hooks/useNextClass";
import {
  ensureNotificationPermission,
  scheduleDailyNotifications,
  formatTimeTo24h,
  parseDurationMinutes,
  parseStartDate,
} from "@/utils/notifications";
import {
  CloseIcon,
  SunIcon,
  AddIcon,
  TodayIcon,
  AssignmentIcon,
  ScheduleIcon,
  CalendarIcon,
  AddAssignmentIcon,
  ChevronRightIcon,
  FireIcon,
} from "@/components/Icons";
import { LocalDB } from "../database/localDb";

const HomeSkeleton = ({ styles, theme }: any) => (
  <View style={styles.container}>
    <ScrollView style={[styles.scrollView, { paddingTop: 32 }]}>
      <View style={styles.headerBg}>
        <View style={styles.headerContent}>
          <Skeleton width={180} height={28} style={{ marginBottom: 8 }} />
          <Skeleton width={140} height={18} />
        </View>
      </View>
      <View style={styles.content}>
        {[1, 2, 3].map((i) => (
          <View key={i} style={[styles.card, { padding: 20 }]}>
            <View style={{ flexDirection: "row", marginBottom: 20 }}>
              <Skeleton width={30} height={30} borderRadius={15} />
              <Skeleton width={120} height={24} style={{ marginLeft: 10 }} />
            </View>
            <Skeleton
              width="100%"
              height={60}
              borderRadius={12}
              style={{ marginBottom: 10 }}
            />
            <Skeleton width="100%" height={60} borderRadius={12} />
          </View>
        ))}
      </View>
    </ScrollView>
  </View>
);

export default function Home() {
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const [refreshing, setRefreshing] = useState(false);

  const hasShownOverdueAlert = useRef(false); //once per session, not when a screen is focused

  const {
    timetables,
    plans,
    assignments,
    isLoading: contentLoading,
    refresh,
    createAssignment,
    syncProgress,
  } = useContent();

  const [isLoading, setIsLoading] = useState(false);
  const isManualLoading = isLoading;
  const isBackgroundSyncing = syncProgress.total > 0;
  const [loadingMessage, setLoadingMessage] = useState("Analyzing...");
  const [showUploadMenu, setShowUploadMenu] = useState(false);
  const [streakCount, setStreakCount] = useState(0);

  const [, setTick] = useState<number>(0);

  const leadMinutes = user?.studyPreferences.notificationLeadMinutes ?? 10;
  const styles = createStyles(theme, isDark);

  const todaysSchedule = useTodaySchedule(
    plans,
    timetables,
    user?.id,
    contentLoading,
  );

  // Returns true if assignment's due_date is strictly before today
  const isOverdue = (dueDate?: string | null): boolean => {
    if (!dueDate) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate + "T00:00:00");
    return due < today;
  };

  useFocusEffect(
    useCallback(() => {
      refresh();
      if (user?.id) {
        setStreakCount(LocalDB.getStreakCount(user.id));
      }
    }, [refresh, user?.id]),
  );

  // Show overdue alert once per session after assignments load
  useEffect(() => {
    if (hasShownOverdueAlert.current) return;
    if (contentLoading) return;
    if (assignments.length === 0) return;

    const overdueList = assignments.filter((a) => isOverdue(a.due_date));
    if (overdueList.length === 0) return;

    hasShownOverdueAlert.current = true;

    const names = overdueList
      .slice(0, 3)
      .map((a) => `• ${a.title}`)
      .join("\n");
    const extra =
      overdueList.length > 3 ? `\n+${overdueList.length - 3} more` : "";

    showAlert({
      title: `${overdueList.length} Overdue Assignment${overdueList.length > 1 ? "s" : ""}`,
      message: `These assignments are past their due date:\n\n${names}${extra}\n\nHead to each one to update the deadline or delete it.`,
      confirmText: "View Assignments",
      showCancel: true,
      cancelText: "Dismiss",
      iconColor: theme.colors.warning,
      onConfirm: () => {
        if (overdueList.length === 1) {
          router.push({
            pathname: "/assignment/[id]",
            params: { id: overdueList[0].id },
          });
        }
      },
    });
  }, [assignments, contentLoading, showAlert, theme.colors.warning]);

  useEffect(() => {
    const interval = setInterval(() => {
      setTick((prev: number) => prev + 1);
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const { upload } = useTimetableUpload(
    user?.id,
    refresh,
    showAlert,
    setIsLoading,
    setLoadingMessage,
  );

  const handleUploadAssignment = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "text/plain"],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setIsLoading(true);
        setLoadingMessage("Analyzing Assignment...");
        const asset = result.assets[0];
        await createAssignment(
          asset.name,
          asset.uri,
          asset.mimeType || "application/pdf",
        );
        setIsLoading(false);
        showAlert?.({
          title: "Assignment Uploaded",
          message: "brAInwave is busy building your master plan!",
        });
      }
    } catch (err: any) {
      setIsLoading(false);
      showAlert?.({
        title: "Upload Failed",
        message: (__DEV__) ? err.message : "Failed to upload assignment."
      });
    }
  }, [createAssignment, showAlert]);

  const loadingText = !contentLoading
    ? loadingMessage
    : `Syncing records (${syncProgress.current}/${syncProgress.total})...`;

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh(true);
    setRefreshing(false);
  };

  const { nextClass, countdown } = useNextClass(todaysSchedule);
  const isOngoing = countdown === "Started";

  useEffect(() => {
    if (!user) return;
    (async () => {
      const allowed = await ensureNotificationPermission();

      if (!allowed) return;
      if (user?.studyPreferences.notifications?.studyReminders) {
        await scheduleDailyNotifications(todaysSchedule, leadMinutes);
      }
    })();
  }, [
    todaysSchedule,
    nextClass,
    user,
    user?.studyPreferences.notificationLeadMinutes,
    leadMinutes,
  ]);

  const isTaskPastHome = (item: any) => {
    if (item.completed) return false;
    const start = parseStartDate(item);
    if (!start) return false;
    const durationMins = parseDurationMinutes(item.duration);
    const end = new Date(start.getTime() + durationMins * 60000);
    return new Date() > end;
  };

  const tasksRemaining = todaysSchedule.filter(
    (t) => !t.completed && !isTaskPastHome(t),
  ).length;
  const hasNextClass = nextClass !== null && nextClass !== undefined;

  const rawNextTitle =
    nextClass?.task || nextClass?.title || nextClass?.subject || "Next task";
  const nextTitle =
    rawNextTitle.length > 30
      ? rawNextTitle.slice(0, 36).trimEnd() + "..."
      : rawNextTitle;

  function getPriorityColor(priority: string) {
    const p = priority?.toLowerCase();
    if (p === "high") return theme.colors.error;
    if (p === "medium") return theme.colors.warning;
    return theme.colors.text.secondary;
  }

  if (contentLoading && timetables.length === 0) {
    return <HomeSkeleton styles={styles} theme={theme} />;
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      {(isManualLoading || isBackgroundSyncing) && (
        <View style={styles.loaderOverlay}>
          <BrainwaveLoader theme={theme} />
          <Text
            style={[
              styles.dateText,
              { marginTop: 16, fontWeight: "600", color: "#fff" },
            ]}
          >
            {loadingText}
          </Text>
        </View>
      )}

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
        <View style={styles.headerBg}>
          <View style={styles.headerContent}>
            <Text style={styles.welcomeText}>
              Welcome back, {user?.name?.split(" ")[0] || "User"}!
            </Text>
            <Text style={styles.dateText}>
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </Text>
            {streakCount > 0 && (
              <View
                style={[
                  styles.streakBadge,
                  { marginTop: 8, alignSelf: "flex-start" },
                ]}
              >
                <FireIcon size={14} color="#FF9500" />
                <Text style={styles.streakText}>{streakCount} day streak</Text>
              </View>
            )}
          </View>
        </View>

        {/* Status Chip */}
        <View style={styles.content}>
          <View style={styles.statusChip}>
            <View style={styles.statusLeft}>
              <View
                style={[
                  styles.statusIconBox,
                  { backgroundColor: theme.colors.primary + "18" },
                ]}
              >
                <TodayIcon size={18} color={theme.colors.primary} />
              </View>
              <View style={styles.statusTextBlock}>
                <Text style={styles.statusLabel}>
                  {hasNextClass
                    ? isOngoing
                      ? `${nextTitle} is ongoing`
                      : `${nextTitle} starts in`
                    : tasksRemaining > 0
                      ? "Keep going!"
                      : "All done today!"}
                </Text>
                {hasNextClass && !isOngoing && (
                  <Text style={styles.statusCountdown}>{countdown}</Text>
                )}
                {(!hasNextClass || isOngoing) && (
                  <Text style={styles.statusCountdown}>
                    {tasksRemaining} {tasksRemaining === 1 ? "task" : "tasks"}{" "}
                    left
                  </Text>
                )}
              </View>
            </View>

            <View style={styles.statusRight}>
              <Text style={styles.statusTasksNumber}>{tasksRemaining}</Text>
              <Text style={styles.statusTasksLabel}>tasks left</Text>
            </View>
          </View>
        </View>

        <View style={styles.content}>
          {/* Schedule Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardTitleContainer}>
                <TodayIcon size={24} color={theme.colors.text.secondary} />
                <Text style={styles.cardTitle}>
                  {todaysSchedule.length > 0
                    ? "Today's Schedule"
                    : "Daily Schedule"}
                </Text>
              </View>
              {todaysSchedule.length > 0 && (
                <TouchableOpacity onPress={() => router.push("/planner")}>
                  <Text style={styles.viewAllText}>View All</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.cardContent}>
              {todaysSchedule.length > 0 ? (
                todaysSchedule.slice(0, 3).map((item, idx) => (
                  <View
                    key={idx}
                    style={[
                      styles.classItem,
                      idx !== 2 && styles.itemMargin,
                      isTaskPastHome(item) && { opacity: 0.4 },
                    ]}
                  >
                    <View
                      style={[
                        styles.classIndicator,
                        {
                          backgroundColor: item.isAiGenerated
                            ? theme.colors.secondary
                            : theme.colors.primary,
                        },
                      ]}
                    />
                    <View style={styles.classInfo}>
                      <Text style={styles.className} numberOfLines={1}>
                        {item.task ||
                          item.subject ||
                          item.course ||
                          item.name ||
                          "Unknown Class"}
                      </Text>
                      {item.subject &&
                        item.task &&
                        item.task !== item.subject && (
                          <Text
                            style={[styles.classTime, { marginBottom: 2 }]}
                            numberOfLines={1}
                          >
                            {item.subject}
                          </Text>
                        )}
                      <View style={styles.classDetails}>
                        <ScheduleIcon
                          size={10}
                          color={theme.colors.text.secondary}
                        />
                        <Text style={styles.classTime}>
                          {item.time
                            ? formatTimeTo24h(item.time)
                            : item.duration || "No time"}
                        </Text>
                        {item.room && (
                          <>
                            <Text style={styles.classSeparator}>•</Text>
                            <Text style={styles.classRoom}>{item.room}</Text>
                          </>
                        )}
                      </View>
                    </View>
                  </View>
                ))
              ) : (
                <View style={{ alignItems: "center", paddingVertical: 15 }}>
                  <SunIcon size={32} color={theme.colors.warning} />
                  <Text
                    style={[
                      styles.emptyText,
                      { color: theme.colors.text.primary, fontWeight: "600" },
                    ]}
                  >
                    You're free today!
                  </Text>
                  <Text
                    style={[styles.emptyText, { marginTop: -15, fontSize: 13 }]}
                  >
                    Got some free time? Head to the Planner to optimize your day
                    with brAInwave!
                  </Text>
                  <TouchableOpacity
                    style={{
                      marginTop: 10,
                      backgroundColor: theme.colors.primary + "15",
                      paddingHorizontal: 16,
                      paddingVertical: 8,
                      borderRadius: 20,
                    }}
                    onPress={() => router.push("/planner")}
                  >
                    <Text
                      style={{ color: theme.colors.primary, fontWeight: "600" }}
                    >
                      Plan My Day
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>

          {/* Assignments Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardTitleContainer}>
                <AssignmentIcon color={theme.colors.text.secondary} size={24} />
                <Text style={styles.cardTitle}>Assignments</Text>
              </View>
            </View>
            <View style={styles.cardContent}>
              {assignments.length === 0 ? (
                <Text style={styles.emptyText}>No upcoming assignments.</Text>
              ) : (
                assignments.map((a, idx) => {
                  const overdue = isOverdue(a.due_date);
                  return (
                    <TouchableOpacity
                      key={a.id || idx}
                      activeOpacity={0.7}
                      onPress={() =>
                        router.push({
                          pathname: "/assignment/[id]",
                          params: { id: a.id },
                        })
                      }
                      style={[
                        styles.assignmentItem,
                        idx !== assignments.length - 1 && styles.itemMargin,
                        overdue && { opacity: 0.45 },
                      ]}
                    >
                      <View style={styles.assignmentInfo}>
                        <Text numberOfLines={1} style={styles.assignmentTitle}>
                          {a.title}
                        </Text>
                        <Text style={styles.assignmentSubject}>
                          {a.subject}
                        </Text>
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            marginTop: 4,
                            gap: 8,
                          }}
                        >
                          <View
                            style={[
                              styles.badge,
                              {
                                backgroundColor: overdue
                                  ? theme.colors.error + "20"
                                  : getPriorityColor(a.priority) + "20",
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.badgeText,
                                {
                                  color: overdue
                                    ? theme.colors.error
                                    : getPriorityColor(a.priority),
                                },
                              ]}
                            >
                              {overdue
                                ? "Overdue"
                                : `Due ${
                                    a.due_date
                                      ? a.due_date
                                          .split("-")
                                          .reverse()
                                          .join("/")
                                      : "N/A"
                                  }`}
                            </Text>
                          </View>
                          <ChevronRightIcon
                            size={16}
                            color={theme.colors.text.accent}
                          />
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
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
          onSelectOption={(opt: string) => {
            if (opt === "schedule") upload();
            if (opt === "assignment") handleUploadAssignment();
          }}
        />
      )}
    </SafeAreaView>
  );
}

// UPLOAD MENU COMPONENT
const UploadMenu = ({ theme, onClose, onSelectOption }: any) => {
  const uploadOptions = [
    {
      id: "schedule",
      Icon: CalendarIcon,
      label: "Upload schedule",
      description: "Add your class timetable",
    },
    {
      id: "assignment",
      Icon: AddAssignmentIcon,
      label: "Add assignment",
      description: "Track upcoming coursework",
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

        {uploadOptions.map((opt) => {
          const Icon = opt.Icon;
          return (
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
                <Icon size={24} color={theme.colors.primary} />
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
          );
        })}
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
    loaderOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.7)",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 999,
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
    streakBadge: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: isDark ? "#3d2b00" : "#fff2d9",
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: "#FF950040",
      gap: 4,
    },
    streakText: {
      fontSize: 12,
      fontFamily: theme.fonts.bold,
      color: "#FF9500",
    },
    content: { padding: 24 },
    statusChip: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 14,
      marginBottom: -24,
    },
    statusLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      flex: 1,
      minWidth: 0,
    },
    statusIconBox: {
      width: 38,
      height: 38,
      borderRadius: 10,
      justifyContent: "center",
      alignItems: "center",
      flexShrink: 0,
    },
    statusTextBlock: {
      flex: 1,
      minWidth: 0,
    },
    statusLabel: {
      fontSize: 12,
      fontFamily: theme.fonts.medium,
      color: theme.colors.text.secondary,
    },
    statusCountdown: {
      fontSize: 22,
      fontFamily: theme.fonts.bold,
      color: theme.colors.primary,
      lineHeight: 26,
    },
    statusRight: {
      alignItems: "flex-end",
      paddingLeft: 12,
      flexShrink: 0,
    },
    statusTasksNumber: {
      fontSize: 28,
      fontFamily: theme.fonts.bold,
      color: theme.colors.text.primary,
      lineHeight: 30,
    },
    statusTasksLabel: {
      fontSize: 11,
      fontFamily: theme.fonts.regular,
      color: theme.colors.text.secondary,
    },
    emptyText: {
      fontSize: 14,
      color: theme.colors.text.secondary,
      textAlign: "center",
      paddingVertical: 10,
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
    assignmentInfo: { flex: 1 },
    assignmentTitle: {
      fontSize: 16,
      fontFamily: theme.fonts.medium,
      color: theme.colors.text.primary,
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

const menuStyles = StyleSheet.create({
  overlay: {
    justifyContent: "flex-end",
  },
  modal: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    paddingBottom: 40,
    overflow: "hidden",
    elevation: 10,
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