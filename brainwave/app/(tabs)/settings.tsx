import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../contexts/ThemeContext";
import { useAuth } from "../contexts/AuthContext";
import { useAlert } from "../contexts/AlertContext";
import { Theme } from "../types";
import { useRouter } from "expo-router";
import Svg, { Path } from "react-native-svg";

interface IconProps {
  color: string;
  size: number;
}

const ChevronRight: React.FC<IconProps> = ({ color, size }) => (
  <Svg width={size} height={size} viewBox="0 -960 960 960" fill="none">
    <Path d="M504-480 320-664l56-56 240 240-240 240-56-56 184-184Z" fill={color} />
  </Svg>
);

const NotificationIcon: React.FC<IconProps> = ({ color, size }) => (
  <Svg width={size} height={size} viewBox="0 -960 960 960" fill="none">
    <Path
      d="M160-200v-80h80v-280q0-83 50-147.5T420-792v-28q0-25 17.5-42.5T480-880q25 0 42.5 17.5T540-820v28q80 20 130 84.5T720-560v280h80v80H160Zm320-300Zm0 420q-33 0-56.5-23.5T400-160h160q0 33-23.5 56.5T480-80ZM320-280h320v-280q0-66-47-113t-113-47q-66 0-113 47t-47 113v280Z"
      fill={color}
    />
  </Svg>
);

const BookIcon: React.FC<IconProps> = ({ color, size }) => (
  <Svg width={size} height={size} viewBox="0 -960 960 960" fill="none">
    <Path
      d="M240-80q-33 0-56.5-23.5T160-160v-640q0-33 23.5-56.5T240-880h480q33 0 56.5 23.5T800-800v640q0 33-23.5 56.5T720-80H240Zm0-80h480v-640h-80v280l-100-60-100 60v-280H240v640Zm0 0v-640 640Zm200-360 100-60 100 60-100-60-100 60Z"
      fill={color} />
  </Svg>
);

const ScheduleIcon: React.FC<IconProps> = ({ color, size }) => (
  <Svg width={size} height={size} viewBox="0 -960 960 960" fill="none">
    <Path
      d="m612-292 56-56-148-148v-184h-80v216l172 172ZM480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-400Zm0 320q133 0 226.5-93.5T800-480q0-133-93.5-226.5T480-800q-133 0-226.5 93.5T160-480q0 133 93.5 226.5T480-160Z"
      fill={color} />
  </Svg>
);

const AssignmentIcon: React.FC<IconProps> = ({ color, size }) => (
  <Svg width={size} height={size} viewBox="0 -960 960 960" fill="none">
    <Path
      d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h168q13-36 43.5-58t68.5-22q38 0 68.5 22t43.5 58h168q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm0-80h560v-560H200v560Zm80-80h280v-80H280v80Zm0-160h400v-80H280v80Zm0-160h400v-80H280v80Zm200-190q13 0 21.5-8.5T510-820q0-13-8.5-21.5T480-850q-13 0-21.5 8.5T450-820q0 13 8.5 21.5T480-790ZM200-200v-560 560Z"
      fill={color} />
  </Svg>
);

const CheckeredFlag: React.FC<IconProps> = ({ color, size }) => (
  <Svg width={size} height={size} viewBox="0 -960 960 960" fill="none">
    <Path
      d="M360-720h80v-80h-80v80Zm160 0v-80h80v80h-80ZM360-400v-80h80v80h-80Zm320-160v-80h80v80h-80Zm0 160v-80h80v80h-80Zm-160 0v-80h80v80h-80Zm160-320v-80h80v80h-80Zm-240 80v-80h80v80h-80ZM200-160v-640h80v80h80v80h-80v80h80v80h-80v320h-80Zm400-320v-80h80v80h-80Zm-160 0v-80h80v80h-80Zm-80-80v-80h80v80h-80Zm160 0v-80h80v80h-80Zm80-80v-80h80v80h-80Z"
      fill={color} />
  </Svg>
);

const EnvelopeIcon: React.FC<IconProps> = ({ color, size }) => (
  <Svg width={size} height={size} viewBox="0 -960 960 960" fill="none">
    <Path
      d="M160-160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h640q33 0 56.5 23.5T880-720v480q0 33-23.5 56.5T800-160H160Zm320-280L160-640v400h640v-400L480-440Zm0-80 320-200H160l320 200ZM160-640v-80 480-400Z"
      fill={color} />
  </Svg>
);

