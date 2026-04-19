import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  AppState,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../contexts/ThemeContext";
import { useAuth } from "../contexts/AuthContext";
import { useAlert } from "../contexts/AlertContext";
import { Theme } from "../types";
import { useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import Svg, { Path } from "react-native-svg";
import {
  ChevronRightIcon,
  BrainIcon,
  FireIcon,
  SunIcon,
  StarIcon,
  NotificationSettingsIcon,
  NotificationIcon,
  NotificationActiveIcon,
  ChevronDownIcon,
  BookIcon,
  CalendarIcon,
  MobileIcon,
  SettingsIcon,
  LogoutIcon,
  KebabIcon,
  DeleteIcon,
  CompareIcon,
  ICONS,
} from "@/components/Icons";
import {
  ensureNotificationPermission,
  openAppSettings,
  getNotificationPermissionStatus,
} from "@/utils/notifications";
import { useFocusEffect } from "@react-navigation/native";
import { useContent } from "../hooks/useContent";
import { useTimetableUpload } from "../hooks/useTimetableUpload";

interface IconProps {
  color: string;
  size: number;
}

export default function Settings() {
  const { theme, isDark, toggleTheme } = useTheme();
  const { user, logout, updateProfileData } = useAuth();
  const { timetables, refresh, deleteTimetable } = useContent();
  const router = useRouter();
  const { showAlert } = useAlert();

  const [isNotificationExpanded, setIsNotificationExpanded] = useState(false);
  const [isFocusExpanded, setIsFocusExpanded] = useState(false);
  const [isUpdatingFocus, setIsUpdatingFocus] = useState(false);
  const [isSessionExpanded, setIsSessionExpanded] = useState(false);
  const [isUpdatingSession, setIsUpdatingSession] = useState(false);
  const [isModeExpanded, setIsModeExpanded] = useState(false);
  const [isUpdatingMode, setIsUpdatingMode] = useState(false);
  const [isReplacingTimetable, setIsReplacingTimetable] = useState(false);
  const [isDeletingTimetable, setIsDeletingTimetable] = useState(false);
  const [isTimetableSheetOpen, setIsTimetableSheetOpen] = useState(false);
  const [isTogglingNotifications, setIsTogglingNotifications] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    user?.studyPreferences?.notifications?.studyReminders ?? false,
  );

  const currentTimetable = timetables?.[0] ?? null;

  const formatUploadDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const { upload: uploadTimetable } = useTimetableUpload(
    user?.id,
    refresh,
    showAlert,
    setIsReplacingTimetable,
    undefined,
    currentTimetable
      ? {
          id: currentTimetable.id,
          remote_id: currentTimetable.remote_id ?? null,
        }
      : undefined,
  );

  const handleDelete = () => {
    if (!currentTimetable) return;
    showAlert({
      title: "Delete Timetable",
      message:
        "This will remove your current schedule. You'll need to re-upload to generate plans.",
      showCancel: true,
      confirmText: "Delete",
      iconColor: theme.colors.error,
      onConfirm: async () => {
        setIsDeletingTimetable(true);
        try {
          await deleteTimetable(
            String(currentTimetable.id),
            currentTimetable.remote_id ?? undefined,
          );
        } finally {
          setIsDeletingTimetable(false);
        }
      },
    });
  };

  // Re-sync both notification toggle and battery dot every time screen comes into focus.
  useFocusEffect(
    useCallback(() => {
      const syncStatuses = async () => {
        // Notification permission sync
        const permStatus = await getNotificationPermissionStatus();
        const userWantsNotifications =
          user?.studyPreferences?.notifications?.studyReminders ?? false;
        setNotificationsEnabled(
          permStatus === "granted" && userWantsNotifications,
        );
      };

      syncStatuses();
    }, [user?.studyPreferences?.notifications?.studyReminders]),
  );

  const MoonIcon: React.FC<IconProps> = ({ color, size }) => (
    <Svg width={size} height={size} viewBox="0 -960 960 960" fill="none">
      <Path
        d={
          isDark
            ? "M480-120q-150 0-255-105T120-480q0-150 105-255t255-105q14 0 27.5 1t26.5 3q-41 29-65.5 75.5T444-660q0 90 63 153t153 63q55 0 101-24.5t75-65.5q2 13 3 26.5t1 27.5q0 150-105 255T480-120Zm0-80q88 0 158-48.5T740-375q-20 5-40 8t-40 3q-123 0-209.5-86.5T364-660q0-20 3-40t8-40q-78 32-126.5 102T200-480q0 116 82 198t198 82Zm-10-270Z"
            : "M440-760v-160h80v160h-80Zm266 110-55-55 112-115 56 57-113 113Zm54 210v-80h160v80H760ZM440-40v-160h80v160h-80ZM254-652 140-763l57-56 113 113-56 54Zm508 512L651-255l54-54 114 110-57 59ZM40-440v-80h160v80H40Zm157 300-56-57 112-112 29 27 29 28-114 114Zm283-100q-100 0-170-70t-70-170q0-100 70-170t170-70q100 0 170 70t70 170q0 100-70 170t-170 70Zm0-80q66 0 113-47t47-113q0-66-47-113t-113-47q-66 0-113 47t-47 113q0 66 47 113t113 47Zm0-160Z"
        }
        fill={color}
      />
    </Svg>
  );

  const styles = createStyles(theme, isDark);

  const handleLogout = () => {
    showAlert({
      title: "Logout",
      message: "Are you sure you want to sign out of brAInwave?",
      showCancel: true,
      confirmText: "Log out",
      iconPath: ICONS.ERROR,
      iconColor: theme.colors.error,
      onConfirm: () => logout(),
    });
  };

  const getInitials = (name: string | undefined) => {
    if (!name) return "??";
    const parts = name.trim().split(" ");
    if (parts.length === 1) return parts[0].slice(0, 2).toLowerCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toLowerCase();
  };

  const handleNotificationToggle = async (value: boolean) => {
    if (!user) return;
    setIsTogglingNotifications(true);
    setNotificationsEnabled(value); // optimistic

    try {
      if (value) {
        const granted = await ensureNotificationPermission();

        if (!granted) {
          setNotificationsEnabled(false);
          showAlert({
            title: "Notifications Blocked",
            message:
              "brAInwave doesn't have permission to send notifications. Enable it in your phone settings.",
            confirmText: "Open Settings",
            iconColor: theme.colors.warning,
            showCancel: true,
            onConfirm: () => openAppSettings(),
          });
          return;
        }

        await updateProfileData({
          studyPreferences: {
            ...user.studyPreferences,
            notifications: {
              ...user.studyPreferences.notifications,
              studyReminders: true,
              assignmentDeadlines: true,
              goalAchievements: true,
              dailySummary: false,
            },
          },
        });
      } else {
        await updateProfileData({
          studyPreferences: {
            ...user.studyPreferences,
            notifications: {
              ...user.studyPreferences.notifications,
              studyReminders: false,
              assignmentDeadlines: false,
              goalAchievements: false,
              dailySummary: false,
            },
          },
        });
      }
    } catch (e) {
      console.error("Failed to update notification preference:", e);
      Toast.show({
        type: "error",
        text1: "Update Failed",
        text2: "Failed to update notification preference",
        position: "bottom",
        visibilityTime: 6000
      })
      setNotificationsEnabled(!value);
    } finally {
      setTimeout(() => setIsTogglingNotifications(false), 500);
    }
  };

  useEffect(() => {
    const subscription = AppState.addEventListener("change", async (nextState) => {
      if(nextState === "active"){
        const status = await getNotificationPermissionStatus();
        setNotificationsEnabled(status === "granted")
      }
    });
    return () => subscription.remove();
  }, []);

  const handleFocusUpdate = async (value: boolean) => {
    if (!user || user.studyPreferences.isMorningPerson === value) return;
    setIsUpdatingFocus(true);
    try {
      await updateProfileData({
        studyPreferences: { ...user.studyPreferences, isMorningPerson: value },
      });
      Toast.show({
        type: "success",
        text1: "Settings Updated",
        text2: `Peak focus window set to ${value ? "Early Bird" : "Night Owl"}`,
        position: "bottom",
      });
    } finally {
      setTimeout(() => setIsUpdatingFocus(false), 500);
    }
  };

  const handleSessionUpdate = async (length: "short" | "medium" | "long") => {
    if (!user || user.studyPreferences.preferredSessionLength === length)
      return;
    setIsUpdatingSession(true);
    try {
      await updateProfileData({
        studyPreferences: {
          ...user.studyPreferences,
          preferredSessionLength: length,
        },
      });
      Toast.show({
        type: "success",
        text1: "Settings Updated",
        text2: `Session length set to ${length.charAt(0).toUpperCase() + length.slice(1)}`,
        position: "bottom",
      });
    } finally {
      setTimeout(() => setIsUpdatingSession(false), 500);
    }
  };

  const handleModeUpdate = async (
    mode: "stay_consistent" | "exam_prep" | "catch_up",
  ) => {
    if (!user?.id) return;
    setIsUpdatingMode(true);
    try {
      await updateProfileData({
        studyPreferences: { ...user.studyPreferences, mode },
      });
      Toast.show({
        type: "success",
        text1: "Settings Updated",
        text2: `Study mode set to ${mode.charAt(0).toUpperCase() + mode.slice(1).replace("_", " ")}`,
        position: "bottom",
      });
    } finally {
      setTimeout(() => setIsUpdatingMode(false), 500);
    }
  };

  const handleLeadTimeUpdate = async (min: number) => {
    if (!user) return;
    if (user.studyPreferences.notificationLeadMinutes === min) return;
    try {
      await updateProfileData({
        studyPreferences: {
          ...user.studyPreferences,
          notificationLeadMinutes: min,
        },
      });
      Toast.show({
        type: "success",
        text1: "Settings Updated",
        text2: `Reminders set to ${min} minutes before`,
        position: "bottom",
      });
    } catch (e) {
      console.error(e);
      Toast.show({
        type: "error",
        text1: "Update Failed",
        text2: "Failed to update notification preference",
        position: "bottom",
        visibilityTime: 6000
      });
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Settings</Text>
          <Text style={styles.headerSubtitle}>
            Customize your study experience
          </Text>
        </View>
      </View>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          {/* Profile Card */}
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push("/(account)/profile")}
          >
            <View style={styles.profileContainer}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{getInitials(user?.name)}</Text>
              </View>
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>
                  {user?.name || "Alex johnson"}
                </Text>
              </View>
              <ChevronRightIcon color={theme.colors.text.secondary} size={28} />
            </View>
          </TouchableOpacity>

          {/* Notifications Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <NotificationSettingsIcon
                color={theme.colors.text.primary}
                size={22}
              />
              <Text style={styles.cardTitle}>Notifications</Text>
            </View>
            <View style={styles.cardContent}>
              {/* Enable / Disable Toggle */}
              <View style={styles.darkModeContainer}>
                <View style={styles.menuItemLeft}>
                  <NotificationIcon
                    color={theme.colors.text.secondary}
                    size={18}
                  />
                  <View style={styles.menuItemText}>
                    <Text style={styles.menuItemTitle}>
                      Enable Notifications
                    </Text>
                    <Text style={styles.menuItemSubtitle}>
                      {notificationsEnabled
                        ? "Reminders are on"
                        : "Tap to turn on reminders"}
                    </Text>
                  </View>
                </View>
                {isTogglingNotifications ? (
                  <ActivityIndicator
                    size="small"
                    color={theme.colors.primary}
                  />
                ) : (
                  <Switch
                    value={notificationsEnabled}
                    onValueChange={handleNotificationToggle}
                    trackColor={{
                      false: theme.colors.border,
                      true: theme.colors.primary,
                    }}
                    thumbColor={notificationsEnabled ? "#fff" : "#f4f3f4"}
                  />
                )}
              </View>

              {/* Lead Time - only shown when notifications are on */}
              {notificationsEnabled && (
                <>
                  <Separator theme={theme} />
                  <View style={styles.accordionContainer}>
                    <TouchableOpacity
                      style={styles.menuItem}
                      onPress={() =>
                        setIsNotificationExpanded(!isNotificationExpanded)
                      }
                    >
                      <View style={styles.menuItemLeft}>
                        <NotificationActiveIcon
                          color={theme.colors.text.secondary}
                          size={18}
                        />
                        <View style={styles.menuItemText}>
                          <Text style={styles.menuItemTitle}>
                            Notification Timing
                          </Text>
                          <Text style={styles.menuItemSubtitle}>
                            Notify me{" "}
                            {user?.studyPreferences.notificationLeadMinutes ??
                              10}{" "}
                            minutes before
                          </Text>
                        </View>
                      </View>
                      <View
                        style={{
                          transform: [
                            {
                              rotate: isNotificationExpanded
                                ? "180deg"
                                : "0deg",
                            },
                          ],
                        }}
                      >
                        <ChevronDownIcon
                          color={theme.colors.text.secondary}
                          size={24}
                        />
                      </View>
                    </TouchableOpacity>

                    {isNotificationExpanded && (
                      <View style={styles.expandedContent}>
                        <Text style={styles.helperText}>
                          Choose when to get notified before your next class:
                        </Text>
                        <View style={styles.segmentedControl}>
                          {[5, 10, 15, 30].map((min) => (
                            <TouchableOpacity
                              key={min}
                              style={[
                                styles.segment,
                                (user?.studyPreferences
                                  .notificationLeadMinutes ?? 10) === min &&
                                  styles.segmentActive,
                              ]}
                              onPress={() => handleLeadTimeUpdate(min)}
                            >
                              <Text
                                style={[
                                  styles.segmentText,
                                  (user?.studyPreferences
                                    .notificationLeadMinutes ?? 10) === min &&
                                    styles.segmentTextActive,
                                ]}
                              >
                                {min} min
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    )}
                  </View>
                </>
              )}
            </View>
          </View>

          {/* AI Optimizer Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <BrainIcon color={theme.colors.text.primary} size={22} />
              <Text style={styles.cardTitle}>Optimize your AI</Text>
            </View>

            <View style={styles.cardContent}>
              {/* Peak Focus Window */}
              <View style={styles.accordionContainer}>
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => setIsFocusExpanded(!isFocusExpanded)}
                  activeOpacity={0.7}
                >
                  <View style={styles.menuItemLeft}>
                    {user?.studyPreferences.isMorningPerson ? (
                      <SunIcon color={theme.colors.text.secondary} size={18} />
                    ) : (
                      <MoonIcon color={theme.colors.text.secondary} size={18} />
                    )}
                    <View style={styles.menuItemText}>
                      <Text style={styles.menuItemTitle}>
                        Peak Focus Window
                      </Text>
                      <Text style={styles.menuItemSubtitle}>
                        Currently:{" "}
                        {user?.studyPreferences.isMorningPerson
                          ? "Early Bird"
                          : "Night Owl"}
                      </Text>
                    </View>
                  </View>
                  <View
                    style={{
                      transform: [
                        { rotate: isFocusExpanded ? "180deg" : "0deg" },
                      ],
                    }}
                  >
                    <ChevronDownIcon
                      color={theme.colors.text.secondary}
                      size={24}
                    />
                  </View>
                </TouchableOpacity>

                {isFocusExpanded && (
                  <View style={styles.expandedContent}>
                    {isUpdatingFocus ? (
                      <View style={styles.miniLoader}>
                        <ActivityIndicator
                          color={theme.colors.primary}
                          size="small"
                        />
                        <Text style={styles.loadingText}>Syncing...</Text>
                      </View>
                    ) : (
                      <>
                        <Text style={styles.helperText}>
                          When are you most productive?
                        </Text>
                        <View style={styles.segmentedControl}>
                          <TouchableOpacity
                            style={[
                              styles.segment,
                              user?.studyPreferences.isMorningPerson &&
                                styles.segmentActive,
                            ]}
                            onPress={() => handleFocusUpdate(true)}
                          >
                            <Text
                              style={[
                                styles.segmentText,
                                user?.studyPreferences.isMorningPerson &&
                                  styles.segmentTextActive,
                              ]}
                            >
                              Morning
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[
                              styles.segment,
                              !user?.studyPreferences.isMorningPerson &&
                                styles.segmentActive,
                            ]}
                            onPress={() => handleFocusUpdate(false)}
                          >
                            <Text
                              style={[
                                styles.segmentText,
                                !user?.studyPreferences.isMorningPerson &&
                                  styles.segmentTextActive,
                              ]}
                            >
                              Night Owl
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </>
                    )}
                  </View>
                )}
              </View>

              <Separator theme={theme} />

              {/* Session Length */}
              <View style={styles.accordionContainer}>
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => setIsSessionExpanded(!isSessionExpanded)}
                  activeOpacity={0.7}
                >
                  <View style={styles.menuItemLeft}>
                    <FireIcon color={theme.colors.text.secondary} size={18} />
                    <View style={styles.menuItemText}>
                      <Text style={styles.menuItemTitle}>Session Length</Text>
                      <Text style={styles.menuItemSubtitle}>
                        Currently:{" "}
                        {user?.studyPreferences.preferredSessionLength ===
                        "short"
                          ? "Short (25m)"
                          : user?.studyPreferences.preferredSessionLength ===
                              "long"
                            ? "Long (90m)"
                            : "Medium (45m)"}
                      </Text>
                    </View>
                  </View>
                  <View
                    style={{
                      transform: [
                        { rotate: isSessionExpanded ? "180deg" : "0deg" },
                      ],
                    }}
                  >
                    <ChevronDownIcon
                      color={theme.colors.text.secondary}
                      size={24}
                    />
                  </View>
                </TouchableOpacity>

                {isSessionExpanded && (
                  <View style={styles.expandedContent}>
                    {isUpdatingSession ? (
                      <View style={styles.miniLoader}>
                        <ActivityIndicator
                          color={theme.colors.primary}
                          size="small"
                        />
                        <Text style={styles.loadingText}>Syncing...</Text>
                      </View>
                    ) : (
                      <>
                        <Text style={styles.helperText}>
                          Choose your preferred work sprint:
                        </Text>
                        <View style={styles.segmentedControl}>
                          {(["short", "medium", "long"] as const).map((len) => (
                            <TouchableOpacity
                              key={len}
                              style={[
                                styles.segment,
                                user?.studyPreferences
                                  .preferredSessionLength === len &&
                                  styles.segmentActive,
                              ]}
                              onPress={() => handleSessionUpdate(len)}
                            >
                              <Text
                                style={[
                                  styles.segmentText,
                                  user?.studyPreferences
                                    .preferredSessionLength === len &&
                                    styles.segmentTextActive,
                                ]}
                              >
                                {len.charAt(0).toUpperCase() + len.slice(1)}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </>
                    )}
                  </View>
                )}
              </View>

              <Separator theme={theme} />

              {/* Study Mode */}
              <View style={styles.accordionContainer}>
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => setIsModeExpanded(!isModeExpanded)}
                  activeOpacity={0.7}
                >
                  <View style={styles.menuItemLeft}>
                    <BookIcon color={theme.colors.text.secondary} size={18} />
                    <View style={styles.menuItemText}>
                      <Text style={styles.menuItemTitle}>Study Mode</Text>
                      <Text style={styles.menuItemSubtitle}>
                        Currently:{" "}
                        {user?.studyPreferences.mode === "stay_consistent"
                          ? "Stay Consistent"
                          : user?.studyPreferences.mode === "exam_prep"
                            ? "Exam Prep"
                            : "Catch Up"}
                      </Text>
                    </View>
                  </View>
                  <View
                    style={{
                      transform: [
                        { rotate: isModeExpanded ? "180deg" : "0deg" },
                      ],
                    }}
                  >
                    <ChevronDownIcon
                      color={theme.colors.text.secondary}
                      size={24}
                    />
                  </View>
                </TouchableOpacity>

                {isModeExpanded && (
                  <View style={styles.expandedContent}>
                    {isUpdatingMode ? (
                      <View style={styles.miniLoader}>
                        <ActivityIndicator
                          color={theme.colors.primary}
                          size="small"
                        />
                        <Text style={styles.loadingText}>Syncing...</Text>
                      </View>
                    ) : (
                      <>
                        <Text style={styles.helperText}>
                          Choose your current study mode:
                        </Text>
                        <View style={styles.segmentedControl}>
                          {(
                            [
                              "stay_consistent",
                              "exam_prep",
                              "catch_up",
                            ] as const
                          ).map((m) => (
                            <TouchableOpacity
                              key={m}
                              style={[
                                styles.segment,
                                user?.studyPreferences.mode === m &&
                                  styles.segmentActive,
                              ]}
                              onPress={() => handleModeUpdate(m)}
                            >
                              <Text
                                style={[
                                  styles.segmentText,
                                  user?.studyPreferences.mode === m &&
                                    styles.segmentTextActive,
                                ]}
                              >
                                {m === "stay_consistent"
                                  ? "Stay Consistent"
                                  : m === "exam_prep"
                                    ? "Exam Prep"
                                    : "Catch Up"}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </>
                    )}
                  </View>
                )}
              </View>

              <Separator theme={theme} />

              {/* Subject Priorities */}
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => router.push("/priorities")}
              >
                <View style={styles.menuItemLeft}>
                  <StarIcon color={theme.colors.text.secondary} size={18} />
                  <View style={styles.menuItemText}>
                    <Text style={styles.menuItemTitle}>Subject Priorities</Text>
                    <Text style={styles.menuItemSubtitle}>
                      Rank subjects by difficulty
                    </Text>
                  </View>
                </View>
                <ChevronRightIcon
                  color={theme.colors.text.secondary}
                  size={24}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* App Settings Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <MobileIcon color={theme.colors.text.primary} size={22} />
              <Text style={styles.cardTitle}>App settings</Text>
            </View>
            <View style={styles.cardContent}>
              <View style={styles.darkModeContainer}>
                <View style={styles.menuItemLeft}>
                  <MoonIcon color={theme.colors.text.secondary} size={18} />
                  <Text style={styles.menuItemTitle}>
                    {isDark ? "Dark" : "Light"} mode
                  </Text>
                </View>
                <Switch
                  value={isDark}
                  onValueChange={toggleTheme}
                  trackColor={{
                    false: theme.colors.border,
                    true: theme.colors.primary,
                  }}
                  thumbColor={isDark ? "#fff" : "#f4f3f4"}
                />
              </View>

              <Separator theme={theme} />

              <View style={styles.menuItem}>
                <View style={styles.menuItemLeft}>
                  <CalendarIcon color={theme.colors.text.secondary} size={18} />
                  <View style={styles.menuItemText}>
                    <Text style={styles.menuItemTitle}>Timetable</Text>
                    <Text style={styles.menuItemSubtitle}>
                      {currentTimetable
                        ? `Uploaded ${formatUploadDate(currentTimetable.created_at)}`
                        : "No timetable uploaded"}
                    </Text>
                  </View>
                </View>
                {currentTimetable && (
                  isReplacingTimetable || isDeletingTimetable ? (
                    <ActivityIndicator size="small" color={isReplacingTimetable ? theme.colors.primary : theme.colors.error} />
                  ) : (
                    <TouchableOpacity onPress={() => setIsTimetableSheetOpen(true)} hitSlop={8}>
                      <KebabIcon color={theme.colors.text.secondary} size={20} />
                    </TouchableOpacity>
                  )
                )}
              </View>
            </View>
          </View>

          {/* Support Card */}
          <View style={styles.card}>
            <TouchableOpacity style={styles.supportButton}>
              <SettingsIcon color={theme.colors.text.secondary} size={18} />
              <Text style={styles.supportButtonText}>Help & support</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.supportButton, styles.logoutButton]}
              onPress={handleLogout}
            >
              <LogoutIcon color={theme.colors.error} size={20} />
              <Text style={[styles.supportButtonText, styles.logoutButtonText]}>
                Log out
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.version}>brAInwave v1.0.0</Text>
        </View>
      </ScrollView>

      <Modal
        visible={isTimetableSheetOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsTimetableSheetOpen(false)}
      >
        <TouchableOpacity
          style={styles.sheetBackdrop}
          activeOpacity={1}
          onPress={() => setIsTimetableSheetOpen(false)}
        />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <TouchableOpacity
            style={styles.sheetRow}
            onPress={() => { setIsTimetableSheetOpen(false); uploadTimetable(); }}
          >
            <CompareIcon color={theme.colors.primary} size={20} />
            <Text style={[styles.sheetRowText, { color: theme.colors.text.primary }]}>Replace</Text>
          </TouchableOpacity>
          <View style={{ height: 1, backgroundColor: theme.colors.border }} />
          <TouchableOpacity
            style={styles.sheetRow}
            onPress={() => { setIsTimetableSheetOpen(false); handleDelete(); }}
          >
            <DeleteIcon color={theme.colors.error} size={20} />
            <Text style={[styles.sheetRowText, { color: theme.colors.error }]}>Delete</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

interface SeparatorProps {
  theme: Theme;
}

const Separator: React.FC<SeparatorProps> = ({ theme }) => (
  <View
    style={{
      height: 1,
      backgroundColor: theme.colors.border,
      marginVertical: 12,
    }}
  />
);

const createStyles = (theme: Theme, isDark: boolean) =>
  StyleSheet.create({
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
    content: { padding: theme.spacing.lg, paddingBottom: 100 },
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: 16,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 2,
    },
    profileContainer: { flexDirection: "row", alignItems: "center", gap: 16 },
    avatar: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: theme.colors.primary,
      justifyContent: "center",
      alignItems: "center",
    },
    avatarText: {
      fontSize: 18,
      fontFamily: theme.fonts.semiBold,
      color: theme.colors.text.primary,
      textTransform: "uppercase",
    },
    profileInfo: { flex: 1 },
    profileName: {
      fontSize: 18,
      fontFamily: theme.fonts.semiBold,
      color: theme.colors.text.primary,
      marginBottom: 4,
    },
    cardHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: theme.spacing.md,
    },
    cardTitle: {
      fontSize: 18,
      fontFamily: theme.fonts.semiBold,
      color: theme.colors.text.primary,
    },
    cardContent: { gap: 0 },
    helperText: {
      alignSelf: "center",
      fontSize: 12,
      color: theme.colors.text.secondary,
      marginTop: 2,
    },
    segmentedControl: {
      flexDirection: "row",
      backgroundColor: isDark ? theme.colors.border + "50" : "#F0F0F0",
      borderRadius: 10,
      padding: 4,
      marginTop: 4,
    },
    segment: {
      flex: 1,
      paddingVertical: 8,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 8,
    },
    segmentActive: {
      backgroundColor: isDark ? theme.colors.primary : theme.colors.surface,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    segmentText: {
      fontSize: 14,
      fontWeight: "500",
      color: theme.colors.text.secondary,
    },
    segmentTextActive: {
      color: isDark ? theme.colors.secondary : theme.colors.primary,
      fontWeight: "600",
    },
    menuItem: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: theme.spacing.xs,
      borderRadius: 12,
      marginBottom: theme.spacing.xs,
    },
    menuItemLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      flex: 1,
    },
    menuItemText: { flex: 1 },
    menuItemTitle: {
      fontSize: 14,
      fontFamily: theme.fonts.medium,
      color: theme.colors.text.primary,
      marginBottom: 2,
    },
    menuItemSubtitle: {
      fontSize: 12,
      fontFamily: theme.fonts.regular,
      color: theme.colors.text.secondary,
    },
    darkModeContainer: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 4,
    },
    menuItemButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 8,
    },
    supportButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: theme.spacing.sm,
      borderRadius: 12,
    },
    supportButtonText: {
      fontSize: 14,
      fontFamily: theme.fonts.medium,
      color: theme.colors.text.primary,
    },
    logoutButton: { marginTop: 4 },
    logoutButtonText: { color: theme.colors.error },
    version: {
      fontSize: 12,
      fontFamily: theme.fonts.regular,
      color: theme.colors.text.secondary,
      textAlign: "center",
      paddingVertical: theme.spacing.lg,
      marginBottom: -67,
    },
    sheetBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.4)",
    },
    sheet: {
      backgroundColor: theme.colors.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: 20,
      paddingBottom: 36,
      paddingTop: 12,
      borderWidth: 1,
      borderBottomWidth: 0,
      borderColor: theme.colors.border,
    },
    sheetHandle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.colors.border,
      alignSelf: "center",
      marginBottom: 16,
    },
    sheetRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      paddingVertical: 16,
    },
    sheetRowText: {
      fontSize: 15,
      fontFamily: theme.fonts.medium,
    },
    accordionContainer: { width: "100%" },
    expandedContent: {
      paddingHorizontal: 12,
      paddingBottom: 16,
      paddingTop: 4,
      backgroundColor: isDark ? theme.colors.border + "20" : "#F9F9F9",
      borderRadius: 12,
      marginTop: -4,
    },
    miniLoader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 8,
      gap: 10,
    },
    loadingText: {
      fontSize: 13,
      color: theme.colors.text.secondary,
      fontStyle: "italic",
    },
  });
