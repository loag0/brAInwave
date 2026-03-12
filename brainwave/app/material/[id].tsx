import React, { useEffect, useState, useCallback } from "react";
import { marked } from "marked";
import {
  ScrollView,
  View,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  Text,
  Modal,
  FlatList,
} from "react-native";
import { useLocalSearchParams, Stack } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import Markdown from "react-native-markdown-display";
import { useTheme } from "../contexts/ThemeContext";
import { useAuth } from "../contexts/AuthContext";
import brAInwaveApi from "@/api/brAInwaveApi";
import { LocalDB } from "../database/localDb";
import { ExportIcon } from "@/components/Icons";
import BrainwaveLoader from "@/components/BrainwaveLoader";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { File, Paths } from "expo-file-system";

/**
 * This is so inline code backticks from the AI plan dont render as actual backticks 
 * but instead as just bold text because it was messing with the theme
 */
function sanitizeAiMarkdown(markdown: any){
  if(!markdown) return '';

  return markdown.replace(/`([^`\n]+)`/g, '**$1**');
}

export default function MaterialDetail() {
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const { theme, isDark } = useTheme();

  const [data, setData] = useState<{ title: string; aiPlan: string } | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [flashcards, setFlashcards] = useState<any[]>([]);
  const [showFlashcards, setShowFlashcards] = useState(false);
  const [generatingFlashcards, setGeneratingFlashcards] = useState(false);
  const [remoteId, setRemoteId] = useState<string | number | null>(null);

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

      const rId = localData?.remote_id || id;
      setRemoteId(rId as string);

      const response = await brAInwaveApi.getStudyPlan(user.id, rId);

      if (response) {
        setData(response);
      }

      // Fetch flashcards
      let localCards = await LocalDB.getFlashcards(user.id, id as string);
      if (localCards && localCards.length > 0) {
        setFlashcards(localCards);
      } else {
        // Try fetching from API if not found locally
        const apiResponse = await brAInwaveApi.getFlashcards(user.id, rId);
        if (
          apiResponse &&
          apiResponse.flashcards &&
          apiResponse.flashcards.length > 0
        ) {
          setFlashcards(apiResponse.flashcards);
          await LocalDB.saveFlashcards(
            user.id,
            id as string,
            apiResponse.flashcards,
          );
        }
      }
    } catch (e) {
      console.error("Error fetching study plan:", e);
    } finally {
      setLoading(false);
    }
  }, [id, user?.id]);

  const handleGenerateFlashcards = async () => {
    if (!user?.id || !id) return;
    setGeneratingFlashcards(true);
    const targetId = remoteId || id;
    try {
      const response = await brAInwaveApi.generateFlashcards(
        user.id,
        targetId as string,
      );
      if (response && response.flashcards) {
        setFlashcards(response.flashcards);
        await LocalDB.saveFlashcards(
          user.id,
          id as string, // Still save locally under the local ID for consistency with retrieval
          response.flashcards,
        );
      }
    } catch (e) {
      console.error("Error generating flashcards:", e);
    } finally {
      setGeneratingFlashcards(false);
    }
  };

  useEffect(() => {
    getSyllabus();
  }, [getSyllabus]);

  useFocusEffect(
    useCallback(() => {
      getSyllabus();
    }, [getSyllabus]),
  );

  const exportToPDF = async () => {
    if (!data) return;

    try {
      // 1. Direct Markdown to HTML conversion
      const contentHtml = await marked.parse(data.aiPlan);

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
              padding-bottom: 10px; 
              margin-bottom: 30px;
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
            
            /* Page Break Controls */
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
            <p class="branding">Generated by <span style="color: ${theme.colors.primary}; font-weight: bold;">brAInwave</span></p>
          </div>
          <div id="content">
            ${contentHtml}
          </div>
        </body>
      </html>
    `;

      const { uri: printUri } = await Print.printToFileAsync({ html });
      const fileName = `${data.title.replace(/\s+/g, "_")}.pdf`;
      const tempFile = new File(printUri);
      const targetFile = new File(Paths.cache, fileName);

      if (targetFile.exists) {
        await targetFile.delete();
      }

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
            {sanitizeAiMarkdown(data?.aiPlan) || "No content found for this syllabus."}
          </Markdown>

          <View style={styles.flashcardContainer}>
            <View style={styles.flashcardInfo}>
              <Text
                style={[
                  styles.flashcardStatusText,
                  { color: theme.colors.text.secondary },
                ]}
              >
                {flashcards.length > 0
                  ? `Continuous learning: ${flashcards.length} flashcards available.`
                  : "No flashcards generated yet. Generate some to start active recall!"}
              </Text>
            </View>

            <View
              style={[
                styles.buttonGroup,
                flashcards.length === 0 && { flexDirection: "column" },
              ]}
            >
              {flashcards.length > 0 && (
                <TouchableOpacity
                  style={[
                    styles.actionButton,
                    { backgroundColor: theme.colors.primary },
                  ]}
                  onPress={() => setShowFlashcards(true)}
                >
                  <Text style={[styles.buttonText, { color: "#fff" }]}>
                    View Flashcards
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[
                  styles.actionButton,
                  flashcards.length === 0 && { width: "100%", marginTop: 10 },
                  {
                    backgroundColor: theme.colors.background,
                    borderWidth: 1,
                    borderColor: theme.colors.primary,
                  },
                ]}
                onPress={handleGenerateFlashcards}
                disabled={generatingFlashcards}
              >
                {generatingFlashcards ? (
                  <View style={{ alignItems: "center", gap: 8 }}>
                    <BrainwaveLoader theme={theme} />
                    <Text
                      style={[
                        styles.buttonText,
                        { color: theme.colors.primary },
                      ]}
                    >
                      Generating...
                    </Text>
                  </View>
                ) : (
                  <Text
                    style={[styles.buttonText, { color: theme.colors.primary }]}
                  >
                    {flashcards.length > 0
                      ? "Regenerate"
                      : "Generate Flashcards"}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      )}

      <Modal
        visible={showFlashcards}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowFlashcards(false)}
      >
        <View style={styles.modalContainer}>
          <View
            style={[
              styles.modalContent,
              { backgroundColor: theme.colors.background },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text
                style={[
                  styles.modalTitle,
                  { color: theme.colors.text.primary },
                ]}
              >
                Flashcards
              </Text>
              <TouchableOpacity onPress={() => setShowFlashcards(false)}>
                <Text
                  style={{ color: theme.colors.primary, fontWeight: "bold" }}
                >
                  Close
                </Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={flashcards}
              keyExtractor={(item, index) => index.toString()}
              renderItem={({ item }) => (
                <View
                  style={[
                    styles.cardContainer,
                    {
                      backgroundColor: isDark ? "#1e1e1e" : "#f9f9f9",
                      borderColor: theme.colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.questionText,
                      { color: theme.colors.text.primary },
                    ]}
                  >
                    Q: {item.question}
                  </Text>
                  <View
                    style={{
                      height: 1,
                      backgroundColor: theme.colors.border,
                      marginVertical: 10,
                    }}
                  />
                  <Text
                    style={[
                      styles.answerText,
                      { color: theme.colors.text.secondary },
                    ]}
                  >
                    A: {item.answer}
                  </Text>
                </View>
              )}
              contentContainerStyle={{ paddingBottom: 20 }}
            />
          </View>
        </View>
      </Modal>
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
  actionButton: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 5,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  flashcardContainer: {
    marginTop: 30,
    padding: 15,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.02)",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
  },
  flashcardInfo: {
    marginBottom: 15,
    alignItems: "center",
  },
  flashcardStatusText: {
    fontSize: 12,
    textAlign: "center",
    fontStyle: "italic",
  },
  modalContainer: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalContent: {
    height: "80%",
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    padding: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
  },
  cardContainer: {
    padding: 20,
    borderRadius: 15,
    marginBottom: 15,
    borderWidth: 1,
  },
  questionText: {
    fontSize: 16,
    fontWeight: "bold",
    lineHeight: 22,
  },
  answerText: {
    fontSize: 15,
    lineHeight: 22,
  },
});
