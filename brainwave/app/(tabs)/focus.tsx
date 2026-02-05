import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useTimer } from "../contexts/TimerContext";
import { useTheme } from "../contexts/ThemeContext";
import { useKeepAwake } from "expo-keep-awake";
import * as Notifications from "expo-notifications";
import { SchedulableTriggerInputTypes } from "expo-notifications";
import { useAlert } from "../contexts/AlertContext";

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
  const { theme } = useTheme();
  const { showAlert } = useAlert();
  const [notificationId, setNotificationId] = useState<string | null>(null);

  const {
    minutes,
    seconds,
    isRunning,
    setIsRunning, // Ensure your context exports this
    resetTimer,
    isKeepAwake,
    setIsKeepAwake,
  } = useTimer();

  useKeepAwake();

  const requestPermissions = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== "granted") {
      showAlert({
        title: "Error!",
        message: "Enable notifications to hear the timer while in other apps",
      });
    }
  };

  useEffect(() => {
    requestPermissions();
  });

  const toggleTimer = async () => {
    try {
      if (!isRunning) {
        const totalSeconds = minutes * 60 + seconds;

        // Don't schedule if time is already zero
        if (totalSeconds > 0) {
          const identifier = await Notifications.scheduleNotificationAsync({
            content: {
              title: "Focus Session Complete! 🧠",
              body: "Time for a well-deserved break",
              sound: true,
            },
            trigger: { 
              type: SchedulableTriggerInputTypes.TIME_INTERVAL,
              seconds: totalSeconds },
          });
          setNotificationId(identifier);
        }
      } else {
        if (notificationId) {
          await Notifications.cancelScheduledNotificationAsync(notificationId);
          setNotificationId(null);
        }
      }
      setIsRunning(!isRunning);
    } catch (error) {
      console.error("Notification Error:", error);
    }
  };

  const handleStop = async () => {
    resetTimer();
    if (notificationId) {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
      setNotificationId(null);
    }
    // Safety clear all
    await Notifications.cancelAllScheduledNotificationsAsync();
  };

  const formatNumber = (num: number) => num.toString().padStart(2, "0");

  const isAtStart = !isRunning && minutes === 25 && seconds === 0;

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      {/* Screen Always On Toggle */}
      <TouchableOpacity
        style={styles.keepAwakeBtn}
        onPress={() => setIsKeepAwake(!isKeepAwake)}
      >
        <Text
          style={[
            styles.keepAwakeText,
            {
              color: isKeepAwake
                ? theme.colors.primary
                : theme.colors.text.secondary,
            },
          ]}
        >
          {isKeepAwake ? "☀️ Screen Always On" : "🌙 Screen Normal"}
        </Text>
      </TouchableOpacity>

      <View style={styles.timerContainer}>
        <Text style={[styles.timerText, { color: theme.colors.text.primary }]}>
          {formatNumber(minutes)}:{formatNumber(seconds)}
        </Text>

        {/* Conditional Status Text */}
        <View style={{ height: 30 }}>
          {!isRunning && !isAtStart ? (
            <Text style={[styles.statusLabel, { color: theme.colors.warning }]}>
              Paused
            </Text>
          ) : isAtStart ? (
            <Text
              style={[
                styles.statusLabel,
                { color: theme.colors.text.secondary },
              ]}
            >
              Deep Work Session
            </Text>
          ) : null}
        </View>
      </View>

      {/* Controls */}
      <View style={styles.controlsRow}>
        <TouchableOpacity style={styles.secondaryBtn} onPress={handleStop}>
          <Text style={{ color: theme.colors.text.secondary, fontSize: 18 }}>
            Stop
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.mainBtn, { backgroundColor: theme.colors.primary }]}
          onPress={toggleTimer}
        >
          <Text style={styles.mainBtnText}>
            {isRunning ? "Pause" : "Start"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => {
            /* Add skip logic */
          }}
        >
          <Text style={{ color: theme.colors.text.secondary, fontSize: 18 }}>
            Skip
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center" },
  keepAwakeBtn: {
    position: "absolute",
    top: 60,
    padding: 10,
    borderRadius: 20,
  },
  keepAwakeText: { fontSize: 14, fontWeight: "600" },
  timerContainer: { alignItems: "center", marginBottom: 60 },
  timerText: { fontSize: 90, fontWeight: "200", letterSpacing: -2 },
  statusLabel: {
    fontSize: 20,
    marginTop: 10,
    fontWeight: "400",
    textAlign: "center",
  },
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "80%",
    justifyContent: "space-around",
  },
  mainBtn: {
    paddingHorizontal: 40,
    paddingVertical: 15,
    borderRadius: 30,
    elevation: 2,
  },
  mainBtnText: { color: "white", fontSize: 20, fontWeight: "600" },
  secondaryBtn: { padding: 10 },
});
