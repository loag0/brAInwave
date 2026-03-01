import React, { useEffect, useState, useCallback } from "react";
import {
  ScrollView,
  View,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { useLocalSearchParams, Stack } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import Markdown from "react-native-markdown-display";
import { useTheme } from "../contexts/ThemeContext";
import { useAuth } from "../contexts/AuthContext";
import brAInwaveApi from "@/api/brAInwaveApi";
import { LocalDB } from "../database/localDb";
import { ExportIcon } from "@/components/Icons";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { File, Paths } from "expo-file-system";

export default function MaterialDetail() {
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const { theme, isDark } = useTheme();

  const [data, setData] = useState<{ title: string; aiPlan: string } | null>(
    null,
  );
  const [loading, setLoading] = useState(true);

  const getSyllabus = useCallback(async () => {
    if (!user?.id || !id) return;
    setLoading(true);

    try {
      const localData = await LocalDB.getMaterialById(user.id, id as string);

      if (localData && localData.aiPlan) {
        setData({
          title: localData.title,
          aiPlan: localData.aiPlan,
        });
        setLoading(false);
        return;
      }

      const remoteId = localData?.remote_id || id;
      const response = await brAInwaveApi.getStudyPlan(user.id, remoteId);

      if (response) {
        setData(response);
      }
    } catch (e) {
      console.error("Error fetching study plan:", e);
    } finally {
      setLoading(false);
    }
  }, [id, user?.id]);

  useEffect(() => {
    getSyllabus();
  }, [getSyllabus]);

  useFocusEffect(
    useCallback(() => {
      getSyllabus();
    }, [getSyllabus]),
  );

  const exportToMarkdown = async () => {
    if (!data) return;
    const fileName = `${data.title.replace(/\s+/g, "_")}.md`;
    const file = new File(Paths.cache, fileName);

    try {
      await file.write(data.aiPlan);
      await Sharing.shareAsync(file.uri);
    } catch (e) {
      console.error("Markdown Export Error:", e);
    }
  };

  const exportToPDF = async () => {
    if (!data) return;
    const html = `
      <html>
        <head>
          <style>
            body { font-family: 'Helvetica', sans-serif; padding: 40px; color: #333; line-height: 1.6; }
            h1 { color: ${theme.colors.primary}; border-bottom: 2px solid ${theme.colors.primary}; padding-bottom: 10px; }
            h2 { color: #555; margin-top: 30px; }
            pre { background: #f4f4f4; padding: 15px; border-radius: 8px; overflow-x: auto; }
            blockquote { border-left: 5px solid #ccc; margin-left: 0; padding-left: 15px; font-style: italic; color: #666; }
          </style>
        </head>
        <body>
          <h1>${data.title}</h1>
          <div id="content"></div>
          <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
          <script>
            document.getElementById('content').innerHTML = marked.parse(\`${data.aiPlan.replace(/`/g, "\\`")}\`);
          </script>
        </body>
      </html>
    `;

    try {
      const { uri: printUri } = await Print.printToFileAsync({ html });
      const fileName = `${data.title.replace(/\s+/g, "_")}.pdf`;
      const tempFile = new File(printUri);
      const targetFile = new File(Paths.cache, fileName);
      await tempFile.move(targetFile);
      await Sharing.shareAsync(targetFile.uri);
    } catch (e) {
      console.error("PDF Export Error:", e);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      {/* 1. Dynamic Header Title */}
      <Stack.Screen
        options={{
          title: data?.title || "Study Plan",
          headerTitleStyle: { fontFamily: theme.fonts.bold },
          headerRight: () => (
            <View style={{ flexDirection: "row", gap: 15, paddingRight: 10 }}>
              <TouchableOpacity onPress={exportToMarkdown}>
                <ExportIcon size={24} color={theme.colors.primary} />
              </TouchableOpacity>
            </View>
          ),
        }}
      />

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

          <View style={styles.buttonGroup}>
            <TouchableOpacity
              style={[
                styles.exportButton,
                { backgroundColor: theme.colors.primary },
              ]}
              onPress={exportToPDF}
            >
              <ExportIcon size={20} color="#FFF" />
              <View style={{ width: 8 }} />
              <View>
                <ActivityIndicator
                  size="small"
                  color="#FFF"
                  style={{ position: "absolute", opacity: 0 }}
                />
                <Markdown
                  style={{ body: { color: "#FFF", fontWeight: "800" } }}
                >
                  Export PDF
                </Markdown>
              </View>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: { padding: 20, paddingBottom: 100 },
  buttonGroup: {
    marginTop: 30,
    flexDirection: "row",
    justifyContent: "center",
  },
  exportButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  container: { padding: 20, paddingBottom: 50 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
});
