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
import { useAlert } from "../contexts/AlertContext";
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
  ICONS,
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
  const { showAlert } = useAlert();
  const router = useRouter();
  const navigation = useNavigation();
  const [isPickerVisible, setPickerVisible] = useState(false);        // preset chips modal
  const [isTimePickerVisible, setTimePickerVisible] = useState(false); // drum scroll modal
  const [customDurations, setCustomDurations] = useState<number[]>([]);
  const [pressedDuration, setPressedDuration] = useState<number | null>(null);
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

  const handlePreset = (mins: number) => {
    const safeMins = Math.min(Math.max(mins, 1), 180);
    setPressedDuration(mins);
    setTimeout(() => {
      setPressedDuration(null);
      setDuration(safeMins);
      setPickerVisible(false);
    }, 200);
  };

  const toggleTimer = async () => {
    try {
      if (!isRunning) {
        const totalSecs = minutes * 60 + seconds;
        if (totalSecs <= 0) return;

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
              seconds: totalSecs,
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
          startSession(minutes);
        } else {
          setIsRunning(true);
        }
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (notificationId) {
          await Notifications.cancelScheduledNotificationAsync(notificationId);
          setNotificationId(null);
        }
        setIsRunning(false);
      }
    } catch (e) {
      console.error("Notification error", e);
    }
  };

  const handleStop = async () => {
    if (isRunning) {
      const confirmed = await new Promise((resolve) => {
        showAlert({
          title: "Stop Session?",
          message:
            "Stopping now will break your focus streak! This session won't be recorded.",
          confirmText: "Stop Anyway",
          cancelText: "Keep Going",
          showCancel: true,
          onConfirm: () => resolve(true),
          onCancel: () => resolve(false),
          iconPath: ICONS.ERROR,
          iconColor: theme.colors.error,
        });
      });
      if (!confirmed) return;
    }

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
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Minimize */}
      {isRunning && (
        <TouchableOpacity style={styles.minimizeBtn} onPress={handleMinimize}>
          <ChevronDownIcon size={28} color={theme.colors.text.primary} />
        </TouchableOpacity>
      )}

      {/* Timer circle */}
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
          <Text style={[styles.timerText, { color: theme.colors.text.primary }]}>
            {String(minutes).padStart(2, "0")}:
            {String(seconds).padStart(2, "0")}
          </Text>
          {!isRunning && (
            <Text style={{ color: theme.colors.primary }}>Tap to set time</Text>
          )}
          {isRunning && (
            <Text style={{ color: theme.colors.primary }}>Stay locked in twin</Text>
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
              style={[styles.mainBtn, { backgroundColor: theme.colors.primary }]}
              onPress={toggleTimer}
            >
              <Text style={styles.mainBtnText}>Focus</Text>
            </TouchableOpacity>
          )}

          {(isRunning || (remainingSeconds < totalSeconds && remainingSeconds > 0)) && (
            <TouchableOpacity onPress={handleStop} style={styles.stopBtn}>
              <StopIcon size={44} color={theme.colors.primary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Preset chips modal — tap circle to open */}
      <Modal visible={isPickerVisible} transparent animationType="none">
        <Animated.View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            onPress={() => setPickerVisible(false)}
            activeOpacity={1}
          />
          <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text.primary }]}>
              Set Duration
            </Text>
            <Text style={[styles.modalHint, { color: theme.colors.text.secondary }]}>
              Hold to remove custom
            </Text>

            <View style={styles.presetRow}>
              {[15, 25, 45, ...customDurations].map((m) => {
                const isCustom = ![15, 25, 45].includes(m);
                return (
                  <TouchableOpacity
                    key={m}
                    style={[
                      styles.presetBtn,
                      {
                        backgroundColor: pressedDuration === m
                          ? theme.colors.primary
                          : isDark
                            ? "rgba(255,255,255,0.07)"
                            : "rgba(0,0,0,0.05)",
                        borderWidth: isCustom ? 1 : 0,
                        borderColor: theme.colors.primary + "50",
                      },
                    ]}
                    onPress={() => handlePreset(m)}
                    onLongPress={() => {
                      if (customDurations.includes(m)) {
                        setCustomDurations((prev) => prev.filter((x) => x !== m));
                        Toast.show({
                          type: "info",
                          text1: `${m}m removed`,
                          position: "bottom",
                        });
                      }
                    }}
                    delayLongPress={500}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.presetText, { color: pressedDuration === m ? "#fff" : theme.colors.text.primary }]}>
                      {m}m
                    </Text>
                    {isCustom && (
                      <View style={[styles.customDot, { backgroundColor: theme.colors.primary }]} />
                    )}
                  </TouchableOpacity>
                );
              })}

              {/* + closes preset modal, opens drum scroll */}
              <TouchableOpacity
                style={[
                  styles.presetBtn,
                  styles.addBtn,
                  {
                    borderColor: theme.colors.primary + "60",
                    backgroundColor: isDark
                      ? "rgba(255,255,255,0.04)"
                      : "rgba(0,0,0,0.03)",
                  },
                ]}
                onPress={() => {
                  setPickerVisible(false);
                  setTimePickerVisible(true);
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.addBtnText, { color: theme.colors.primary }]}>＋</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => setPickerVisible(false)}
              activeOpacity={0.7}
            >
              <Text style={[styles.cancelText, { color: theme.colors.error }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Modal>

      {/* Drum scroll — for adding a new custom duration */}
      <MinutePicker
        visible={isTimePickerVisible}
        onClose={() => {
          setTimePickerVisible(false);
          setPickerVisible(true);
        }}
        onConfirm={(mins) => {
          const safeMins = Math.min(Math.max(mins, 1), 180);
          if (!customDurations.includes(safeMins)) {
            setCustomDurations((prev) => [...prev, safeMins].sort((a, b) => a - b));
          } else {
            Toast.show({ type: "error", text1: "Duration already added!", position: "bottom" });
          }
          setTimePickerVisible(false);
          setPickerVisible(true);
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
    stopBtn: {
      padding: 10,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "flex-end",
      paddingBottom: 30,
      paddingHorizontal: 16,
    },
    modalContent: {
      borderRadius: 26,
      paddingTop: 28,
      paddingBottom: 20,
      paddingHorizontal: 22,
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.15,
      shadowRadius: 24,
      elevation: 20,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: "700",
      letterSpacing: -0.4,
      marginBottom: 4,
    },
    modalHint: {
      fontSize: 12,
      opacity: 0.55,
      marginBottom: 22,
    },
    presetRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
      marginBottom: 24,
    },
    presetBtn: {
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
      minWidth: 70,
    },
    presetText: {
      fontSize: 15,
      fontWeight: "500",
      letterSpacing: 0.2,
    },
    customDot: {
      width: 5,
      height: 5,
      borderRadius: 3,
      position: "absolute",
      top: 6,
      right: 6,
    },
    addBtn: {
      borderWidth: 1.5,
      borderStyle: "dashed",
    },
    addBtnText: {
      fontSize: 20,
      fontWeight: "300",
      lineHeight: 22,
    },
    cancelBtn: {
      alignItems: "center",
      paddingVertical: 10,
    },
    cancelText: {
      fontSize: 15,
      fontWeight: "500",
    },
  });