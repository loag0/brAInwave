import React, { useState, useCallback, useEffect } from "react";
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
import { useTheme } from "../contexts/ThemeContext";
import { useAuth } from "../contexts/AuthContext";
import { useAlert } from "../contexts/AlertContext";
import { Theme } from "../types";
import Svg, { Path } from "react-native-svg";
import { useContent } from "../hooks/useContent";
import { router } from "expo-router";
import Skeleton from "@/components/HomeSkeleton";
import { useTodaySchedule } from "../hooks/useTodaySchedule";
import { useTimetableUpload } from "../hooks/useTimetableUpload";
import { useNextClass } from "../hooks/useNextClass";
import { ensureNotificationPermission, scheduleNextClassNotification } from "@/utils/notifications";

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

const SunIcon: React.FC<IconProps> = ({ size, color }) => (
  <Svg width={size} height={size} viewBox="0, -960, 960, 960" fill="none">
    <Path
      d="M440-760v-160h80v160h-80Zm266 110-55-55 112-115 56 57-113 113Zm54 210v-80h160v80H760ZM440-40v-160h80v160h-80ZM254-652 140-763l57-56 113 113-56 54Zm508 512L651-255l54-54 114 110-57 59ZM40-440v-80h160v80H40Zm157 300-56-57 112-112 29 27 29 28-114 114Zm283-100q-100 0-170-70t-70-170q0-100 70-170t170-70q100 0 170 70t70 170q0 100-70 170t-170 70Zm0-80q66 0 113-47t47-113q0-66-47-113t-113-47q-66 0-113 47t-47 113q0 66 47 113t113 47Zm0-160Z"
      fill={color}
    />
  </Svg>
);

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
  const [assignments, setAssignments] = useState<any[]>([]);

  const {
    timetables,
    plans,
    isLoading: contentLoading,
    refresh,
  } = useContent();

  const [isLoading, setIsLoading] = useState(false);
  const [showUploadMenu, setShowUploadMenu] = useState(false);
  const [checkedAssignments, setCheckedAssignments] = useState<number[]>([]);
  const hasTimetable = timetables.length > 0;
  
  const leadMinutes = user?.studyPreferences.notificationLeadMinutes ?? 10;
    if(user?.studyPreferences.notifications?.studyReminders && useNextClass){
      scheduleNextClassNotification(useNextClass, leadMinutes)
    }

  const styles = createStyles(theme, isDark);
  // 1. LISTEN TO FIRESTORE ON MOUNT

  const todaysSchedule = useTodaySchedule(
    plans,
    timetables,
    user?.id,
    contentLoading,
  );

  const { upload } = useTimetableUpload(
    user?.id,
    refresh,
    showAlert,
  );
 const onRefresh = useCallback(async () => {
   setRefreshing(true);
   try {
     if (refresh) await refresh(true);
     setRefreshing(false);
   } catch (error) {
     console.error("Refresh failed", error);
   } finally {
     setRefreshing(false);
   }
}, [refresh]);

const { nextClass, countdown } = useNextClass(todaysSchedule);

