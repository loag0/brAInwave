import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useTheme } from "../contexts/ThemeContext";
import { useAuth } from "../contexts/AuthContext";
import { useRouter, useLocalSearchParams } from "expo-router";
import { doc, setDoc } from "firebase/firestore";
import { db as firestore } from "../../firebaseConfig";

export default function Schedule() {
  const { theme } = useTheme();
  const router = useRouter();
  const { user, updateUser, isLoading: authLoading } = useAuth();
  const { subjects } = useLocalSearchParams();

  const [isMorning, setIsMorning] = useState<boolean | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleCompleteOnboarding = async () => {
    // Safety check: Don't proceed if user isn't loaded yet
    if (!user?.id) {
      Alert.alert(
        "Error",
        "User session not found. Please try logging in again."
      );
      return;
    }

    setIsSaving(true);

    try {
      const userRef = doc(firestore, "users", user.id);

      let subjectsArray: string[] = [];
      if (typeof subjects === "string") {
        subjectsArray = subjects.split(",").filter((s) => s.trim() !== "");
      } else if (Array.isArray(subjects)) {
        subjectsArray = subjects;
      }

      const finalPrefs = {
        isMorningPerson: isMorning,
        preferredSessionLength: "medium" as const,
        subjects: subjectsArray,
      };

      // 1. Update Remote Firestore
      await setDoc(
        userRef,
        {
          studyPreferences: finalPrefs,
          hasFinishedSetup: true, // This is the flag your RootLayout monitors
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      // 2. Update Local AuthContext State
      // This triggers the NavigationHandler in app/_layout.tsx instantly
      updateUser({
        studyPreferences: finalPrefs,
        hasFinishedSetup: true,
      });

      // 3. Navigate as a fallback
      router.replace("/(tabs)");
    } catch (error: any) {
      console.error("Onboarding Completion Error:", error);
      Alert.alert(
        "Save Failed",
        error.message || "Could not save your preferences."
      );
    } finally {
      setIsSaving(false);
    }
  };

  // If Auth is still checking the session, show a spinner
  if (authLoading || !user) {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: theme.colors.background,
            justifyContent: "center",
          },
        ]}
      >
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text.primary }]}>
          When do you study best?
        </Text>
        <Text style={[styles.subtitle, { color: theme.colors.text.secondary }]}>
          We'll use this to optimize your study reminders and schedule.
        </Text>
      </View>

      <View style={styles.optionsContainer}>
        <TouchableOpacity
          activeOpacity={0.7}
          style={[
            styles.option,
            {
              borderColor:
                isMorning === true ? theme.colors.primary : theme.colors.border,
              backgroundColor:
                isMorning === true
                  ? theme.colors.primary + "15"
                  : "transparent",
            },
          ]}
          onPress={() => setIsMorning(true)}
        >
          <Text style={styles.emoji}>☀️</Text>
          <View>
            <Text
              style={[styles.optionTitle, { color: theme.colors.text.primary }]}
            >
              Morning Person
            </Text>
            <Text
              style={[styles.optionSub, { color: theme.colors.text.secondary }]}
            >
              Early bird gets the worm
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.7}
          style={[
            styles.option,
            {
              borderColor:
                isMorning === false
                  ? theme.colors.primary
                  : theme.colors.border,
              backgroundColor:
                isMorning === false
                  ? theme.colors.primary + "15"
                  : "transparent",
            },
          ]}
          onPress={() => setIsMorning(false)}
        >
          <Text style={styles.emoji}>🌙</Text>
          <View>
            <Text
              style={[styles.optionTitle, { color: theme.colors.text.primary }]}
            >
              Night Owl
            </Text>
            <Text
              style={[styles.optionSub, { color: theme.colors.text.secondary }]}
            >
              Best work happens at night
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[
          styles.button,
          {
            backgroundColor:
              isMorning !== null ? theme.colors.primary : theme.colors.border,
            opacity: isSaving ? 0.8 : 1,
          },
        ]}
        onPress={handleCompleteOnboarding}
        disabled={isMorning === null || isSaving}
      >
        {isSaving ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <Text style={styles.buttonText}>Finish Setup</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  header: { marginTop: 60, marginBottom: 40 },
  title: { fontSize: 32, fontWeight: "bold", marginBottom: 12 },
  subtitle: { fontSize: 16, lineHeight: 24 },
  optionsContainer: { gap: 20, marginBottom: 40 },
  option: {
    padding: 24,
    borderRadius: 20,
    borderWidth: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
  },
  emoji: { fontSize: 36 },
  optionTitle: { fontSize: 18, fontWeight: "700" },
  optionSub: { fontSize: 14, marginTop: 2 },
  button: {
    padding: 20,
    borderRadius: 16,
    alignItems: "center",
    marginTop: "auto", // Pushes button to bottom
    marginBottom: 20,
  },
  buttonText: { color: "#FFF", fontWeight: "bold", fontSize: 18 },
});