const LockIcon: React.FC<IconProps> = ({ color, size }) => (
  <Svg width={size} height={size} viewBox="0 -960 960 960" fill="none">
    <Path
      d="M240-80q-33 0-56.5-23.5T160-160v-400q0-33 23.5-56.5T240-640h40v-80q0-83 58.5-141.5T480-920q83 0 141.5 58.5T680-720v80h40q33 0 56.5 23.5T800-560v400q0 33-23.5 56.5T720-80H240Zm0-80h480v-400H240v400Zm240-120q33 0 56.5-23.5T560-360q0-33-23.5-56.5T480-440q-33 0-56.5 23.5T400-360q0 33 23.5 56.5T480-280ZM360-640h240v-80q0-50-35-85t-85-35q-50 0-85 35t-35 85v80ZM240-160v-400 400Z"
      fill={color} />
  </Svg>
);

const MobileIcon: React.FC<IconProps> = ({ color, size }) => (
  <Svg width={size} height={size} viewBox="0 -960 960 960" fill="none">
    <Path
      d="M280-40q-33 0-56.5-23.5T200-120v-720q0-33 23.5-56.5T280-920h400q33 0 56.5 23.5T760-840v124q18 7 29 22t11 34v80q0 19-11 34t-29 22v404q0 33-23.5 56.5T680-40H280Zm0-80h400v-720H280v720Zm0 0v-720 720Zm160-200h80l6-50q8-3 14-6.5t12-9.5l46 20 40-70-40-30q2-8 2-15t-2-15l40-30-42-68-44 18q-6-5-12-8t-14-6l-6-50h-80l-6 50q-8 3-14 6t-12 8l-44-18-42 68 40 30q-2 8-2 15t2 15l-40 30 40 70 46-20q6 6 12 9.5t14 6.5l6 50Zm40-100q-26 0-43-17t-17-43q0-26 17-43t43-17q26 0 43 17t17 43q0 26-17 43t-43 17Z"
      fill={color}
    />
  </Svg>
);

const SettingsIcon: React.FC<IconProps> = ({ color, size }) => (
  <Svg width={size} height={size} viewBox="0 -960 960 960" fill="none">
    <Path 
      d="m370-80-16-128q-13-5-24.5-12T307-235l-119 50L78-375l103-78q-1-7-1-13.5v-27q0-6.5 1-13.5L78-585l110-190 119 50q11-8 23-15t24-12l16-128h220l16 128q13 5 24.5 12t22.5 15l119-50 110 190-103 78q1 7 1 13.5v27q0 6.5-2 13.5l103 78-110 190-118-50q-11 8-23 15t-24 12L590-80H370Zm70-80h79l14-106q31-8 57.5-23.5T639-327l99 41 39-68-86-65q5-14 7-29.5t2-31.5q0-16-2-31.5t-7-29.5l86-65-39-68-99 42q-22-23-48.5-38.5T533-694l-13-106h-79l-14 106q-31 8-57.5 23.5T321-633l-99-41-39 68 86 64q-5 15-7 30t-2 32q0 16 2 31t7 30l-86 65 39 68 99-42q22 23 48.5 38.5T427-266l13 106Zm42-180q58 0 99-41t41-99q0-58-41-99t-99-41q-59 0-99.5 41T342-480q0 58 40.5 99t99.5 41Zm-2-140Z"
      fill={color} />
  </Svg>
);

const LogoutIcon: React.FC<IconProps> = ({ color, size }) => (
  <Svg width={size} height={size} viewBox="0 -960 960 960" fill="none">
    <Path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h280v80H200v560h280v80H200Zm440-160-55-58 102-102H360v-80h327L585-622l55-58 200 200-200 200Z"
    fill={color} />
  </Svg>
);

