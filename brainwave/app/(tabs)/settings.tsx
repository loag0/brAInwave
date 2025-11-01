import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../contexts/ThemeContexts";
import { useAuth } from "../contexts/AuthContexts";
import { Theme } from "../types";
import { Ionicons } from "@expo/vector-icons";

export default function Profile() {
  const { theme, isDark, toggleTheme } = useTheme();
  const { user, logout } = useAuth();

  const [notifications, setNotifications] = useState({
    studyReminders: true,
    assignmentDeadlines: true,
    goalAchievements: true,
    dailySummary: false,
  });

  const styles = createStyles(theme);

  const handleLogout = () => {
    Alert.alert("log out", "are you sure you want to log out?", [
      { text: "cancel", style: "cancel" },
      {
        text: "log out",
        style: "destructive",
        onPress: logout,
      },
    ]);
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
            <Text style={styles.headerTitle}>settings</Text>
            <Text style={styles.headerSubtitle}>
              customize your study experience
            </Text>
          </View>
        </View>

        <View style={styles.content}>
          {/* Profile Card */}
          <TouchableOpacity style={styles.card}>
            <View style={styles.profileContainer}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{getInitials(user?.name)}</Text>
              </View>
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>
                  {user?.name?.toLowerCase() || "alex johnson"}
                </Text>
                <Text style={styles.profileSubtitle}>
                  {user?.university?.toLowerCase() || "computer science major"}
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={theme.colors.text.secondary}
              />
            </View>
          </TouchableOpacity>

          {/* Notifications Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons
                name="notifications-outline"
                size={20}
                color={theme.colors.text.primary}
              />
              <Text style={styles.cardTitle}>notifications</Text>
            </View>
            <View style={styles.cardContent}>
              <SettingItem
                theme={theme}
                label="study reminders"
                description="get notified before study sessions"
                value={notifications.studyReminders}
                onValueChange={(val) =>
                  setNotifications({ ...notifications, studyReminders: val })
                }
              />
              <Separator theme={theme} />
              <SettingItem
                theme={theme}
                label="assignment deadlines"
                description="alerts for upcoming due dates"
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
                label="goal achievements"
                description="celebrate your milestones"
                value={notifications.goalAchievements}
                onValueChange={(val) =>
                  setNotifications({ ...notifications, goalAchievements: val })
                }
              />
              <Separator theme={theme} />
              <SettingItem
                theme={theme}
                label="daily summary"
                description="end-of-day progress report"
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
              <Ionicons
                name="book-outline"
                size={20}
                color={theme.colors.text.primary}
              />
              <Text style={styles.cardTitle}>study preferences</Text>
            </View>
            <View style={styles.cardContent}>
              <TouchableOpacity style={styles.menuItem}>
                <View style={styles.menuItemLeft}>
                  <Ionicons
                    name="time-outline"
                    size={20}
                    color={theme.colors.text.secondary}
                  />
                  <View style={styles.menuItemText}>
                    <Text style={styles.menuItemTitle}>session duration</Text>
                    <Text style={styles.menuItemSubtitle}>45 minutes</Text>
                  </View>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={theme.colors.text.secondary}
                />
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuItem}>
                <View style={styles.menuItemLeft}>
                  <Ionicons
                    name="school-outline"
                    size={20}
                    color={theme.colors.text.secondary}
                  />
                  <View style={styles.menuItemText}>
                    <Text style={styles.menuItemTitle}>subjects & classes</Text>
                    <Text style={styles.menuItemSubtitle}>
                      4 active subjects
                    </Text>
                  </View>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={theme.colors.text.secondary}
                />
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuItem}>
                <View style={styles.menuItemLeft}>
                  <Ionicons
                    name="flag-outline"
                    size={20}
                    color={theme.colors.text.secondary}
                  />
                  <View style={styles.menuItemText}>
                    <Text style={styles.menuItemTitle}>study hours goal</Text>
                    <Text style={styles.menuItemSubtitle}>4 hours per day</Text>
                  </View>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={theme.colors.text.secondary}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* App Settings Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons
                name="phone-portrait-outline"
                size={20}
                color={theme.colors.text.primary}
              />
              <Text style={styles.cardTitle}>app settings</Text>
            </View>
            <View style={styles.cardContent}>
              <View style={styles.darkModeContainer}>
                <View style={styles.menuItemLeft}>
                  <Ionicons
                    name="moon-outline"
                    size={20}
                    color={theme.colors.text.secondary}
                  />
                  <Text style={styles.menuItemTitle}>dark mode</Text>
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
                  <Ionicons
                    name="mail-outline"
                    size={20}
                    color={theme.colors.text.secondary}
                  />
                  <Text style={styles.menuItemTitle}>email preferences</Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={theme.colors.text.secondary}
                />
              </TouchableOpacity>

              <Separator theme={theme} />

              <TouchableOpacity style={styles.menuItemButton}>
                <View style={styles.menuItemLeft}>
                  <Ionicons
                    name="lock-closed-outline"
                    size={20}
                    color={theme.colors.text.secondary}
                  />
                  <Text style={styles.menuItemTitle}>privacy & security</Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={theme.colors.text.secondary}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Support Card */}
          <View style={styles.card}>
            <TouchableOpacity style={styles.supportButton}>
              <Ionicons
                name="help-circle-outline"
                size={20}
                color={theme.colors.text.secondary}
              />
              <Text style={styles.supportButtonText}>help & support</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.supportButton, styles.logoutButton]}
              onPress={handleLogout}
            >
              <Ionicons
                name="log-out-outline"
                size={20}
                color={theme.colors.error}
              />
              <Text style={[styles.supportButtonText, styles.logoutButtonText]}>
                log out
              </Text>
            </TouchableOpacity>
          </View>

          {/* Version */}
          <Text style={styles.version}>brainwave v1.0.0</Text>
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
      backgroundColor: theme.colors.text.primary,
      justifyContent: "center",
      alignItems: "center",
    },
    avatarText: {
      fontSize: 20,
      fontFamily: theme.fonts.semiBold,
      color: theme.colors.surface,
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
      padding: theme.spacing.sm,
      backgroundColor: theme.colors.background,
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
