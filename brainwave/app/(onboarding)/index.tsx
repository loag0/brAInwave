import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { Theme } from "../types";
import { useRouter } from "expo-router";
import { doc, setDoc } from "firebase/firestore";
import { db as firestore } from "../../firebaseConfig";
import {
  ensureNotificationPermission,
  openAppSettings,
} from "@/utils/notifications";
import { useAlert } from "../contexts/AlertContext";
import BrainwaveAPI from "@/api/brAInwaveApi";
import { LocalDB } from "../database/localDb";

type SessionLength = "short" | "medium" | "long";
type Mode = "stay_consistent" | "exam_prep" | "catch_up";

const SESSION_COLORS = {
  short: { key: "success" },
  medium: { key: "warning" },
  long: { key: "error" },
} as const;

const YEAR_OPTIONS = ["1st year", "2nd year", "3rd year", "4th year", "Postgrad"];

export default function OnboardingScreen() {
  const { theme, isDark } = useTheme();
  const { user, updateProfileData } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<1 | 2>(1);
  const [mode, setMode] = useState<Mode>("stay_consistent");
  const [sessionLength, setSessionLength] = useState<SessionLength>("medium");
  const [isSaving, setIsSaving] = useState(false);
  const [yearOfStudy, setYearOfStudy] = useState<string | null>(null);
  const [degree, setDegree] = useState("");
  const { showAlert } = useAlert();

  const handleFinish = async () => {
    if (!user?.id) return;
    setIsSaving(true);

    try {
      showAlert({
        title: "Stay on track",
        message:
          "brAInwave works best with notifications enabled. We'll remind you before classes and study sessions.",
        confirmText: "Allow",
        showCancel: true,
        cancelText: "Maybe later",
        onConfirm: async () => {
          const granted = await ensureNotificationPermission();

          if (!granted) {
            // Show blocked alert but still proceed to app with false
            showAlert({
              title: "Notifications Blocked",
              message:
                "Enable notifications in your phone settings to get study reminders.",
              confirmText: "Open Settings",
              showCancel: true,
              cancelText: "Skip",
              onConfirm: async () => {
                openAppSettings();
                await saveAndProceed(false); // ← proceed regardless
              },
              onCancel: async () => await saveAndProceed(false), // ← proceed on skip too
            }, 300);
            return; // ← don't call saveAndProceed here, the nested alert handles it
          }

          await saveAndProceed(granted);
        },
        onCancel: async () => {
          // ← add async here
          await saveAndProceed(false);
        },
      });
    } catch (e) {
      if (__DEV__) console.error("Onboarding error:", e);
    } finally {
      setIsSaving(false);
    }
  };

  const saveAndProceed = async (granted: boolean) => {
    if (__DEV__)
      console.log(
        "saveAndProceed called, user:",
        user?.id,
        "granted:",
        granted,
      );
    if (!user?.id) {
      if (__DEV__) console.log("returning early - no user id");
      return;
    }
    if (__DEV__) console.log("proceeding with save...");
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
    await updateProfileData(payload);

    // Save profile personalization to backend + local cache
    try {
      const profilePayload = {
        year_of_study: yearOfStudy,
        degree: degree.trim() || null,
        weak_areas: [],
      };
      await BrainwaveAPI.saveProfile(profilePayload);
      if (user?.id) {
        LocalDB.saveUserProfile(user.id, yearOfStudy, degree.trim() || null, []);
      }
    } catch (e) {
      if (__DEV__) console.log("Profile save failed (non-fatal):", e);
    }

    router.replace("/(tabs)");
  };

  const styles = createStyles(theme, isDark);

  if (step === 1) {
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
                  { color: mode === m ? "#fff" : theme.colors.primary },
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
                  { backgroundColor: isActive ? color : color + "20" },
                ]}
              >
                <Text
                  style={[
                    styles.sessionOptionText,
                    { color: isActive ? "#fff" : color },
                  ]}
                >
                  {s === "short"
                    ? "Short - 15–25 min"
                    : s === "medium"
                      ? "Medium - 30–45 min"
                      : "Long - 60+ min"}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.colors.primary }]}
          onPress={() => setStep(2)}
          disabled={isSaving}
        >
          <Text style={styles.buttonText}>Next</Text>
        </TouchableOpacity>

        <Text style={[styles.footnote, { color: theme.colors.text.secondary }]}>
          Notifications help remind you when it's study time
        </Text>
      </View>
    );
  }

  // Step 2
  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.title, { color: theme.colors.text.primary }]}>
          One more thing
        </Text>

        <Text style={[styles.sectionTitle, { color: theme.colors.text.primary }]}>
          What year are you in?
        </Text>

        <View style={[styles.row, { marginBottom: 28 }]}>
          {YEAR_OPTIONS.map((y) => (
            <TouchableOpacity
              key={y}
              onPress={() => setYearOfStudy(yearOfStudy === y ? null : y)}
              style={[
                styles.goalOption,
                {
                  backgroundColor:
                    yearOfStudy === y
                      ? theme.colors.primary
                      : theme.colors.primary + "20",
                  borderColor:
                    yearOfStudy === y ? theme.colors.primary : "transparent",
                },
              ]}
            >
              <Text
                style={[
                  styles.goalOptionText,
                  { color: yearOfStudy === y ? "#fff" : theme.colors.primary },
                ]}
              >
                {y}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.sectionTitle, { color: theme.colors.text.primary }]}>
          Your degree / programme
        </Text>

        <TextInput
          style={[
            styles.textInput,
            {
              backgroundColor: theme.colors.primary + "20",
              color: theme.colors.text.primary,
              borderColor: degree.length > 0 ? theme.colors.primary : "transparent",
            },
          ]}
          placeholder="e.g. Computer Science"
          placeholderTextColor={theme.colors.text.secondary}
          value={degree}
          onChangeText={setDegree}
          returnKeyType="done"
          maxLength={120}
        />
        {degree.length > 90 && (
          <Text style={{ color: theme.colors.text.secondary, fontSize: 12, textAlign: "right", marginTop: 4 }}>
            {120 - degree.length} characters left
          </Text>
        )}

        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.colors.primary, marginTop: 32 }]}
          onPress={handleFinish}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator color={theme.colors.primary} />
          ) : (
            <Text style={styles.buttonText}>Finish setup</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.skipButton}
          onPress={handleFinish}
          disabled={isSaving}
        >
          <Text style={[styles.skipText, { color: theme.colors.text.secondary }]}>
            Skip
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (theme: Theme, isDark: boolean) =>
  StyleSheet.create({
    container: { flex: 1, padding: 24 },
    scrollContent: { justifyContent: "center", flexGrow: 1, paddingVertical: 24 },
    title: {
      fontSize: 30,
      fontWeight: "bold",
      marginBottom: 32,
      textAlign: "center",
    },
    sectionTitle: { fontSize: 16, fontWeight: "600", marginBottom: 12 },
    row: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 28 },
    goalOption: {
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 999,
      borderWidth: 1,
    },
    goalOptionText: { fontWeight: "600", fontSize: 14 },
    sessionOption: {
      width: "100%",
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: "center",
    },
    sessionOptionText: { fontSize: 14, fontWeight: "600" },
    textInput: {
      width: "100%",
      borderRadius: 14,
      paddingVertical: 14,
      paddingHorizontal: 16,
      fontSize: 14,
      fontWeight: "600",
      borderWidth: 1,
    },
    button: {
      marginTop: 12,
      padding: 18,
      borderRadius: 16,
      alignItems: "center",
    },
    buttonText: { color: "#fff", fontSize: 18, fontWeight: "bold" },
    footnote: { marginTop: 16, textAlign: "center", fontSize: 13 },
    skipButton: { marginTop: 16, alignItems: "center", padding: 8 },
    skipText: { fontSize: 14, fontWeight: "500" },
  });
