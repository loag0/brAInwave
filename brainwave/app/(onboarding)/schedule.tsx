import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useTheme } from "../contexts/ThemeContexts";
import { useAuth } from "../contexts/AuthContexts";
import { useRouter, useLocalSearchParams } from "expo-router";

export default function Schedule() {
  const { theme } = useTheme();
  const router = useRouter();
  const { updateUser } = useAuth();
  const { subjects } = useLocalSearchParams();
  const [isMorning, setIsMorning] = useState<boolean | null>(null);

  const handleCompleteOnboarding = async () => {
    updateUser({
      studyPreferences: {
        isMorningPerson: isMorning ?? true,
        preferredSessionLength: "medium",
        subjects: typeof subjects === "string" ? subjects.split(",") : [], 
      },
    });
    // 1. TODO: Save 'isMorning' preference to Firestore.
    // 2. TODO: Update the local 'user' object in AuthContext
    //    so the 'hasFinishedSetup' check in _layout.tsx passes.

    // Navigate to the main app
    router.replace("/(tabs)");
  };

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <Text style={[styles.title, { color: theme.colors.text.primary }]}>
        When do you study best?
      </Text>
      <Text style={[styles.subtitle, { color: theme.colors.text.secondary }]}>
        We'll use this to optimize your study reminders.
      </Text>

      <View style={styles.optionsContainer}>
        <TouchableOpacity
          style={[
            styles.option,
            {
              borderColor:
                isMorning === true ? theme.colors.primary : theme.colors.border,
              backgroundColor:
                isMorning === true
                  ? theme.colors.primary + "10"
                  : "transparent",
            },
          ]}
          onPress={() => setIsMorning(true)}
        >
          <Text style={{ fontSize: 40 }}>☀️</Text>
          <Text
            style={[styles.optionText, { color: theme.colors.text.primary }]}
          >
            Morning Person
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.option,
            {
              borderColor:
                isMorning === false
                  ? theme.colors.primary
                  : theme.colors.border,
              backgroundColor:
                isMorning === false
                  ? theme.colors.primary + "10"
                  : "transparent",
            },
          ]}
          onPress={() => setIsMorning(false)}
        >
          <Text style={{ fontSize: 40 }}>🌙</Text>
          <Text
            style={[styles.optionText, { color: theme.colors.text.primary }]}
          >
            Night Owl
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[
          styles.button,
          {
            backgroundColor:
              isMorning !== null ? theme.colors.primary : theme.colors.border,
          },
        ]}
        onPress={handleCompleteOnboarding}
        disabled={isMorning === null}
      >
        <Text style={styles.buttonText}>Finish Setup</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: "center" },
  title: { fontSize: 28, fontWeight: "bold", marginBottom: 8 },
  subtitle: { fontSize: 16, marginBottom: 32 },
  optionsContainer: { gap: 16, marginBottom: 40 },
  option: {
    padding: 24,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: "center",
    flexDirection: "row",
    gap: 16,
  },
  optionText: { fontSize: 18, fontWeight: "600" },
  button: { padding: 18, borderRadius: 12, alignItems: "center" },
  buttonText: { color: "#FFF", fontWeight: "bold", fontSize: 16 },
});
