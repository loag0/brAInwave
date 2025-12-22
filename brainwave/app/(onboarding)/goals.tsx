import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  //FlatList,
} from "react-native";
import { useAuth } from "../contexts/AuthContexts";
import { useTheme } from "../contexts/ThemeContexts";
import { useLocalSearchParams, useRouter } from "expo-router";

const SUBJECT_OPTIONS = [
  "Math",
  "Science",
  "History",
  "Coding",
  "Design",
  "Business",
];

export default function GoalsScreen() {
  const { theme } = useTheme();
  const { user } = useAuth(); // In a real app, you'd call an 'updateUser' function here
  const router = useRouter();
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);

  const toggleSubject = (subject: string) => {
    if (selectedSubjects.includes(subject)) {
      setSelectedSubjects(selectedSubjects.filter((s) => s !== subject));
    } else {
      setSelectedSubjects([...selectedSubjects, subject]);
    }
  };

  const handleFinish = () => {
    if (selectedSubjects.length === 0) return;

    // TODO: Save selectedSubjects to Firestore here!

    // For now, since we haven't built the Firestore update,
    // we'll just navigate. Note: The index.tsx check will still
    // trigger until the user object actually has subjects.
    router.push({
      pathname: "/(onboarding)/schedule",
      params: { subjects: selectedSubjects.join(",") },
    });
  };

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <Text style={[styles.title, { color: theme.colors.text.primary }]}>
        What are you studying?
      </Text>
      <Text style={[styles.subtitle, { color: theme.colors.text.secondary }]}>
        Select at least one subject to customize your plan.
      </Text>

      <View style={styles.grid}>
        {SUBJECT_OPTIONS.map((subject) => (
          <TouchableOpacity
            key={subject}
            onPress={() => toggleSubject(subject)}
            style={[
              styles.chip,
              {
                borderColor: theme.colors.primary,
                backgroundColor: selectedSubjects.includes(subject)
                  ? theme.colors.primary
                  : "transparent",
              },
            ]}
          >
            <Text
              style={{
                color: selectedSubjects.includes(subject)
                  ? "#FFF"
                  : theme.colors.primary,
              }}
            >
              {subject}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[
          styles.button,
          {
            backgroundColor:
              selectedSubjects.length > 0
                ? theme.colors.primary
                : theme.colors.border,
          },
        ]}
        onPress={handleFinish}
        disabled={selectedSubjects.length === 0}
      >
        <Text style={styles.buttonText}>Continue to Dashboard</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: "center" },
  title: { fontSize: 28, fontWeight: "bold", marginBottom: 8 },
  subtitle: { fontSize: 16, marginBottom: 32 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 40 },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1,
  },
  button: { padding: 18, borderRadius: 12, alignItems: "center" },
  buttonText: { color: "#FFF", fontWeight: "bold", fontSize: 16 },
});
