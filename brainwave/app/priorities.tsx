import React, { useState, useCallback, useMemo, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import {SafeAreaView} from "react-native-safe-area-context";
import DraggableFlatList, {
  ScaleDecorator,
  RenderItemParams,
} from "react-native-draggable-flatlist";
import * as Haptics from "expo-haptics";
import { useAuth } from "./contexts/AuthContext";
import { useTheme } from "./contexts/ThemeContext";
import { useAlert } from "./contexts/AlertContext";
import { useRouter } from "expo-router";
import Svg, { Path } from "react-native-svg";
import { LocalDB } from "./database/localDb";

interface IconProps {
  size: number;
  color: string;
}

export default function SubjectPriorities() {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme, isDark), [theme, isDark]);
  const router = useRouter();
  const { showAlert } = useAlert();
  const { user, updateProfileData } = useAuth();

  const [subjects, setSubjects] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 1. Load subjects from LocalDB on mount
  // 1. Load subjects from LocalDB and merge with existing rankings
  useEffect(() => {
    if (!user?.id) return;

    const loadSubjects = async () => {
      const timetables = await LocalDB.getAllTimetables(user.id);
      const subjectSet = new Set<string>();

      // Extract subjects from local timetables
      timetables.forEach((tt: any) => {
        if (tt.structuredData) {
          Object.values(tt.structuredData).forEach((dayItems: any) => {
            if (Array.isArray(dayItems)) {
              dayItems.forEach((item) => {
                let name = item.subject || item.course || item.name;
                if (name) {
                  const cleanedName = name
                    .replace(
                      /\b(LAB|LECTURE|LEC|TUTORIAL|TUT|PRACTICAL|PRAC)\b/gi,
                      "",
                    )
                    .trim();
                  subjectSet.add(cleanedName);
                }
              });
            }
          });
        }
      });

      const extractedSubjects = Array.from(subjectSet);

      // If the user already has saved priorities, use those as the base.
      const savedPriorities = user.studyPreferences?.subjectPriorities || [];

      if (savedPriorities.length > 0) {

        // 1. Filter out subjects that no longer exist in the timetable
        const stillValid = savedPriorities.filter((s) =>
          extractedSubjects.includes(s),
        );

        const newOnes = extractedSubjects.filter(
          (s) => !savedPriorities.includes(s),
        );

        setSubjects([...stillValid, ...newOnes]);
      } else {
        setSubjects(extractedSubjects);
      }

      setIsLoading(false);
    };

    loadSubjects();
  }, [user?.id, user?.studyPreferences?.subjectPriorities]);

  const handleSave = async () => {
    if (!user?.id) return;
    setSaving(true);
    
    try {
      // Updates the studyPreferences map in Firestore
      await updateProfileData({
        studyPreferences: {
          ...user.studyPreferences,
          subjectPriorities: subjects,
        },
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      setTimeout(() => router.back(), 500);
    } catch (e) {
      console.error("Failed to save priorities:", e);
      showAlert({
        title: "Save Failed",
        message: "We couldn't reach the cloud. Check your connection brev.",
        confirmText: "Retry",
        showCancel: true,
        onConfirm: handleSave,
      });
    } finally {
      setSaving(false);
    }
  };

  const CloudIcon: React.FC<IconProps> = ({ size, color }) => (
    <Svg width={size} height={size} viewBox="0 -960 960 960" fill="none">
      <Path
        d={
          saving
            ? "M260-160q-91 0-155.5-63T40-377q0-78 47-139t123-78q25-92 100-149t170-57q117 0 198.5 81.5T760-520q69 8 114.5 59.5T920-340q0 75-52.5 127.5T740-160H520q-33 0-56.5-23.5T440-240v-206l-64 62-56-56 160-160 160 160-56 56-64-62v206h220q42 0 71-29t29-71q0-42-29-71t-71-29h-60v-80q0-83-58.5-141.5T480-720q-83 0-141.5 58.5T280-520h-20q-58 0-99 41t-41 99q0 58 41 99t99 41h100v80H260Zm220-280Z"
            : "m414-280 226-226-58-58-169 169-84-84-57 57 142 142ZM260-160q-91 0-155.5-63T40-377q0-78 47-139t123-78q25-92 100-149t170-57q117 0 198.5 81.5T760-520q69 8 114.5 59.5T920-340q0 75-52.5 127.5T740-160H260Zm0-80h480q42 0 71-29t29-71q0-42-29-71t-71-29h-60v-80q0-83-58.5-141.5T480-720q-83 0-141.5 58.5T280-520h-20q-58 0-99 41t-41 99q0 58 41 99t99 41Zm220-240Z"
        }
        fill={color}
      />
    </Svg>
  );

  const DragIcon: React.FC<IconProps> = ({ size, color }) => (
    <Svg width={size} height={size} viewBox="0 -960 960 960" fill="none">
      <Path
        d="M360-160q-33 0-56.5-23.5T280-240q0-33 23.5-56.5T360-320q33 0 56.5 23.5T440-240q0 33-23.5 56.5T360-160Zm240 0q-33 0-56.5-23.5T520-240q0-33 23.5-56.5T600-320q33 0 56.5 23.5T680-240q0 33-23.5 56.5T600-160ZM360-400q-33 0-56.5-23.5T280-480q0-33 23.5-56.5T360-560q33 0 56.5 23.5T440-480q0 33-23.5 56.5T360-400Zm240 0q-33 0-56.5-23.5T520-480q0-33 23.5-56.5T600-560q33 0 56.5 23.5T680-480q0 33-23.5 56.5T600-400ZM360-640q-33 0-56.5-23.5T280-720q0-33 23.5-56.5T360-800q33 0 56.5 23.5T440-720q0 33-23.5 56.5T360-640Zm240 0q-33 0-56.5-23.5T520-720q0-33 23.5-56.5T600-800q33 0 56.5 23.5T680-720q0 33-23.5 56.5T600-640Z"
        fill={color}
      />
    </Svg>
  );

  const renderItem = useCallback(
    ({ item, drag, isActive }: RenderItemParams<string>) => {
      return (
        <ScaleDecorator>
          <TouchableOpacity
            activeOpacity={1}
            onLongPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              drag();
            }}
            style={[styles.priorityCard, isActive && styles.activeCard]}
          >
            <View style={styles.cardLeft}>
              <View style={styles.numberBadge}>
                <Text style={styles.numberText}>
                  {subjects.indexOf(item) + 1}
                </Text>
              </View>
              <Text style={styles.subjectName}>{item}</Text>
            </View>
            <View style={styles.dragHandle}>
              <DragIcon color={theme.colors.text.secondary} size={20} />
            </View>
          </TouchableOpacity>
        </ScaleDecorator>
      );
    },
    [subjects, theme, styles],
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator style={{ flex: 1 }} color={theme.colors.primary} />
      </SafeAreaView>
    );
  }

  if (subjects.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            padding: 40,
          }}
        >
          <Text
            style={[styles.title, { textAlign: "center", marginBottom: 10 }]}
          >
            No Subjects Found
          </Text>
          <Text style={[styles.subtitle, { textAlign: "center" }]}>
            Upload your timetable first so we can identify your subjects.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text
            style={[
              styles.subtitle,
              {
                fontSize: 18,
                fontWeight: "600",
                color: theme.colors.text.primary,
              },
            ]}
          >
            Focus Order
          </Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              marginTop: 2,
            }}
          >
            <CloudIcon
              size={14}
              color={saving ? theme.colors.primary : theme.colors.success}
            />
            <Text style={[styles.subtitle, { fontSize: 12 }]}>
              {saving ? "Syncing to cloud..." : "Saved to your profile"}
            </Text>
          </View>
        </View>
      </View>

      <DraggableFlatList
        data={subjects}
        onDragEnd={({ data }) => {
          setSubjects(data);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }}
        keyExtractor={(item) => item}
        renderItem={renderItem}
        containerStyle={styles.listContainer}
        contentContainerStyle={styles.scrollContent}
      />

      <View style={styles.footer}>
        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          style={styles.saveButton}
        >
          {saving ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.saveText}>Save Focus Order</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (theme: any, isDark: boolean) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    header: {
      marginTop: -32,
      paddingHorizontal: 30,
      paddingVertical: 15,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border + "30",
      flexDirection: "row",
      alignItems: "center",
    },
    title: {
      fontSize: 22,
      fontWeight: "700",
      color: theme.colors.text.primary,
    },
    subtitle: { fontSize: 14, color: theme.colors.text.secondary },
    listContainer: { flex: 1 },
    scrollContent: { padding: 20, paddingBottom: 100 },
    priorityCard: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: theme.colors.card,
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.colors.border + "50",
    },
    activeCard: {
      backgroundColor: isDark ? theme.colors.border : "#FFFFFF",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.3,
      shadowRadius: 15,
      elevation: 10,
      zIndex: 99,
      borderColor: theme.colors.primary,
    },
    cardLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
    numberBadge: {
      width: 28,
      height: 28,
      borderRadius: 8,
      backgroundColor: theme.colors.primary + "15",
      alignItems: "center",
      justifyContent: "center",
    },
    numberText: {
      color: theme.colors.primary,
      fontWeight: "bold",
      fontSize: 12,
    },
    subjectName: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.text.primary,
    },
    dragHandle: { padding: 4 },
    footer: {
      padding: 20,
      paddingBottom: 40,
      backgroundColor: theme.colors.background,
    },
    saveButton: {
      backgroundColor: theme.colors.primary,
      height: 56,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
    },
    saveText: { color: "#FFF", fontSize: 16, fontWeight: "bold" },
  });
