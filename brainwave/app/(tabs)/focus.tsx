import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Animated,
} from "react-native";
import Toast from "react-native-toast-message";
import * as Haptics from "expo-haptics";
import { useTimer } from "../contexts/TimerContext";
import { useTheme } from "../contexts/ThemeContext";
import MinutePicker from "@/components/MinutePicker";
import { Theme } from "../types";
import { useKeepAwake } from "expo-keep-awake";
import * as Notifications from "expo-notifications";
import { SchedulableTriggerInputTypes } from "expo-notifications";
import Svg, { Circle } from "react-native-svg";
import {
  ChevronDownIcon,
  StopIcon,
  PauseIcon,
  PlayIcon,
} from "@/components/Icons";
import { useNavigation, useRouter } from "expo-router";
import { ensureNotificationPermission } from "@/utils/notifications";

const CIRCLE_LENGTH = 1000;
const R = 159;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export default function FocusScreen() {
  const { theme, isDark } = useTheme();
  const router = useRouter();
  const navigation = useNavigation();
  const [isPickerVisible, setPickerVisible] = useState(false);
  const [customDurations, setCustomDurations] = useState<number[]>([]);
  const [isTimePickerVisible, setTimePickerVisible] = useState(false);
  const [notificationId, setNotificationId] = useState<string | null>(null);

  const AnimatedCircle = Animated.createAnimatedComponent(Circle);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const styles = createStyles(theme, isDark);

  const {
    minutes,
    seconds,
    isRunning,
    setIsRunning,
    resetTimer,
    startSession,
    setDuration,
    totalSeconds,
  } = useTimer();

  useKeepAwake();

  useEffect(() => {
    ensureNotificationPermission();
  }, []);

  useEffect(() => {
    const parent = navigation.getParent()?.getParent();
    if (!parent) return;

    parent.setOptions({
      tabBarStyle: isRunning
        ? { display: "none" }
        : {
            display: "flex",
            backgroundColor: theme.colors.background,
            borderTopColor: theme.colors.border,
            borderTopWidth: 1,
          },
    });
  }, [isRunning, navigation, theme]);

  const remainingSeconds = minutes * 60 + seconds;

  useEffect(() => {
    const progress = totalSeconds > 0 ? remainingSeconds / totalSeconds : 0;

    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 900,
      useNativeDriver: true,
    }).start();
  }, [remainingSeconds, progressAnim, totalSeconds]);

  const strokeDashOffset = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [CIRCLE_LENGTH, 0],
  });

  const handlePreset = async (mins: number) => {
    const safeMins = Math.min(Math.max(mins, 1), 180);
    setDuration(safeMins);
    setPickerVisible(false);
    setTimePickerVisible(false);
  };

  const toggleTimer = async () => {
    try {
      if (!isRunning) {
        const totalSeconds = minutes * 60 + seconds;
        if (totalSeconds <= 0) return;

        // Check/request permissions
        const hasPermission = await ensureNotificationPermission();

        if (hasPermission) {
          const id = await Notifications.scheduleNotificationAsync({
            content: {
              title: "Focus session complete",
              body: "Time for a well-deserved break",
              sound: true,
            },
            trigger: {
              type: SchedulableTriggerInputTypes.TIME_INTERVAL,
              seconds: totalSeconds,
            },
          });
          setNotificationId(id);
        } else {
          Toast.show({
            type: "info",
            text1: "Notifications disabled",
            text2: "You won't be alerted when the timer ends.",
            position: "bottom",
          });
        }

        if (remainingSeconds === totalSeconds) {
          // Starting a fresh session
          startSession(minutes);
        } else {
          // Resuming a paused session
          setIsRunning(true);
        }
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        if (notificationId) {
          await Notifications.cancelScheduledNotificationAsync(notificationId);
          setNotificationId(null);
        }
        setIsRunning(false);
        // Don't reset the timer here - just pause it
      }
    } catch (e) {
      console.error("Notification error", e);
    }
  };

  const handleStop = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    resetTimer();
    setIsRunning(false);

    if (notificationId) {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
      setNotificationId(null);
    }
  };

  const handleMinimize = () => {
    router.push("/(tabs)");
  };

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      {/* Minimize */}
      {isRunning && (
        <TouchableOpacity style={styles.minimizeBtn} onPress={handleMinimize}>
          <ChevronDownIcon size={28} color={theme.colors.text.primary} />
        </TouchableOpacity>
      )}

      {/* Timer */}
      <TouchableOpacity
        disabled={isRunning}
        onPress={() => setPickerVisible(true)}
        style={styles.circleContainer}
      >
        <Svg width={350} height={350} viewBox="0 0 350 350">
          <Circle
            cx="175"
            cy="175"
            r={R}
            stroke={isDark ? theme.colors.surface : "#f0f0f0"}
            strokeWidth="10"
            fill="transparent"
          />
          <AnimatedCircle
            cx="175"
            cy="175"
            r={R}
            stroke={theme.colors.primary}
            strokeWidth="12"
            fill="transparent"
            strokeDasharray={CIRCLE_LENGTH}
            strokeDashoffset={strokeDashOffset}
            strokeLinecap="round"
            transform="rotate(-90 175 175)"
          />
        </Svg>

        <View style={styles.timeLabelContainer}>
          <Text
            style={[styles.timerText, { color: theme.colors.text.primary }]}
          >
            {String(minutes).padStart(2, "0")}:
            {String(seconds).padStart(2, "0")}
          </Text>
          {!isRunning && (
            <Text style={{ color: theme.colors.primary }}>Tap to set time</Text>
          )}
          {isRunning && (
            <Text style={{ color: theme.colors.primary }}>
              Stay locked in twin
            </Text>
          )}
        </View>
      </TouchableOpacity>

      {/* Controls */}
      <View style={{ width: "80%", alignItems: "center", marginTop: 40 }}>
        <View style={styles.controlsRow}>
          {isRunning ? (
            <TouchableOpacity onPress={toggleTimer} style={styles.stopBtn}>
              <PauseIcon size={44} color={theme.colors.primary} />
            </TouchableOpacity>
          ) : remainingSeconds < totalSeconds && remainingSeconds > 0 ? (
            <TouchableOpacity onPress={toggleTimer} style={styles.stopBtn}>
              <PlayIcon size={44} color={theme.colors.primary} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[
                styles.mainBtn,
                { backgroundColor: theme.colors.primary },
              ]}
              onPress={toggleTimer}
            >
              <Text style={styles.mainBtnText}>Focus</Text>
            </TouchableOpacity>
          )}

          {(isRunning ||
            (remainingSeconds < totalSeconds && remainingSeconds > 0)) && (
            <TouchableOpacity onPress={handleStop} style={styles.stopBtn}>
              <StopIcon size={44} color={theme.colors.primary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Picker */}
      <Modal visible={isPickerVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              { backgroundColor: theme.colors.surface },
            ]}
          >
            <Text
              style={[styles.modalTitle, { color: theme.colors.text.primary }]}
            >
              Set Duration
            </Text>

            <View style={styles.presetRow}>
              {[15, 25, 45, ...customDurations].map((m) => (
                <TouchableOpacity
                  key={m}
                  style={styles.presetBtn}
                  onPress={() => handlePreset(m)}
                  onLongPress={() => {
                    if (customDurations.includes(m)) {
                      setCustomDurations((prev) => prev.filter((x) => x !== m));
                      Toast.show({
                        type: "info",
                        text1: `${m}mins, removed`,
                        position: "bottom",
                      });
                    }
                  }}
                >
                  <Text style={styles.presetText}>{m}m</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.customRow}>
              <TouchableOpacity
                style={styles.addBtn}
                onPress={() => setTimePickerVisible(true)}
              >
                <Text style={{ color: "#fff", fontSize: 28 }}>+</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity onPress={() => setPickerVisible(false)}>
              <Text style={{ marginTop: 20, color: theme.colors.error }}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <MinutePicker
        visible={isTimePickerVisible}
        onClose={() => setTimePickerVisible(false)}
        onConfirm={(mins) => {
          if (customDurations.includes(mins)) {
            Toast.show({
              type: "error",
              text1: "Duration already added!",
              position: "bottom",
            });
            return;
          }
          setCustomDurations((prev) => [...prev, mins].sort((a, b) => a - b));
        }}
        theme={theme}
        initial={25}
        existingDurations={customDurations}
      />
    </View>
  );
}

const createStyles = (theme: Theme, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    timerText: {
      fontSize: 90,
      fontWeight: "200",
      letterSpacing: -2,
    },
    controlsRow: {
      width: "100%",
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      position: "relative",
      gap: 20,
    },
    mainBtn: {
      minWidth: 50,
      paddingHorizontal: 40,
      paddingVertical: 15,
      borderRadius: 30,
      elevation: 2,
      zIndex: 1,
    },
    mainBtnText: {
      color: "white",
      fontSize: 20,
      fontWeight: "600",
    },
    circleContainer: {
      justifyContent: "center",
      alignItems: "center",
      position: "relative",
    },
    timeLabelContainer: {
      position: "absolute",
      alignItems: "center",
    },
    minimizeBtn: {
      position: "absolute",
      top: 50,
      left: 15,
      padding: 10,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "center",
      alignItems: "center",
    },
    modalContent: {
      width: "80%",
      padding: 30,
      borderRadius: 20,
      alignItems: "center",
    },
    presetRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 15,
      marginVertical: 20,
    },
    presetText: {
      fontWeight: "600",
      color: theme.colors.secondary,
    },
    presetBtn: {
      paddingHorizontal: 52,
      paddingVertical: 7,
      backgroundColor: theme.colors.primary,
      borderRadius: 12,
    },
    customRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    input: {
      borderWidth: 1,
      padding: 10,
      borderRadius: 10,
      width: 100,
      textAlign: "center",
    },
    addBtn: {
      backgroundColor: theme.colors.primary,
      width: 45,
      height: 45,
      borderRadius: 22.5,
      justifyContent: "center",
      alignItems: "center",
    },
    stopBtn: {
      padding: 10,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: "700",
      marginBottom: 20,
    },
  });
