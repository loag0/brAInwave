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

export default function OnboardingScreen() {
  const { theme, isDark } = useTheme();
  const { user, updateProfileData } = useAuth();
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("stay_consistent");
  const [sessionLength, setSessionLength] = useState<SessionLength>("medium");
  const [isSaving, setIsSaving] = useState(false);

  const requestNotificationPermission = async () => {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") {
      await Notifications.requestPermissionsAsync();
    }
  };

  const handleFinish = async () => {
    if (!user?.id) return;

    setIsSaving(true);

    try {
      await requestNotificationPermission();

      const userRef = doc(firestore, "users", user.id);

      const payload = {
        hasFinishedSetup: true,
        studyPreferences: {
          mode,
          isMorningPerson: true,
          preferredSessionLength: sessionLength,
          notificationLeadMinutes: 10,
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
        Let’s set you up
      </Text>

      <Text style={[styles.sectionTitle, { color: theme.colors.text.primary }]}>
        What’s your main goal?
      </Text>

      <View style={styles.row}>
        <Option
          label="Exam Prep"
          active={mode === "exam_prep"}
          onPress={() => setMode("exam_prep")}
          styles={styles}
        />
        <Option
          label="Stay Consistent"
          active={mode === "stay_consistent"}
          onPress={() => setMode("stay_consistent")}
          styles={styles}
        />
        <Option
          label="Catch Up"
          active={mode === "catch_up"}
          onPress={() => setMode("catch_up")}
          styles={styles}
        />
      </View>

      <Text style={[styles.sectionTitle, { color: theme.colors.text.primary }]}>
        Preferred study session length
      </Text>

      <View style={styles.row}>
        <Option
          label="Short - 15–25 min"
          active={sessionLength === "short"}
          onPress={() => setSessionLength("short")}
          styles={styles}
          variant="session"
        />
        <Option
          label="Medium   (30 - 45 min)"
          active={sessionLength === "medium"}
          onPress={() => setSessionLength("medium")}
          styles={styles}
          variant="session"
        />
        <Option
          label="Long - 60+ min"
          active={sessionLength === "long"}
          onPress={() => setSessionLength("long")}
          styles={styles}
          variant="session"
        />
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
        Notifications help remind you when it’s study time
      </Text>
    </View>
  );
}

function Option({
  label,
  active,
  onPress,
  styles,
  variant = "goal",
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
  variant?: "goal" | "session";
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.option, variant === "session" && styles.sessionOption, active && styles.optionActive]}>
      <Text style={[styles.optionText, variant === "session" && styles.sessionText]}>{label}</Text>
    </TouchableOpacity>
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
      justifyContent: "center",
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
      marginBottom: 28,
    },
    sessionOption: {
      minWidth: "100%",
      borderRadius: 14,
      paddingVertical: 14,
    },
    sessionText: {
      fontSize: 14,
      textAlign: "center",
    },
    option: {
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: "#ccc",
    },
    optionActive: {
      backgroundColor: theme.colors.primary,
      borderColor: "#000",
    },
    optionText: {
      color: "#fff",
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
