import React, { createContext, useContext, useState } from "react";
import { Modal, View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useTheme } from "./ThemeContext";
import Svg, { Path } from "react-native-svg"

interface AlertOptions {
  title: string;
  message: string;
  iconPath?: string,
  iconColor?: string,
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
            {/* Render Icon if path exists */}
            {config.iconPath && (
              <View style={styles.iconContainer}>
                <Svg width="32" height="32" viewBox="0 0 24 24">
                  <Path
                    d={config.iconPath}
                    fill={config.iconColor || theme.colors.primary}
                  />
                </Svg>
              </View>
            )}

            <Text
              style={[
                styles.title,
                {
                  color: theme.colors.text.primary,
                  textAlign: config.iconPath ? "center" : "left", // Center if there's an icon
                },
              ]}
            >
              {config.title}
            </Text>

            <Text
              style={[
                styles.message,
                {
                  color: theme.colors.text.secondary,
                  textAlign: config.iconPath ? "center" : "left",
                },
              ]}
            >
              {config.message}
            </Text>

            <View style={styles.buttonContainer}>
              {config.showCancel && (
                <TouchableOpacity
                  style={styles.textButton}
                  onPress={() => {
                    config.onCancel?.();
                    hideAlert();
                  }}
                >
                  <Text
                    style={[
                      styles.buttonLabel,
                      { color: theme.colors.primary },
                    ]}
                  >
                    {config.cancelText || "Cancel"}
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.textButton}
                onPress={() => {
                  config.onConfirm?.();
                  hideAlert();
                }}
              >
                <Text
                  style={[
                    styles.buttonLabel,
                    { color: theme.colors.primary, fontWeight: "700" },
                  ]}
                >
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
    backgroundColor: "rgba(0,0,0,0.5)", // Slightly lighter overlay is more modern
    justifyContent: "center",
    alignItems: "center",
  },
  alertBox: {
    width: "80%", // Material standard
    padding: 24,
    borderRadius: 28, // Material 3 uses larger border radii
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
  },
  iconContainer: { marginBottom: 16, alignItems: "center" },
  title: {
    fontSize: 24, // M3 Headline Small
    fontWeight: "400",
    marginBottom: 16,
    textAlign: "left", // Left align for Material
  },
  message: {
    fontSize: 14, // M3 Body Medium
    marginBottom: 24,
    lineHeight: 20,
    textAlign: "left",
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "flex-end", // Standard Material button placement
    width: "100%",
  },
  textButton: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginLeft: 8,
  },
  buttonLabel: {
    fontSize: 14,
    textTransform: "uppercase", // Optional: classic material look
    letterSpacing: 0.5,
  },
});
