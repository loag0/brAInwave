import React, { useEffect, useState } from "react";
import {
  ScrollView,
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
} from "react-native";
import { useLocalSearchParams, Stack } from "expo-router";
import Markdown from "react-native-markdown-display";
import { useTheme } from "../contexts/ThemeContext";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { useAuth } from "../contexts/AuthContext";

export default function MaterialDetail() {
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const { theme, isDark } = useTheme();

  const [data, setData] = useState<{ title: string; aiPlan: string } | null>(
    null,
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function getSyllabus() {
      if (!user?.id || !id) return;

      try {
        // Fetch specifically from the user's materials collection
        const docRef = doc(db, "users", user.id, "materials", id as string);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setData(docSnap.data() as any);
        }
      } catch (e) {
        console.error("Firestore Error:", e);
      } finally {
        setLoading(false);
      }
    }
    getSyllabus();
  }, [id, user]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      {/* 1. Dynamic Header Title */}
      <Stack.Screen options={{ title: data?.title || "Study Plan" }} />

      {loading ? (
        <ActivityIndicator style={{ flex: 1 }} color={theme.colors.primary} />
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* 2. The Markdown Body */}
          <Markdown
            style={{
              body: {
                color: theme.colors.text.primary,
                fontSize: 16,
                lineHeight: 24,
              },
              heading1: {
                color: theme.colors.primary,
                marginVertical: 10,
                fontFamily: theme.fonts.bold,
              },
              heading2: {
                color: theme.colors.text.primary,
                marginTop: 20,
                marginBottom: 10,
                fontFamily: theme.fonts.semiBold,
              },
              hr: { backgroundColor: theme.colors.border, marginVertical: 20 },
              list_item: { marginVertical: 5 },
              blockquote: {
                backgroundColor: isDark ? "#2d2d2d" : "#f0f0f0",
                borderRadius: 8,
                padding: 10,
              },
            }}
          >
            {data?.aiPlan || "No content found for this syllabus."}
          </Markdown>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: { padding: 20, paddingBottom: 100 },
  container: { padding: 20, paddingBottom: 50 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
});
