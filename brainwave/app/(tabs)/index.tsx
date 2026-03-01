import React, { useState, useCallback, useEffect } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
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
import { useTodaySchedule } from "../hooks/useTodaySchedule";
import { useTimetableUpload } from "../hooks/useTimetableUpload";
import { useNextClass } from "../hooks/useNextClass";
import {
  ensureNotificationPermission,
  scheduleDailyNotifications,
  formatTimeTo24h,
} from "@/utils/notifications";
import {
  CloseIcon,
  SunIcon,
  AddIcon,
  TodayIcon,
  AssignmentIcon,
  CheckIcon,
  ScheduleIcon,
  CalendarIcon,
  UploadSyllabusIcon,
  AddAssignmentIcon,
  ChevronRightIcon,
} from "@/components/Icons";

const { width } = Dimensions.get("window");

const HomeSkeleton = ({ styles, theme }: any) => (
  <View style={styles.container}>
    <ScrollView style={styles.scrollView}>
      {/* Header Skeleton */}
      <View style={styles.headerBg}>
        <View style={styles.headerContent}>
          <Skeleton width={180} height={28} style={{ marginBottom: 8 }} />
          <Skeleton width={140} height={18} />
        </View>
        <View
          style={[
            styles.progressCard,
            { height: 120, justifyContent: "center" },
          ]}
        >
          <Skeleton width="60%" height={20} style={{ marginBottom: 15 }} />
          <Skeleton
            width="90%"
            height={10}
            borderRadius={5}
            style={{ marginBottom: 15 }}
          />
          <Skeleton width="40%" height={14} />
        </View>
      </View>

      <View style={styles.content}>
        {/* Card Skeletons */}
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
  const [assignments] = useState<any[]>([]);

  const {
    timetables,
    plans,
    isLoading: contentLoading,
    refresh,
    createMaterial,
    syncProgress,
  } = useContent();

  const [isLoading, setIsLoading] = useState(false);
  const isManualLoading = isLoading;
  const isBackgroundSyncing = syncProgress.total > 0;
  const [loadingMessage, setLoadingMessage] = useState("Analyzing...");
  const [showUploadMenu, setShowUploadMenu] = useState(false);
  const [checkedAssignments, setCheckedAssignments] = useState<number[]>([]);
  //const hasTimetable = timetables.length > 0;

  const leadMinutes = user?.studyPreferences.notificationLeadMinutes ?? 10;

  const styles = createStyles(theme, isDark);
  // 1. LISTEN TO FIRESTORE ON MOUNT

  const todaysSchedule = useTodaySchedule(
    plans,
    timetables,
    user?.id,
    contentLoading,
  );

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const { upload } = useTimetableUpload(
    user?.id,
    refresh,
    showAlert,
    setIsLoading,
    setLoadingMessage,
  );

  const handleUploadSyllabus = useCallback(async () => {
    if (!user?.id) {
      showAlert?.({ title: "Error", message: "You must be logged in" });
      return;
    }

    const result = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "image/*"],
      copyToCacheDirectory: true,
      multiple: true,
    });

    if (result.canceled || !result.assets) return;

    setIsLoading(true);
    setLoadingMessage("Importing...");

    try {
      for (const asset of result.assets) {
        setLoadingMessage(`Importing ${asset.name}...`);
        const cleanTitle = decodeURIComponent(asset.name)
          .replace(/%20/g, " ")
          .replace(/\.[^/.]+$/, "") // Remove file extension
          .trim();

        await createMaterial(
          cleanTitle,
          "",
          asset.uri,
          asset.mimeType || "application/pdf",
        );
      }

      showAlert?.({
        title: "Success",
        message: "Syllabus imported and planning initiated!",
      });
    } catch (e) {
      console.error(e);
      showAlert?.({ title: "Import Failed", message: "Failed to read file." });
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, createMaterial, showAlert, setIsLoading, setLoadingMessage]);

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
    // Schedule daily notifications whenever todaysSchedule changes
    // This ensures that opening the home page also refreshes the daily reminder schedule.
    (async () => {
      const allowed = await ensureNotificationPermission();
      if (!allowed) return;

      if (user?.studyPreferences.notifications?.studyReminders) {
        await scheduleDailyNotifications(todaysSchedule, leadMinutes);
      }
    })();

    console.log(
      "DEBUG: Todays Schedule Data: ",
      JSON.stringify(todaysSchedule, null, 2),
    );
    console.log("DEBUG: Next class identified: ", nextClass);
  }, [
    todaysSchedule,
    nextClass,
    user,
    user?.studyPreferences.notificationLeadMinutes,
    leadMinutes,
  ]);

  function toggleAssignment(id: number) {
    setCheckedAssignments((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }

  const aiTips = [
    "Lock in your hardest subject while your energy is high.",
    "Short, focused sessions beat long distracted ones.",
    "Review notes within 24 hours to actually remember them.",
  ];
  const [tipOfTheDay] = useState(
    () => aiTips[Math.floor(Math.random() * aiTips.length)],
  );

  const tasksRemaining = todaysSchedule.filter((t) => !t.completed).length;
  const hasNextClass = nextClass !== null && nextClass !== undefined;

  const nextTitle =
    nextClass?.task || nextClass?.title || nextClass?.subject || "Next task";

  const heroSubText = hasNextClass
    ? isOngoing
      ? `${nextTitle} has already started!`
      : `${nextTitle} starts in ${countdown}`
    : tasksRemaining > 0
      ? `You still have ${tasksRemaining} tasks to do hb. Get moovin'!`
      : "No more classes today. Review those notes fn";

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
      {/*LOADING OVERLAY*/}
      {(isManualLoading || isBackgroundSyncing) && (
        <View style={styles.loaderOverlay}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text
            style={[
              styles.dateText,
              {
                marginTop: 10,
                fontWeight: "600",
                color: "#fff",
              },
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
        {/* Header Section */}
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
          </View>
        </View>

        {/* Hero: Summary + Tip */}
        <View style={styles.content}>
          <View style={styles.heroCard}>
            <Text style={styles.heroTitle}>Today at a glance</Text>

            <View style={styles.heroRow}>
              <Text style={styles.heroNumber}>{tasksRemaining}</Text>
              <Text style={styles.heroLabel}>
                {tasksRemaining === 1 ? "task left" : "tasks left"}
              </Text>
            </View>

            <View style={styles.heroSub}>
              {isOngoing && (
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: theme.colors.error,
                    marginRight: 8,
                  }}
                ></View>
              )}
              <Text style={styles.heroSubTextOnly}>{heroSubText}</Text>
            </View>

            <View style={styles.tipPill}>
              <Text style={styles.tipPrefix}>brAInwave says...</Text>
              <Text style={styles.tipText}>{tipOfTheDay}</Text>
            </View>
          </View>
        </View>

        <View style={styles.content}>
          {/* Classes Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardTitleContainer}>
                <TodayIcon size={24} color={theme.colors.text.secondary} />
                <Text style={styles.cardTitle}>
                  {/*This is for if there are items in "classes"*/}
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
                // 1. Show whatever is scheduled (classes OR AI tasks)
                todaysSchedule.slice(0, 3).map((item, idx) => (
                  <View
                    key={idx}
                    style={[styles.classItem, idx !== 2 && styles.itemMargin]}
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
                      <Text style={styles.className}>
                        {item.task ||
                          item.subject ||
                          item.course ||
                          item.name ||
                          "Unknown Class"}
                      </Text>
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
                      {
                        color: theme.colors.text.primary,
                        fontWeight: "600",
                      },
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
                      style={{
                        color: theme.colors.primary,
                        fontWeight: "600",
                      }}
                    >
                      Plan My Day
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>

          {/* Assignments */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardTitleContainer}>
                <AssignmentIcon color={theme.colors.text.secondary} size={24} />
                <Text style={styles.cardTitle}>Assignments</Text>
              </View>
              <Text style={styles.viewAllText}>View All</Text>
            </View>
            <View style={styles.cardContent}>
              {assignments.length === 0 ? (
                <Text style={styles.emptyText}>No upcoming assignments.</Text>
              ) : (
                assignments.map((a, idx) => (
                  <View
                    key={a.id || idx}
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
                            backgroundColor:
                              getPriorityColor(a.priority) + "20",
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
                ))
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
            if (opt === "syllabus") handleUploadSyllabus();
            if (opt === "assignment") {
              showAlert?.({
                title: "Assignments coming soon",
                message:
                  "You'll be able to track coursework and due dates from here.",
              });
            }
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
      id: "syllabus",
      Icon: UploadSyllabusIcon,
      label: "Upload syllabus",
      description: "Import course syllabus",
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
    emptyText: {
      fontSize: 14,
      color: theme.colors.text.secondary,
      textAlign: "center",
      paddingVertical: 10,
    },
    content: { padding: 24 },
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: 16,
      padding: 18,
      marginBottom: 24,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    heroCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: 18,
      padding: 20,
      marginBottom: -6,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    heroTitle: {
      fontSize: 18,
      fontFamily: theme.fonts.semiBold,
      color: theme.colors.text.primary,
      marginBottom: 12,
    },
    heroRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      marginBottom: 8,
      gap: 8,
    },
    heroNumber: {
      fontSize: 32,
      fontFamily: theme.fonts.bold,
      color: theme.colors.primary,
    },
    heroLabel: {
      fontSize: 14,
      fontFamily: theme.fonts.medium,
      color: theme.colors.text.secondary,
      marginBottom: 4,
    },
    heroSub: {
      flexDirection: "row",
      marginBottom: 12,
      alignItems: "center",
    },
    heroSubTextOnly: {
      fontSize: 14,
      fontFamily: theme.fonts.regular,
      color: theme.colors.text.secondary,
    },
    tipPill: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: theme.colors.primary + "10",
      gap: 6,
    },
    tipPrefix: {
      fontSize: 12,
      fontFamily: theme.fonts.medium,
      color: theme.colors.primary,
    },
    tipText: {
      flex: 1,
      fontSize: 12,
      fontFamily: theme.fonts.regular,
      color: theme.colors.text.secondary,
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