useEffect(() => {
  if(!user) return;
  if (!nextClass) return;

  (async () => {
    const allowed = await ensureNotificationPermission();
    if (!allowed) return;

    await scheduleNextClassNotification(
      nextClass,
      user.studyPreferences.notificationLeadMinutes,
    );
  })();
}, [nextClass, user, user?.studyPreferences.notificationLeadMinutes]);

  function toggleAssignment(id: number) {
    setCheckedAssignments((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }

  const aiTips = [
    "Take a 5-min stretch break every hour 🧘‍♂️",
    "Focus on high-priority tasks first 🔥",
    "Stay hydrated! 💧",
  ];
  const randomTip = aiTips[Math.floor(Math.random() * aiTips.length)];

  function getPriorityColor(priority: string) {
    const p = priority?.toLowerCase();
    if (p === "high") return theme.colors.error;
    if (p === "medium") return theme.colors.warning;
    return theme.colors.text.secondary;
  }

  const AddIcon: React.FC<IconProps> = ({ size, color }) => (
    <Svg width={size} height={size} viewBox="0 -960 960 960" fill="none">
      <Path
        d="M440-440H200v-80h240v-240h80v240h240v80H520v240h-80v-240Z"
        fill={color}
      />
    </Svg>
  );

  const TodayIcon: React.FC<IconProps> = ({ size, color }) => (
    <Svg width={size} height={size} viewBox="0 -960 960 960" fill={color}>
      <Path
        d="M360-300q-42 0-71-29t-29-71q0-42 29-71t71-29q42 0 71 29t29 71q0 42-29 71t-71 29ZM200-80q-33 0-56.5-23.5T120-160v-560q0-33 23.5-56.5T200-800h40v-80h80v80h320v-80h80v80h40q33 0 56.5 23.5T840-720v560q0 33-23.5 56.5T760-80H200Zm0-80h560v-400H200v400Zm0-480h560v-80H200v80Zm0 0v-80 80Z"
        fill={color}
      />
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

  const CheckIcon: React.FC<IconProps> = ({ size, color }) => (
    <Svg width={size} height={size} viewBox="0 -960 960 960" fill="none">
      <Path
        d="M382-240 154-468l57-57 171 171 367-367 57 57-424 424Z"
        fill={color}
      />
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

   if (contentLoading && timetables.length === 0) {
     return <HomeSkeleton styles={styles} theme={theme} />;
   }

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      {/*LOADING OVERLAY*/}
      {(isLoading || contentLoading) && (
        <View style={styles.loaderOverlay}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.dateText, { marginTop: 10 }]}>
            Analyzing your schedule...
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

        {/* Daily Summary */}
        <View style={styles.content}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Today's Summary</Text>
            <View style={{ paddingVertical: 10 }}>
              <Text>
                Tasks Remaining:{" "}
                {todaysSchedule.filter((t) => !t.completed).length}
              </Text>
              {nextClass ? (
                <View>
                  <Text>{nextClass.title || nextClass.subject}</Text>
                  <Text>starts in {countdown}</Text>
                </View>
              ) : (
                <Text>No more classes today</Text>
              )}
            </View>
          </View>
        </View>

        {/* AI Tip */}
        <View style={styles.content}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Tip of the Day</Text>
            <View style={{ paddingVertical: 10 }}>
              <Text>{randomTip}</Text>
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

              {/*Only shows the view all button if there is a template OR an optimized plan*/}
              {(hasTimetable || todaysSchedule.length > 0) && (
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
                        {item.subject ||
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
                          {item.time || item.duration || "No time"}
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
                  {!hasTimetable ? (
                    // 2. No timetable uploaded yet
                    <Text style={styles.emptyText}>
                      No timetable yet. Upload one to get started!
                    </Text>
                  ) : (
                    // 3. Timetable exists, but today is empty (Weekend/Free Day)
                    <>
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
                        style={[
                          styles.emptyText,
                          { marginTop: -15, fontSize: 10 },
                        ]}
                      >
                        Enjoy your{" "}
                        {new Date().toLocaleDateString("en-US", {
                          weekday: "long",
                        })}
                      </Text>
                    </>
                  )}
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
          }}
        />
      )}
    </SafeAreaView>
  );
}

// UPLOAD MENU COMPONENT
const UploadMenu = ({ theme, onClose, onSelectOption }: any) => {
  const CalendarIcon: React.FC<IconProps> = ({ size, color }) => (
    <Svg width={size} height={size} viewBox="0 -960 960 960" fill="none">
      <Path
        d="M200-80q-33 0-56.5-23.5T120-160v-560q0-33 23.5-56.5T200-800h40v-80h80v80h320v-80h80v80h40q33 0 56.5 23.5T840-720v560q0 33-23.5 56.5T760-80H200Zm0-80h560v-400H200v400Zm0-480h560v-80H200v80Zm0 0v-80 80Zm280 240q-17 0-28.5-11.5T440-440q0-17 11.5-28.5T480-480q17 0 28.5 11.5T520-440q0 17-11.5 28.5T480-400Zm-160 0q-17 0-28.5-11.5T280-440q0-17 11.5-28.5T320-480q17 0 28.5 11.5T360-440q0 17-11.5 28.5T320-400Zm320 0q-17 0-28.5-11.5T600-440q0-17 11.5-28.5T640-480q17 0 28.5 11.5T680-440q0 17-11.5 28.5T640-400ZM480-240q-17 0-28.5-11.5T440-280q0-17 11.5-28.5T480-320q17 0 28.5 11.5T520-280q0 17-11.5 28.5T480-240Zm-160 0q-17 0-28.5-11.5T280-280q0-17 11.5-28.5T320-320q17 0 28.5 11.5T360-280q0 17-11.5 28.5T320-240Zm320 0q-17 0-28.5-11.5T600-280q0-17 11.5-28.5T640-320q17 0 28.5 11.5T680-280q0 17-11.5 28.5T640-240Z"
        fill={color}
      />
    </Svg>
  );

  const UploadSyllabusIcon: React.FC<IconProps> = ({ size, color }) => (
    <Svg width={size} height={size} viewBox="0 -960 960 960" fill="none">
      <Path
        d="M320-440h320v-80H320v80Zm0 120h320v-80H320v80Zm0 120h200v-80H320v80ZM240-80q-33 0-56.5-23.5T160-160v-640q0-33 23.5-56.5T240-880h320l240 240v480q0 33-23.5 56.5T720-80H240Zm280-520v-200H240v640h480v-440H520ZM240-800v200-200 640-640Z"
        fill={color}
      />
    </Svg>
  );

  const AddAssignmentIcon: React.FC<IconProps> = ({ size, color }) => (
    <Svg width={size} height={size} viewBox="0 -960 960 960" fill="none">
      <Path
        d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v268q-19-9-39-15.5t-41-9.5v-243H200v560h242q3 22 9.5 42t15.5 38H200Zm0-120v40-560 243-3 280Zm80-40h163q3-21 9.5-41t14.5-39H280v80Zm0-160h244q32-30 71.5-50t84.5-27v-3H280v80Zm0-160h400v-80H280v80ZM720-40q-83 0-141.5-58.5T520-240q0-83 58.5-141.5T720-440q83 0 141.5 58.5T920-240q0 83-58.5 141.5T720-40Zm-20-80h40v-100h100v-40H740v-100h-40v100H600v40h100v100Z"
        fill={color}
      />
    </Svg>
  );

  const UploadNotesIcon: React.FC<IconProps> = ({ size, color }) => (
    <Svg width={size} height={size} viewBox="0 -960 960 960" fill="none">
      <Path
        d="M440-240h80v-120h120v-80H520v-120h-80v120H320v80h120v120ZM240-80q-33 0-56.5-23.5T160-160v-640q0-33 23.5-56.5T240-880h320l240 240v480q0 33-23.5 56.5T720-80H240Zm280-520v-200H240v640h480v-440H520ZM240-800v200-200 640-640Z"
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
      description: "Create a new task",
    },
    {
      id: "notes",
      Icon: UploadNotesIcon,
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
    content: { padding: 24},
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
