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
  Platform,
} from "react-native";
import Toast from "react-native-toast-message";
import { useLocalSearchParams, Stack, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import Markdown from "react-native-markdown-display";
import { useTheme } from "../contexts/ThemeContext";
import { useAuth } from "../contexts/AuthContext";
import { useContent } from "../hooks/useContent";
import { useAlert } from "../contexts/AlertContext";
import brAInwaveApi from "@/api/brAInwaveApi";
import { LocalDB } from "../database/localDb";
import { ExportIcon, ICONS, ChevronDownIcon } from "@/components/Icons";
import BrainwaveLoader from "@/components/BrainwaveLoader";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { File, Paths } from "expo-file-system";
import * as FileSystem from "expo-file-system/legacy";

/**
 * This is so inline code backticks from the AI plan dont render as actual backticks
 * but instead as just bold text because it was messing with the theme
 */
function sanitizeAiMarkdown(markdown: any) {
  if (!markdown) return "";

  return markdown.replace(/`([^`\n]+)`/g, "**$1**");
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
  const [localId, setLocalId] = useState<number | null>(null);
  const [moduleTag, setModuleTag] = useState<string | null>(null);
  const [moduleDropdownOpen, setModuleDropdownOpen] = useState(false);
  const [timetableSubjects, setTimetableSubjects] = useState<string[]>([]);
  const { deleteMaterial } = useContent();
  const router = useRouter();
  const { showAlert } = useAlert();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSavingTag, setIsSavingTag] = useState(false);

  const getSyllabus = useCallback(async () => {
    if (!user?.id || !id) return;
    setLoading(true);
    setTimetableSubjects(LocalDB.getSubjectsFromTimetable(user.id));

    try {
      const localData = await LocalDB.getMaterialById(user.id, id as string);

      if (localData && localData.aiPlan) {
        setRemoteId(localData.remote_id || null);
        setLocalId(localData.id || null);
        setModuleTag(localData.module_tag || null);
        setData({
          title: localData.title,
          aiPlan: localData.aiPlan,
        });
        setLoading(false);
        return;
      }

      const rId = localData?.remote_id || id;
      setRemoteId(rId as string);

      const response = await brAInwaveApi.getStudyPlanDetails(user.id, rId);

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
      Toast.show({
        type: "error",
        text1: "Failed to fetch plan",
        text2: "Couldn't load the study plan. Please try again.",
        position: "bottom",
        visibilityTime: 6000,
      });
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
      Toast.show({
        type: "error",
        text1: "Generation failed",
        text2:
          "This may be a temporary issue - please try again in a little while.",
        position: "bottom",
        visibilityTime: 4000,
      });
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

  const handleDelete = async () => {
    showAlert({
      title: "Confirm Deletion",
      message:
        "Are you sure you want to delete this study plan? This action cannot be undone.",
      iconPath: ICONS.ERROR,
      iconColor: theme.colors.error,
      confirmText: "Delete",
      showCancel: true,
      cancelText: "Cancel",
      onConfirm: async () => {
        setIsDeleting(true);
        try {
          await deleteMaterial(id as string, remoteId as number);
          router.back();
        } catch (e) {
          console.error("Failed to delete material:", e);
          Toast.show({
            type: "error",
            text1: "Failed to delete material",
            text2: "Sorry, we couldn't delete the material. Please try again.",
            position: "bottom",
            visibilityTime: 6000,
          });
          setIsDeleting(false);
        }
      },
    });
  };

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
            <p class="branding">Generated by <span style="color: ${theme.colors.primary}; font-weight: bold; text-transform:none;">brAInwave</span></p>
          </div>
          <div id="content">
            ${contentHtml}
          </div>
        </body>
      </html>
    `;

      const { uri: printUri } = await Print.printToFileAsync({ html });
      const fileName = `${data.title.replace(/\s+/g, " ")}.pdf`;
      const tempFile = new File(printUri);
      const targetFile = new File(Paths.cache, fileName);

      if (targetFile.exists) {
        await targetFile.delete();
      }

      await tempFile.move(targetFile);

      const { StorageAccessFramework } = FileSystem;
      if (Platform.OS === "android") {
        const permissions =
          await StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (permissions.granted) {
          const base64Content = await FileSystem.readAsStringAsync(
            targetFile.uri,
            { encoding: FileSystem.EncodingType.Base64 },
          );
          const destUri = await StorageAccessFramework.createFileAsync(
            permissions.directoryUri,
            fileName,
            "application/pdf",
          );
          await FileSystem.writeAsStringAsync(destUri, base64Content, {
            encoding: FileSystem.EncodingType.Base64,
          });
        }
      } else {
        if (await Sharing.isAvailableAsync())
          await Sharing.shareAsync(targetFile.uri);
      }
    } catch (e) {
      console.error("PDF Export Error:", e);
      Toast.show({
        type: "error",
        text1: "Failed to export",
        text2: "Sorry, we couldn't export the material. Please try again.",
        position: "bottom",
        visibilityTime: 6000,
      });
    }
  };

  const handleModuleTagSelect = async (subject: string | null) => {
    setModuleDropdownOpen(false);
    if (!user?.id || !localId) return;

    try {
      await LocalDB.updateMaterialModuleTag(user.id, localId, subject);

      setModuleTag(subject);
      
      if (remoteId) {
        setIsSavingTag(true);
          await brAInwaveApi.updateMaterialModuleTag(remoteId, subject);
          await LocalDB.markMaterialSynced(localId, remoteId as number, undefined, subject);
        
          Toast.show({
            type: "success",
            text1: "Module tag saved",
            position: "bottom",
            visibilityTime: 4000,
          });
      }
    } catch (e) {
        console.error("Failed to save module tag:", e);
        Toast.show({
          type: "error",
          text1: "Failed to save module tag",
          text2: "The tag has been saved locally and will sync when you're back online.",
          position: "bottom",
          visibilityTime: 6000,
        });
        // will sync later when online
    } finally {
        setIsSavingTag(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      {/* 1. Dynamic Header Title */}
      <Stack.Screen
        options={{
          headerTitle: () => (
            <Text
              style={{
                fontFamily: theme.fonts.bold,
                fontSize: 14,
                color: theme.colors.text.primary,
              }}
            >
              {data?.title || "Study Plan"}
            </Text>
          ),
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
          {/* 2. Module Tag Dropdown */}
          <View
            style={[
              styles.moduleCard,
              { borderColor: moduleTag ? theme.colors.primary : theme.colors.border },
            ]}
          >
            <TouchableOpacity
              style={styles.moduleDropdownBtn}
              onPress={() => setModuleDropdownOpen((v) => !v)}
              activeOpacity={0.7}
            >
              <View>
                <Text style={[styles.moduleLabel, { color: theme.colors.text.secondary }]}>
                  Module
                </Text>
                <Text
                  style={[
                    styles.moduleValue,
                    { color: moduleTag ? theme.colors.primary : theme.colors.text.secondary },
                  ]}
                >
                  {moduleTag ?? "Set module"}
                </Text>
              </View>
              {isSavingTag ? (
                <ActivityIndicator size="small" color={theme.colors.primary} />
              ) : (
                <ChevronDownIcon
                  size={16}
                  color={theme.colors.text.secondary}
                  style={{
                    transform: [{ rotate: moduleDropdownOpen ? "180deg" : "0deg" }],
                  }}
                />
              )}
            </TouchableOpacity>

            {moduleDropdownOpen && (
              <View style={[styles.moduleList, { borderTopColor: theme.colors.border }]}>
                {[null, ...timetableSubjects].map((s) => (
                  <TouchableOpacity
                    key={s ?? "__none__"}
                    style={[styles.moduleItem, { borderBottomColor: theme.colors.border }]}
                    onPress={() => handleModuleTagSelect(s)}
                  >
                    <Text
                      style={[
                        styles.moduleItemText,
                        { color: s === moduleTag ? theme.colors.primary : theme.colors.text.primary },
                        s === null && moduleTag === null && { color: theme.colors.text.secondary },
                      ]}
                    >
                      {s === null ? "None" : s}
                    </Text>
                    {s === moduleTag && s !== null && (
                      <Text style={{ color: theme.colors.primary, fontSize: 13 }}>✓</Text>
                    )}
                  </TouchableOpacity>
                ))}
                {timetableSubjects.length === 0 && (
                  <Text style={[styles.moduleItemText, { color: theme.colors.text.secondary, padding: 12 }]}>
                    No timetable found. Upload a timetable first.
                  </Text>
                )}
              </View>
            )}
          </View>

          {/* 3. The Markdown Body */}
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
            {sanitizeAiMarkdown(data?.aiPlan) ||
              "No content found for this syllabus."}
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
              {isDeleting && loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={{ color: "#fff", fontWeight: "600" }}>Delete</Text>
              )}
            </TouchableOpacity>
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
  moduleCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 20,
  },
  moduleDropdownBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
  },
  moduleLabel: {
    fontSize: 11,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  moduleValue: {
    fontSize: 14,
    fontWeight: "600",
  },
  moduleList: {
    borderTopWidth: 0.5,
  },
  moduleItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 0.5,
  },
  moduleItemText: {
    fontSize: 14,
  },
});
