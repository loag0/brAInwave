import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Animated,
  Dimensions,
} from "react-native";
import { Theme } from "../app/types";
import { useTheme } from "../app/contexts/ThemeContext";

interface MinutePickerProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (minutes: number) => void;
  theme: Theme;
  initial?: number;
  existingDurations?: number[];
}

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const ITEM_HEIGHT = 48;
const MINUTES = Array.from({ length: 36 }, (_, i) => (i + 1) * 5);

export default function MinutePicker({
  visible,
  onClose,
  onConfirm,
  theme,
  initial = 25,
}: MinutePickerProps) {
  const [pickedMinutes, setPickedMinutes] = useState(initial);
  const { isDark } = useTheme();
  const styles = createStyles(theme, isDark);

  const flatListRef = useRef<FlatList>(null);
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  // Scroll to initial value and animate in when opened
  useEffect(() => {
    if (visible) {
      setPickedMinutes(initial);
      const index = MINUTES.indexOf(initial);
      setTimeout(() => {
        if (index >= 0) {
          flatListRef.current?.scrollToOffset({
            offset: index * ITEM_HEIGHT,
            animated: false,
          });
        }
      }, 50);

      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 180,
          friction: 12,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scaleAnim.setValue(0.95);
      opacityAnim.setValue(0);
    }
  }, [visible, initial, scaleAnim, opacityAnim]);

  return (
    <Modal visible={visible} transparent animationType="none">
      <Animated.View style={[styles.overlay, { opacity: opacityAnim }]}>
        <Animated.View
          style={[styles.sheet, { transform: [{ scale: scaleAnim }] }]}
        >
          <Text style={styles.title}>Duration</Text>
          <Text style={styles.subtitle}>Scroll to pick minutes</Text>

          {/* Drum scroll */}
          <View style={styles.drumWrapper}>
            {/* Selection highlight bar */}
            <View style={styles.selectionBar} pointerEvents="none" />

            <FlatList
              ref={flatListRef}
              data={MINUTES}
              keyExtractor={(item) => item.toString()}
              showsVerticalScrollIndicator={false}
              snapToInterval={ITEM_HEIGHT}
              decelerationRate="fast"
              contentContainerStyle={{ paddingVertical: ITEM_HEIGHT * 2 }}
              onMomentumScrollEnd={(e) => {
                const index = Math.round(
                  e.nativeEvent.contentOffset.y / ITEM_HEIGHT,
                );
                setPickedMinutes(
                  MINUTES[Math.max(0, Math.min(index, MINUTES.length - 1))],
                );
              }}
              renderItem={({ item, index }) => {
                const isSelected = item === pickedMinutes;
                const selectedIndex = MINUTES.indexOf(pickedMinutes);
                const distance = Math.abs(index - selectedIndex);
                return (
                  <View style={styles.item}>
                    <Text
                      style={[
                        styles.itemText,
                        {
                          color: isSelected
                            ? theme.colors.primary
                            : isDark
                              ? `rgba(255,255,255,${Math.max(0.15, 0.55 - distance * 0.15)})`
                              : `rgba(0,0,0,${Math.max(0.12, 0.45 - distance * 0.12)})`,
                          fontSize: isSelected ? 28 : 22,
                          fontWeight: isSelected ? "700" : "400",
                        },
                      ]}
                    >
                      {item}
                    </Text>
                    {isSelected && (
                      <Text
                        style={[
                          styles.unitLabel,
                          { color: theme.colors.primary },
                        ]}
                      >
                        min
                      </Text>
                    )}
                  </View>
                );
              }}
            />
          </View>

          {/* Buttons */}
          <View style={styles.btnRow}>
            <TouchableOpacity
              style={[
                styles.cancelBtn,
                { borderColor: theme.colors.primary + "30" },
              ]}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.cancelText,
                  { color: theme.colors.text.secondary },
                ]}
              >
                Cancel
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.confirmBtn,
                { backgroundColor: theme.colors.primary },
              ]}
              onPress={() => {
                onConfirm(pickedMinutes);
                onClose();
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.confirmText}>Done</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const createStyles = (theme: Theme, isDark: boolean) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "center",
      alignItems: "center",
    },
    sheet: {
      width: SCREEN_WIDTH * 0.82,
      backgroundColor: theme.colors.surface,
      borderRadius: 24,
      paddingTop: 28,
      paddingBottom: 24,
      paddingHorizontal: 24,
      alignItems: "center",
      shadowColor: isDark ? "#000" : "#667",
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.18,
      shadowRadius: 30,
      elevation: 16,
    },
    title: {
      fontSize: 18,
      fontWeight: "700",
      letterSpacing: -0.3,
      color: theme.colors.text.primary,
      marginBottom: 4,
    },
    subtitle: {
      fontSize: 12,
      color: theme.colors.text.secondary,
      opacity: 0.6,
      marginBottom: 20,
    },
    drumWrapper: {
      height: ITEM_HEIGHT * 5,
      width: "100%",
      overflow: "hidden",
      position: "relative",
      marginBottom: 28,
    },
    selectionBar: {
      position: "absolute",
      top: ITEM_HEIGHT * 2,
      left: 16,
      right: 16,
      height: ITEM_HEIGHT,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: theme.colors.primary + "40",
      backgroundColor: theme.colors.primary + "12",
      zIndex: 1,
    },
    item: {
      height: ITEM_HEIGHT,
      justifyContent: "center",
      alignItems: "center",
      flexDirection: "row",
      gap: 6,
    },
    itemText: {
      letterSpacing: 0.5,
    },
    unitLabel: {
      fontSize: 13,
      fontWeight: "600",
      opacity: 0.7,
      marginTop: 4,
    },
    btnRow: {
      flexDirection: "row",
      gap: 12,
      width: "100%",
    },
    cancelBtn: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 14,
      alignItems: "center",
      borderWidth: 1.5,
    },
    cancelText: {
      fontSize: 15,
      fontWeight: "500",
    },
    confirmBtn: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 14,
      alignItems: "center",
    },
    confirmText: {
      color: "#fff",
      fontSize: 15,
      fontWeight: "600",
    },
  });