export default function Profile() {
  const { theme, isDark, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const router = useRouter();
  const { showAlert } = useAlert();

  const MoonIcon: React.FC<IconProps> = ({ color, size }) => (
    <Svg width={size} height={size} viewBox="0 -960 960 960" fill="none">
      <Path
        d={isDark ? 
          "M480-120q-150 0-255-105T120-480q0-150 105-255t255-105q14 0 27.5 1t26.5 3q-41 29-65.5 75.5T444-660q0 90 63 153t153 63q55 0 101-24.5t75-65.5q2 13 3 26.5t1 27.5q0 150-105 255T480-120Zm0-80q88 0 158-48.5T740-375q-20 5-40 8t-40 3q-123 0-209.5-86.5T364-660q0-20 3-40t8-40q-78 32-126.5 102T200-480q0 116 82 198t198 82Zm-10-270Z" 
          : 
          "M440-760v-160h80v160h-80Zm266 110-55-55 112-115 56 57-113 113Zm54 210v-80h160v80H760ZM440-40v-160h80v160h-80ZM254-652 140-763l57-56 113 113-56 54Zm508 512L651-255l54-54 114 110-57 59ZM40-440v-80h160v80H40Zm157 300-56-57 112-112 29 27 29 28-114 114Zm283-100q-100 0-170-70t-70-170q0-100 70-170t170-70q100 0 170 70t70 170q0 100-70 170t-170 70Zm0-80q66 0 113-47t47-113q0-66-47-113t-113-47q-66 0-113 47t-47 113q0 66 47 113t113 47Zm0-160Z"
        }
        fill={color}
      />
    </Svg>
  );

  const [notifications, setNotifications] = useState({
    studyReminders: true,
    assignmentDeadlines: true,
    goalAchievements: true,
    dailySummary: false,
  });

  const styles = createStyles(theme);

  const handleLogout = () => {
    showAlert({
      title: "Logout",
      message: "Are you sure you want to sign out of brAInwave?",
      showCancel: true,
      confirmText: "Log out",
      onConfirm: () => logout(),
    });
  };

  const getInitials = (name: string | undefined) => {
    if (!name) return "aj";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toLowerCase()
      .slice(0, 2);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Settings</Text>
            <Text style={styles.headerSubtitle}>
              Customize your study experience
            </Text>
          </View>
        </View>

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
              <ChevronRight color={theme.colors.text.secondary} size={28} />
            </View>
          </TouchableOpacity>

          {/* Notifications Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <NotificationIcon color={theme.colors.text.primary} size={22} />
              <Text style={styles.cardTitle}>Notifications</Text>
            </View>
            <View style={styles.cardContent}>
              <SettingItem
                theme={theme}
                label="Study reminders"
                description="Get notified before study sessions"
                value={notifications.studyReminders}
                onValueChange={(val) =>
                  setNotifications({ ...notifications, studyReminders: val })
                }
              />
              <Separator theme={theme} />
              <SettingItem
                theme={theme}
                label="Assignment deadlines"
                description="Alerts for upcoming due dates"
                value={notifications.assignmentDeadlines}
                onValueChange={(val) =>
                  setNotifications({
                    ...notifications,
                    assignmentDeadlines: val,
                  })
                }
              />
              <Separator theme={theme} />
              <SettingItem
                theme={theme}
                label="Goal achievements"
                description="Celebrate your milestones"
                value={notifications.goalAchievements}
                onValueChange={(val) =>
                  setNotifications({ ...notifications, goalAchievements: val })
                }
              />
              <Separator theme={theme} />
              <SettingItem
                theme={theme}
                label="Daily summary"
                description="End-of-day progress report"
                value={notifications.dailySummary}
                onValueChange={(val) =>
                  setNotifications({ ...notifications, dailySummary: val })
                }
              />
            </View>
          </View>

          {/* Study Preferences Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <BookIcon color={theme.colors.text.primary} size={22} />
              <Text style={styles.cardTitle}>Study preferences</Text>
            </View>
            <View style={styles.cardContent}>
              <TouchableOpacity style={styles.menuItem}>
                <View style={styles.menuItemLeft}>
                  <ScheduleIcon color={theme.colors.text.secondary} size={18} />
                  <View style={styles.menuItemText}>
                    <Text style={styles.menuItemTitle}>Session duration</Text>
                    <Text style={styles.menuItemSubtitle}>45 minutes</Text>
                  </View>
                </View>
                <ChevronRight color={theme.colors.text.secondary} size={28} />
              </TouchableOpacity>

              <Separator theme={theme} />

              <TouchableOpacity style={styles.menuItem}>
                <View style={styles.menuItemLeft}>
                  <AssignmentIcon
                    color={theme.colors.text.secondary}
                    size={18}
                  />
                  <View style={styles.menuItemText}>
                    <Text style={styles.menuItemTitle}>Subjects & classes</Text>
                    <Text style={styles.menuItemSubtitle}>
                      4 active subjects
                    </Text>
                  </View>
                </View>
                <ChevronRight color={theme.colors.text.secondary} size={28} />
              </TouchableOpacity>

              <Separator theme={theme} />

              <TouchableOpacity style={styles.menuItem}>
                <View style={styles.menuItemLeft}>
                  <CheckeredFlag
                    color={theme.colors.text.secondary}
                    size={18}
                  />
                  <View style={styles.menuItemText}>
                    <Text style={styles.menuItemTitle}>Study hours goal</Text>
                    <Text style={styles.menuItemSubtitle}>4 hours per day</Text>
                  </View>
                </View>
                <ChevronRight color={theme.colors.text.secondary} size={28} />
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

              <TouchableOpacity style={styles.menuItemButton}>
                <View style={styles.menuItemLeft}>
                  <EnvelopeIcon color={theme.colors.text.secondary} size={18} />
                  <Text style={styles.menuItemTitle}>Email preferences</Text>
                </View>
                <ChevronRight color={theme.colors.text.secondary} size={28} />
              </TouchableOpacity>

              <Separator theme={theme} />

              <TouchableOpacity style={styles.menuItemButton}>
                <View style={styles.menuItemLeft}>
                  <LockIcon color={theme.colors.text.secondary} size={18} />
                  <Text style={styles.menuItemTitle}>Privacy & Security</Text>
                </View>
                <ChevronRight color={theme.colors.text.secondary} size={28} />
              </TouchableOpacity>
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
              onPress={handleLogout}>
              <LogoutIcon color={theme.colors.error} size={20} />
              <Text style={[styles.supportButtonText, styles.logoutButtonText]}>
                Log out
              </Text>
            </TouchableOpacity>
          </View>

          {/* Version */}
          <Text style={styles.version}>brAInwave v1.0.0</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// Separator Component
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

// Setting Item Component (for toggles)
interface SettingItemProps {
  theme: Theme;
  label: string;
  description: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}

const SettingItem: React.FC<SettingItemProps> = ({
  theme,
  label,
  description,
  value,
  onValueChange,
}) => {
  const itemStyles = StyleSheet.create({
    container: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    textContainer: {
      flex: 1,
      marginRight: 12,
    },
    label: {
      fontSize: 14,
      fontFamily: theme.fonts.medium,
      color: theme.colors.text.primary,
      marginBottom: 2,
    },
    description: {
      fontSize: 12,
      fontFamily: theme.fonts.regular,
      color: theme.colors.text.secondary,
    },
  });

  return (
    <View style={itemStyles.container}>
      <View style={itemStyles.textContainer}>
        <Text style={itemStyles.label}>{label}</Text>
        <Text style={itemStyles.description}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{
          false: theme.colors.border,
          true: theme.colors.primary,
        }}
        thumbColor={value ? "#fff" : "#f4f3f4"}
      />
    </View>
  );
};

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
    content: {
      padding: theme.spacing.lg,
      paddingBottom: 100,
    },
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
    profileContainer: {
      flexDirection: "row",
      alignItems: "center",
      gap: 16,
    },
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
    profileInfo: {
      flex: 1,
    },
    profileName: {
      fontSize: 18,
      fontFamily: theme.fonts.semiBold,
      color: theme.colors.text.primary,
      marginBottom: 4,
    },
    profileSubtitle: {
      fontSize: 14,
      fontFamily: theme.fonts.regular,
      color: theme.colors.text.secondary,
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
    cardContent: {
      gap: 0,
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
    menuItemText: {
      flex: 1,
    },
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
    logoutButton: {
      marginTop: 4,
    },
    logoutButtonText: {
      color: theme.colors.error,
    },
    version: {
      fontSize: 12,
      fontFamily: theme.fonts.regular,
      color: theme.colors.text.secondary,
      textAlign: "center",
      paddingVertical: theme.spacing.lg,
    },
  });
