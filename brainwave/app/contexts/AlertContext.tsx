import React, { createContext, useContext, useState } from "react";
import { Modal, View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useTheme } from "./ThemeContext";

interface AlertOptions {
  title: string;
  message: string;
  onConfirm?: () => void;
  onCancel?: () => void; // Added cancel
  confirmText?: string;
  cancelText?: string; // Added cancel text
  showCancel?: boolean; // Toggle for single vs double button
}

const AlertContext = createContext<any>(null);

export const AlertProvider = ({ children }: { children: React.ReactNode }) => {
  const { theme } = useTheme();
  const [visible, setVisible] = useState(false);
  const [config, setConfig] = useState<AlertOptions>({
    title: "",
    message: "",
  });

  const showAlert = (options: AlertOptions) => {
    setConfig(options);
    setVisible(true);
  };

  const hideAlert = () => setVisible(false);

  return (
    <AlertContext.Provider value={{ showAlert }}>
      {children}
      <Modal
        transparent
        visible={visible}
        animationType="fade"
        onRequestClose={hideAlert}
      >
        <View style={styles.overlay}>
          <View
            style={[styles.alertBox, { backgroundColor: theme.colors.surface }]}
          >
            <Text style={[styles.title, { color: theme.colors.text.primary }]}>
              {config.title}
            </Text>
            <Text
              style={[styles.message, { color: theme.colors.text.secondary }]}
            >
              {config.message}
            </Text>

            {/* Buttons Container now INSIDE alertBox */}
            <View
              style={[
                styles.buttonContainer,
                { flexDirection: config.showCancel ? "row" : "column" },
              ]}
            >
              {config.showCancel && (
                <TouchableOpacity
                  style={[
                    styles.button,
                    styles.cancelButton,
                    {
                      borderColor: theme.colors.border,
                      marginRight: 10,
                      flex: 1,
                    },
                  ]}
                  onPress={() => {
                    if (config.onCancel) config.onCancel();
                    hideAlert();
                  }}
                >
                  <Text
                    style={[
                      styles.buttonText,
                      { color: theme.colors.text.secondary },
                    ]}
                  >
                    {config.cancelText || "Cancel"}
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[
                  styles.button,
                  {
                    backgroundColor: theme.colors.primary,
                    flex: config.showCancel ? 1 : 0,
                  },
                ]}
                onPress={() => {
                  if (config.onConfirm) config.onConfirm();
                  hideAlert();
                }}
              >
                <Text style={styles.buttonText}>
                  {config.confirmText || "OK"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </AlertContext.Provider>
  );
};

export const useAlert = () => useContext(AlertContext);

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  alertBox: {
    width: "85%",
    padding: 24,
    borderRadius: 20,
    alignItems: "center",
    elevation: 10,
  },
  title: { fontSize: 22, fontWeight: "bold", marginBottom: 12 },
  message: {
    textAlign: "center",
    fontSize: 16,
    marginBottom: 24,
    lineHeight: 22,
  },
  buttonContainer: {
    width: "100%",
    justifyContent: "space-between",
  },
  button: {
    width: "100%",
    padding: 15,
    borderRadius: 12,
    alignItems: "center",
  },
  cancelButton: {
    borderWidth: 1,
    backgroundColor: "transparent",
  },
  buttonText: { color: "white", fontWeight: "bold", fontSize: 16 },
});
