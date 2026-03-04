import React, { useEffect, useState, useCallback } from "react";
import { marked } from "marked";
import {
  ScrollView,
  View,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  Text,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import Markdown from "react-native-markdown-display";
import { useTheme } from "../contexts/ThemeContext";
import { useAuth } from "../contexts/AuthContext";
import { useContent } from "../hooks/useContent";
import brAInwaveApi from "@/api/brAInwaveApi";
import { LocalDB } from "../database/localDb";
import { ExportIcon } from "@/components/Icons";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

export default function AssignmentDetail() {
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const { theme, isDark } = useTheme();

  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const { deleteAssignment } = useContent();
  const router = useRouter();

  const handleDelete = async () => {
    if (!data?.id) return;
    setIsDeleting(true);
    try {
      await deleteAssignment(data.id, data.remote_id);
      router.back();
    } catch (e) {
      console.error("Failed to delete assignment:", e);
      setIsDeleting(false);
    }
  };

  const getAssignment = useCallback(async () => {
    if (!user?.id || !id) return;
    setLoading(true);

    try {
      // 1. Check Local DB first
      const localData = await LocalDB.getAssignmentById(user.id, id as string);

      if (localData && (localData as any).rawContent) {
        setData(localData);
        setLoading(false);
        // We still fetch remote in background to ensures sync?
        // For now just return if local found.
        return;
      }

      // 2. Fallback to API
      const response = await brAInwaveApi.getAssignment(user.id, id as string);

      if (response) {
        setData(response);
      }
    } catch (e) {
      console.error("Error fetching assignment:", e);
    } finally {
      setLoading(false);
    }
  }, [id, user?.id]);

  useEffect(() => {
    getAssignment();
  }, [getAssignment]);

  useFocusEffect(
    useCallback(() => {
      getAssignment();
    }, [getAssignment]),
  );

  const exportToPDF = async () => {
    if (!data) return;

    try {
      const contentHtml = await marked.parse(
        data.rawContent || "No content analyzed.",
      );

      const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { 
              font-family: 'Helvetica', 'Arial', sans-serif; 
              padding: 40px; 
              color: #333; 
              line-height: 1.6; 
            }
            .document-header { 
              border-bottom: 2px solid ${theme.colors.primary}; 
              padding-bottom: 15px; 
              margin-bottom: 30px;
            }
            .meta-section {
                margin-bottom: 20px;
                padding: 10px;
                background: #f9f9f9;
                border-radius: 8px;
            }
            .meta-item {
                font-size: 14px;
                margin-bottom: 5px;
            }
            h1 { 
              color: ${theme.colors.primary}; 
              margin: 0; 
              font-size: 28px;
            }
            .branding { 
              font-size: 10px; 
              color: #999; 
              text-transform: uppercase;
              letter-spacing: 1px;
              margin-top: 5px;
            }
            
            h2, h3 { 
              page-break-after: avoid; 
              break-after: avoid; 
              color: ${theme.colors.primary};
              margin-top: 25px;
            }
            pre, blockquote, img { 
              page-break-inside: avoid; 
              break-inside: avoid; 
            }
            
            pre { 
              background: #f8f9fa; 
              padding: 15px; 
              border-radius: 8px; 
              border: 1px solid #eee;
              white-space: pre-wrap; 
              font-size: 12px;
              font-family: 'Courier New', monospace;
            }
            blockquote { 
              border-left: 4px solid #ddd; 
              margin: 20px 0; 
              padding: 10px 20px; 
              background: #fcfcfc;
              font-style: italic; 
              color: #555; 
            }
            ul, ol { padding-left: 25px; }
            li { margin-bottom: 8px; }
            p { margin-bottom: 15px; }
          </style>
        </head>
        <body>
          <div class="document-header">
            <h1>${data.title}</h1>
            <p class="branding">Assignment Master Plan by <span style="color: ${theme.colors.primary}; font-weight: bold;">brAInwave</span></p>
          </div>
          <div class="meta-section">
            <div class="meta-item"><strong>Subject:</strong> ${data.subject}</div>
            <div class="meta-item"><strong>Due Date:</strong> ${data.due_date}</div>
            <div class="meta-item"><strong>Priority:</strong> ${data.priority}</div>
          </div>
          <div id="content">
            ${contentHtml}
          </div>
        </body>
      </html>
    `;

      const { uri: printUri } = await Print.printToFileAsync({ html });
      const tempAction = async () => {
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(printUri);
        }
      };
      await tempAction();
    } catch (e) {
      console.error("PDF Export Error:", e);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <Stack.Screen
        options={{
          title: data?.title || "Assignment Plan",
          headerTitleStyle: { fontFamily: theme.fonts.bold },
          headerRight: () => (
            <View style={{ flexDirection: "row", gap: 15, paddingRight: 10 }}>
              <TouchableOpacity onPress={exportToPDF}>
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
            {data?.rawContent ||
              "No AI-generated plan found for this assignment."}
          </Markdown>

          <View style={styles.buttonGroup}>
            <TouchableOpacity
              style={[
                styles.actionButton,
                { backgroundColor: theme.colors.error || "#FF4B4B" },
              ]}
              onPress={handleDelete}
              activeOpacity={0.8}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={{ color: "#fff", fontWeight: "600" }}>Delete</Text>
              )}
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
    gap: 15,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
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
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
});
