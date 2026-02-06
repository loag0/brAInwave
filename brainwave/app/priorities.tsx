import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import DraggableFlatList, { ScaleDecorator, RenderItemParams } from "react-native-draggable-flatlist"
import * as Haptics from "expo-haptics";
import { useAuth } from "./contexts/AuthContext";
import { useTheme } from "./contexts/ThemeContext";
import Svg, { Path } from "react-native-svg";
import { useRouter } from "expo-router"

interface IconProps {
    size: number,
    color: string
}

export default function SubjectPriorities() {
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme, isDark), [theme, isDark]);
  const router = useRouter();
  const { user, updateProfileData } = useAuth();
  const [subjects, setSubjects] = useState(
    user?.studyPreferences.subjects || [],
  );
  const [saving, setSaving] = useState(false);

  const ChevronUpIcon: React.FC<IconProps> = ({ size, color }) => (
    <Svg width={size} height={size} viewBox="0 -960 960 960" fill="none">
      <Path
        d="M480-528 296-344l-56-56 240-240 240 240-56 56-184-184Z"
        fill={color}
      />
    </Svg>
  );

  const ChevronDownIcon: React.FC<IconProps> = ({ size, color }) => (
    <Svg width={size} height={size} viewBox="0, -960 960 960" fill="none">
      <Path d="M480-344 240-584l56-56 184 184 184-184 56 56-240 240Z" fill={color} />
    </Svg>
  );
  
  const ChevronLeftIcon: React.FC<IconProps> = ({ size, color }) => (
    <Svg width={size} height={size} viewBox="0, -960 960 960" fill="none">
      <Path
        d="M560-240 320-480l240-240 56 56-184 184 184 184-56 56Z"
        fill={color}
      />
    </Svg>
  );

  const SaveIcon: React.FC<IconProps> = ({ size, color }) => (
    <Svg>
        <Path 
            d="M840-680v480q0 33-23.5 56.5T760-120H200q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h480l160 160Zm-80 34L646-760H200v560h560v-446ZM565-275q35-35 35-85t-35-85q-35-35-85-35t-85 35q-35 35-35 85t35 85q35 35 85 35t85-35ZM240-560h360v-160H240v160Zm-40-86v446-560 114Z"
            fill={color}/>
    </Svg>
  );

  const CheckIcon: React.FC<IconProps> = ({ size, color }) => (
    <Svg width={size} height={size} viewBox="0 -960 960 960" fill="none">
      <Path
        d="M382-240 154-468l57-57 171 171 367-367 57 57-424 424Z"
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

  const moveSubject = (index: number, direction: "up" | "down") => {
    const newSubjects = [...subjects];
    const swapIndex = direction === "up" ? index - 1 : index + 1;

    if (swapIndex < 0 || swapIndex >= newSubjects.length) return;

    [newSubjects[index], newSubjects[swapIndex]] = [
      newSubjects[swapIndex],
      newSubjects[index],
    ];
    setSubjects(newSubjects);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProfileData({
        studyPreferences: { ...user!.studyPreferences, subjects },
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => router.back(), 600);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

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
            style={[
              styles.priorityCard,
              isActive && styles.activeCard, // Hover effect
            ]}
          >
            <View style={styles.cardLeft}>
              <View style={styles.numberBadge}>
                <Text style={styles.numberText}>
                  {subjects.indexOf(item) + 1}
                </Text>
              </View>
              <Text style={styles.subjectName}>{item}</Text>
            </View>

            {/* Drag Indicator Icon */}
            <TouchableOpacity onPressIn={drag} style={styles.dragHandle}>
              <DragIcon color={theme.colors.text.secondary} size={20} />
            </TouchableOpacity>
          </TouchableOpacity>
        </ScaleDecorator>
      );
    },
    [subjects, theme],
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <ChevronLeftIcon color={theme.colors.text.primary} size={24} />
        </TouchableOpacity>
        <View>
          <Text style={styles.title}>AI Priorities</Text>
          <Text style={styles.subtitle}>Hold & drag to reorder focus</Text>
        </View>
      </View>

      <DraggableFlatList
        data={subjects}
        onDragEnd={({ data }) => {
          setSubjects(data);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); // Vibration on drop/switch
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
            <Text style={styles.saveText}>Save Order</Text>
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
      padding: 20,
      flexDirection: "row",
      alignItems: "center",
      gap: 15,
    },
    backButton: {
      padding: 8,
      borderRadius: 12,
      backgroundColor: isDark ? theme.colors.border + "30" : "#F0F0F0",
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
      // This is the "Hover" state
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

