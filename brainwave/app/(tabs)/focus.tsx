import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Animated } from "react-native";
import { useTimer } from "../contexts/TimerContext";
import { useTheme } from "../contexts/ThemeContext"; // Assuming you have this
import { useKeepAwake } from "expo-keep-awake";

export default function FocusScreen() {
  const { theme } = useTheme();
  const {
    minutes,
    seconds,
    isRunning,
    toggleTimer,
    resetTimer,
    isKeepAwake,
    setIsKeepAwake,
  } = useTimer();

  useKeepAwake();

  const formatNumber = (num: number) => num.toString().padStart(2, "0");

  //check if timer is at the starting point
  const isAtStart = !isRunning && minutes === 25 && seconds === 0;
  const showLabel = !isRunning; // Only shows text when the timer isnt running
  const labelText = !isAtStart ? "Deep Work Session" : "Paused";

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
          <Text style={[styles.statusLabel, { color: theme.colors.text.secondary }]}>
            Deep Work Session
          </Text>
        ) : null }
      </View>
      </View>

      {/* Controls */}
      <View style={styles.controlsRow}>
        <TouchableOpacity style={styles.secondaryBtn} onPress={resetTimer}>
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
  timerText: { fontSize: 90, fontWeight: "200", letterSpacing: -2 }, // Thin weight like TickTick
  statusLabel: { fontSize: 20, marginTop: 10, fontWeight: '400', textAlign: 'center' },
  taskLabel: { fontSize: 18, marginTop: 10, fontWeight: "400" },
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
