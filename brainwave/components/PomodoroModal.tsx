import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../app/contexts/ThemeContext";
import { useTimer } from "../app/contexts/TimerContext";
import { useAlert } from "../app/contexts/AlertContext";

const { width } = Dimensions.get("window");

export const PomodoroModal = () => {
  const { theme } = useTheme();
  const { showAlert } = useAlert();
  const {
    minutes,
    seconds,
    isRunning,
    toggleTimer,
    resetTimer,
    isModalVisible,
    setIsModalVisible,
  } = useTimer();

  if (!isModalVisible) return null;

  const handleDismiss = () => {
    if (isRunning) {
      showAlert({
        title: "Abandon Session?",
        message:
          "If you quit now, this session won't count toward your goals. Stay strong!",
        showCancel: true,
        confirmText: "Give Up",
        cancelText: "Keep Going",
        onConfirm: () => {
          resetTimer();
          setIsModalVisible(false);
        },
      });
    } else {
      setIsModalVisible(false);
    }
  };

  return (
    <Modal
      transparent

      visible={isModalVisible}
      onRequestClose={handleDismiss}
    >
      <View style={styles.overlay}>
        <View style={[styles.modal, { backgroundColor: theme.colors.surface }]}>
          <TouchableOpacity style={styles.close} onPress={handleDismiss}>
            <Ionicons
              name="close"
              size={28}
              color={theme.colors.text.secondary}
            />
          </TouchableOpacity>

          <Text style={[styles.title, { color: theme.colors.text.primary }]}>
            Focus Mode
          </Text>

          <Text style={[styles.timer, { color: theme.colors.primary }]}>
            {String(minutes).padStart(2, "0")}:
            {String(seconds).padStart(2, "0")}
          </Text>

          <View style={styles.buttonBar}>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: theme.colors.primary }]}
              onPress={toggleTimer}
            >
              <Text style={styles.buttonText}>
                {isRunning ? "Pause" : "Start Focus"}
              </Text>
            </TouchableOpacity>

            {!isRunning && (minutes < 25 || seconds > 0) && (
              <TouchableOpacity style={styles.resetButton} onPress={resetTimer}>
                <Text style={{ color: theme.colors.text.secondary }}>
                  Reset
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "center",
    alignItems: "center",
  },
  modal: {
    width: width - 40,
    padding: 32,
    borderRadius: 32,
    alignItems: "center",
    elevation: 10,
  },
  close: { position: "absolute", top: 20, right: 20 },
  title: { fontSize: 20, fontWeight: "bold", letterSpacing: 1 },
  timer: {
    fontSize: 80,
    fontWeight: "bold",
    marginVertical: 30,
    fontVariant: ["tabular-nums"],
  },
  buttonBar: { width: "100%", alignItems: "center", gap: 15 },
  button: {
    width: "100%",
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: "center",
  },
  buttonText: { color: "white", fontWeight: "bold", fontSize: 18 },
  resetButton: { marginTop: 10 },
});
