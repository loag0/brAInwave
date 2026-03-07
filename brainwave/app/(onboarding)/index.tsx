import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import * as Notifications from "expo-notifications";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { Theme } from "../types";
import { useRouter } from "expo-router";
import { doc, setDoc } from "firebase/firestore";
import { db as firestore } from "../../firebaseConfig";

type SessionLength = "short" | "medium" | "long";
type Mode = "stay_consistent" | "exam_prep" | "catch_up";

const SESSION_COLORS = {
  short: { key: "success" },
  medium: { key: "warning" },
  long: { key: "error" },
} as const;

export default function OnboardingScreen() {
  const { theme, isDark } = useTheme();
  const { user, updateProfileData } = useAuth();
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("stay_consistent");
  const [sessionLength, setSessionLength] = useState<SessionLength>("medium");
  const [isSaving, setIsSaving] = useState(false);

  const requestNotificationPermission = async (): Promise<boolean> => {
    const { status } = await Notifications.getPermissionsAsync();
    if (status === "granted") return true;
    const { status: newStatus } = await Notifications.requestPermissionsAsync();
    return newStatus === "granted";
  };

  const handleFinish = async () => {
    if (!user?.id) return;
    setIsSaving(true);

    try {
      const granted = await requestNotificationPermission();
      const userRef = doc(firestore, "users", user.id);

      const payload = {
        hasFinishedSetup: true,
        studyPreferences: {
          mode,
          isMorningPerson: true,
          preferredSessionLength: sessionLength,
          notificationLeadMinutes: 10,
          notifications: {
            studyReminders: granted,
            assignmentDeadlines: granted,
            goalAchievements: granted,
            dailySummary: false,
          },
        },
        updatedAt: new Date().toISOString(),
      };

      await setDoc(userRef, payload, { merge: true });
      updateProfileData(payload);
      router.replace("/(tabs)");
    } catch (err) {
      console.error("Onboarding error:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const styles = createStyles(theme, isDark);

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <Text style={[styles.title, { color: theme.colors.text.primary }]}>
        Let's set you up
      </Text>

      <Text style={[styles.sectionTitle, { color: theme.colors.text.primary }]}>
        What's your main goal?
      </Text>

      <View style={styles.row}>
        {(["exam_prep", "stay_consistent", "catch_up"] as Mode[]).map((m) => (
          <TouchableOpacity
            key={m}
            onPress={() => setMode(m)}
            style={[
              styles.goalOption,
              {
                backgroundColor:
                  mode === m
                    ? theme.colors.primary
                    : theme.colors.primary + "20",
                borderColor: mode === m ? theme.colors.primary : "transparent",
              },
            ]}
          >
            <Text
              style={[
                styles.goalOptionText,
                {
                  color: mode === m ? "#fff" : theme.colors.primary,
                },
              ]}
            >
              {m === "exam_prep"
                ? "Exam Prep"
                : m === "stay_consistent"
                  ? "Stay Consistent"
                  : "Catch Up"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={[styles.sectionTitle, { color: theme.colors.text.primary }]}>
        Preferred study session length
      </Text>

      <View style={{ gap: 12, marginBottom: 28 }}>
        {(["short", "medium", "long"] as SessionLength[]).map((s) => {
          const colorKey = SESSION_COLORS[s].key;
          const color = theme.colors[colorKey];
          const isActive = sessionLength === s;
          return (
            <TouchableOpacity
              key={s}
              onPress={() => setSessionLength(s)}
              style={[
                styles.sessionOption,
                {
                  backgroundColor: isActive ? color : color + "20",
                },
              ]}
            >
              <Text
                style={[
                  styles.sessionOptionText,
                  { color: isActive ? "#fff" : color },
                ]}
              >
                {s === "short"
                  ? "Short — 15–25 min"
                  : s === "medium"
                    ? "Medium — 30–45 min"
                    : "Long — 60+ min"}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity
        style={[styles.button, { backgroundColor: theme.colors.primary }]}
        onPress={handleFinish}
        disabled={isSaving}
      >
        {isSaving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Finish setup</Text>
        )}
      </TouchableOpacity>

      <Text style={[styles.footnote, { color: theme.colors.text.secondary }]}>
        Notifications help remind you when it's study time
      </Text>
    </View>
  );
}

const createStyles = (theme: Theme, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      padding: 24,
      justifyContent: "center",
    },
    title: {
      fontSize: 30,
      fontWeight: "bold",
      marginBottom: 32,
      textAlign: "center",
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "600",
      marginBottom: 12,
    },
    row: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
      marginBottom: 28,
    },
    goalOption: {
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 999,
      borderWidth: 1,
    },
    goalOptionText: {
      fontWeight: "600",
      fontSize: 14,
    },
    sessionOption: {
      width: "100%",
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: "center",
    },
    sessionOptionText: {
      fontSize: 14,
      fontWeight: "600",
    },
    button: {
      marginTop: 12,
      padding: 18,
      borderRadius: 16,
      alignItems: "center",
    },
    buttonText: {
      color: "#fff",
      fontSize: 18,
      fontWeight: "bold",
    },
    footnote: {
      marginTop: 16,
      textAlign: "center",
      fontSize: 13,
    },
  });
