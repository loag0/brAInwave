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
import { useDatePicker } from "../contexts/DatePickerContext";
import { useAuth } from "../contexts/AuthContext";
import { useAlert } from "../contexts/AlertContext";
import { useContent } from "../hooks/useContent";
import brAInwaveApi from "@/api/brAInwaveApi";
import { LocalDB } from "../database/localDb";
import { ExportIcon, ICONS } from "@/components/Icons";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { File, Paths } from "expo-file-system";

/**
 * This is so inline code backticks from the AI plan dont render as actual backticks
 * but instead as just bold text because it was messing with the theme
 */
function sanitizeAiMarkdown(markdown: any) {
  if (!markdown) return "";

  return markdown.replace(/`([^`\n]+)`/g, "**$1**");
}

export default function AssignmentDetail() {
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const { theme, isDark } = useTheme();

  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSavingDate, setIsSavingDate] = useState(false);
  const { showPicker } = useDatePicker();
  const { deleteAssignment } = useContent();
  const router = useRouter();
  const { showAlert } = useAlert();

  const handleDelete = async () => {
    if (!data?.id) return;

    showAlert({
      title: "Confirm Deletion",
      message: "Are you sure you want to delete this assignment plan? This action cannot be undone.",
      iconPath: ICONS.ERROR,
      iconColor: theme.colors.error,
      confirmText: "Delete",
      showCancel: true,
      cancelText: "Cancel",
      onConfirm: async () => {
        setIsDeleting(true);
        try {
          await deleteAssignment(data.id, data.remote_id);
          router.back();
        } catch (e) {
          console.error("Failed to delete assignment:", e);
          setIsDeleting(false);
          setLoading(false);
          showAlert({
            title: "Deletion Failed",
              message: "Sorry, we couldn't delete the assignment. Please try again.",
            iconPath: ICONS.ERROR,
            iconColor: theme.colors.error,
            confirmText: "OK",
          });
        }
      },
    });
  };

  const getAssignment = useCallback(async () => {
    if (!user?.id || !id) return;
    setLoading(true);
    try {
      const localData = await LocalDB.getAssignmentById(user.id, id as string);
      if (localData && (localData as any).rawContent) {
        setData(localData);
        setLoading(false);
        return;
      }
      const response = await brAInwaveApi.getAssignment(user.id, id as string);
      if (response) setData(response);
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

  // For due date handling
  const handleDatePress = () => {
    if (!data?.id) return;

    showPicker({
      value: data.due_date ? new Date(data.due_date + "T00:00:00") : new Date(),
      mode: "date",
      title: "Set Due Date",
      minimumDate: new Date(),
      onConfirm: async (selectedDate) => {
        const year = selectedDate.getFullYear();
        const month = String(selectedDate.getMonth() + 1).padStart(2, "0");
        const day = String(selectedDate.getDate()).padStart(2, "0");
        const newDate = `${year}-${month}-${day}`;

        const existingTime = data.due_time || "";
        updateDueDate(newDate, existingTime);
      },
    });
  };

  const handleTimePress = () => {
    if (!data?.id) return;

    const baseDate = data.due_date || new Date().toISOString().split("T")[0];
    let initialDate = new Date(`${baseDate}T12:00:00`);

    if (data.due_time) {
      const timeStr = data.due_time;
      // Handle HH:MM:SS or HH:MM
      if (timeStr.includes(":") && !timeStr.includes("M")) {
        const [h, m] = timeStr.split(":");
        initialDate.setHours(parseInt(h), parseInt(m), 0);
      } 
      // Handle "11:59 PM" style
      else if (timeStr.includes("AM") || timeStr.includes("PM")) {
        const [time, ampm] = timeStr.trim().split(/\s+/);
        let [h, m] = time.split(":");
        let hh = parseInt(h);
        if (ampm === "PM" && hh < 12) hh += 12;
        if (ampm === "AM" && hh === 12) hh = 0;
        initialDate.setHours(hh, parseInt(m), 0);
      }
    }

    showPicker({
      value: initialDate,
      mode: "time",
      title: "Set Due Time",
      onConfirm: async (selectedTime) => {
        const hours = String(selectedTime.getHours()).padStart(2, "0");
        const minutes = String(selectedTime.getMinutes()).padStart(2, "0");
        const newTime = `${hours}:${minutes}:00`;

        updateDueDate(data.due_date, newTime);
      },
    });
  };

  const updateDueDate = async (dateStr: string, timeStr: string) => {
    setData((prev: any) => ({ ...prev, due_date: dateStr, due_time: timeStr }));
    setIsSavingDate(true);
    try {
      const localId = Number(data.id);
      await LocalDB.updateAssignmentDueDate(localId, dateStr, timeStr);
      if (data.remote_id) {
        await brAInwaveApi.updateAssignmentDueDate(
          data.remote_id,
          dateStr,
          timeStr,
        );
        LocalDB.markAssignmentSynced(localId, data.remote_id);
      }
    } catch (e) {
      console.error("Failed to save due date/time:", e);
      setData((prev: any) => ({
        ...prev,
        due_date: data.due_date,
        due_time: data.due_time,
      }));
    } finally {
      setIsSavingDate(false);
    }
  };

  const formatDueDate = (dateStr?: string | null, timeStr?: string | null) => {
    if (!dateStr) return "Tap to set a due date";
    const date = new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    if (timeStr) {
      let hh = 0, mm = 0;
      if (timeStr.includes("AM") || timeStr.includes("PM")) {
        const [time, ampm] = timeStr.trim().split(/\s+/);
        let [h, m] = time.split(":");
        hh = parseInt(h);
        mm = parseInt(m);
        if (ampm === "PM" && hh < 12) hh += 12;
        if (ampm === "AM" && hh === 12) hh = 0;
      } else {
        const [h, m] = timeStr.split(":");
        hh = parseInt(h);
        mm = parseInt(m);
      }
      
      const ampm = hh >= 12 ? "PM" : "AM";
      const h12 = hh % 12 || 12;
      const mPad = String(mm).padStart(2, "0");
      return `${date} at ${h12}:${mPad} ${ampm}`;
    }
    return date;
  };

  const getDueDateState = (dateStr?: string | null) => {
    if (!dateStr) return "unset";
    const daysLeft =
      (new Date(dateStr + "T00:00:00").getTime() - Date.now()) / 86400000;
    if (daysLeft < 0) return "overdue";
    if (daysLeft <= 3) return "soon";
    return "ok";
  };

  const dueDateState = getDueDateState(data?.due_date);
  const dueDateColor =
    dueDateState === "overdue"
      ? theme.colors.error
      : dueDateState === "soon"
        ? "#FF9500"
        : dueDateState === "ok"
          ? theme.colors.success
          : theme.colors.text.secondary;

  const dueDateLabel =
    dueDateState === "overdue"
      ? "Overdue"
      : dueDateState === "soon"
        ? "Due Soon"
        : "Due Date";

  // PDF export
  const exportToPDF = async () => {
    if (!data) return;
    try {
      const contentHtml = await marked.parse(
        data.rawContent || "No content analyzed.",
      );
      const html = `
      <!DOCTYPE html><html><head><style>
        body { font-family:'Helvetica','Arial',sans-serif; padding:40px; color:#333; line-height:1.6; }
        .document-header { border-bottom:2px solid ${theme.colors.primary}; padding-bottom:15px; margin-bottom:30px; }
        .meta-section { margin-bottom:20px; padding:10px; background:#f9f9f9; border-radius:8px; }
        .meta-item { font-size:14px; margin-bottom:5px; }
        h1 { color:${theme.colors.primary}; margin:0; font-size:28px; }
        .branding { font-size:10px; color:#999; text-transform:uppercase; letter-spacing:1px; margin-top:5px; }
        h2,h3 { page-break-after:avoid; break-after:avoid; color:${theme.colors.primary}; margin-top:25px; }
        pre,blockquote,img { page-break-inside:avoid; break-inside:avoid; }
        pre { background:#f8f9fa; padding:15px; border-radius:8px; border:1px solid #eee; white-space:pre-wrap; font-size:12px; font-family:'Courier New',monospace; }
        blockquote { border-left:4px solid #ddd; margin:20px 0; padding:10px 20px; background:#fcfcfc; font-style:italic; color:#555; }
        ul,ol { padding-left:25px; } li { margin-bottom:8px; } p { margin-bottom:15px; }
      </style></head><body>
        <div class="document-header">
          <h1>${data.title}</h1>
          <p class="branding">Assignment Master Plan by <span style="color:${theme.colors.primary};font-weight:bold;">brAInwave</span></p>
        </div>
        <div class="meta-section">
          <div class="meta-item"><strong>Subject:</strong> ${data.subject}</div>
          <div class="meta-item"><strong>Due Date:</strong> ${data.due_date || "Not set"}</div>
          <div class="meta-item"><strong>Priority:</strong> ${data.priority}</div>
        </div>
        <div id="content">${contentHtml}</div>
      </body></html>`;

      const { uri: printUri } = await Print.printToFileAsync({ html });
      const fileName = `${data.title.replace(/\s+/g, "_")}.pdf`;
      const tempFile = new File(printUri);
      const targetFile = new File(Paths.cache, fileName);
      if (targetFile.exists) await targetFile.delete();
      await tempFile.move(targetFile);
      if (await Sharing.isAvailableAsync())
        await Sharing.shareAsync(targetFile.uri);
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
          {/* Due date banner */}
          <View style={styles.dateBannerRow}>
            <TouchableOpacity
              onPress={handleDatePress}
              activeOpacity={0.7}
              style={[
                styles.dueDateBanner,
                {
                  backgroundColor: dueDateColor + "15",
                  borderColor: dueDateColor + "40",
                  flex: 1,
                },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.dueDateLabel,
                    { color: theme.colors.text.secondary },
                  ]}
                >
                  {dueDateLabel}
                </Text>
                <Text style={[styles.dueDateValue, { color: dueDateColor }]}>
                  {formatDueDate(data?.due_date)}
                </Text>
              </View>
              <Text
                style={{ color: dueDateColor, fontSize: 12, fontWeight: "600" }}
              >
                {isSavingDate ? "Saving..." : "Edit"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleTimePress}
              activeOpacity={0.7}
              style={[
                styles.dueTimeBanner,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.dueDateLabel,
                  { color: theme.colors.text.secondary },
                ]}
              >
                Time
              </Text>
              <Text
                style={[
                  styles.dueDateValue,
                  { color: theme.colors.text.primary },
                ]}
              >
                {data?.due_time
                  ? (() => {
                      let hh = 0, mm = 0;
                      const timeStr = data.due_time;
                      if (timeStr.includes("AM") || timeStr.includes("PM")) {
                        const [time, ampm] = timeStr.trim().split(/\s+/);
                        let [h, m] = time.split(":");
                        hh = parseInt(h);
                        mm = parseInt(m);
                        if (ampm === "PM" && hh < 12) hh += 12;
                        if (ampm === "AM" && hh === 12) hh = 0;
                      } else {
                        const [h, m] = timeStr.split(":");
                        hh = parseInt(h);
                        mm = parseInt(m);
                      }
                      const mPad = String(mm).padStart(2, "0");
                      return `${hh % 12 || 12}:${mPad} ${hh >= 12 ? "PM" : "AM"}`;
                    })()
                  : "11:59 PM"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Markdown plan content */}
          <Markdown
            style={{
              body: {
                color: theme.colors.text.primary,
                fontSize: 14,
                lineHeight: 28,
              },
              heading1: {
                color: theme.colors.primary,
                marginVertical: 10,
                fontFamily: theme.fonts.bold,
                lineHeight: 32,
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
            {sanitizeAiMarkdown(data?.rawContent) ||
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
              {isDeleting && loading ? (
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
  dateBannerRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
  },
  dueTimeBanner: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    minWidth: 110,
  },
  dueDateBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  dueDateLabel: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  dueDateValue: { fontSize: 16, fontWeight: "700" },
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
