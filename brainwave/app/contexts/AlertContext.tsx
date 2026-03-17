import React, { createContext, useContext, useState } from "react";
import { Modal, View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useTheme } from "./ThemeContext";
import Svg, { Path } from "react-native-svg";

interface AlertOptions {
  title: string;
  message: string;
  iconPath?: string;
  iconColor?: string;
  onConfirm?: () => void | Promise<void>;
  onCancel?: () => void | Promise<void>;
  confirmText?: string;
  cancelText?: string;
  showCancel?: boolean;
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

  const accentColor = config.iconColor || theme.colors.primary;
  // Soft tinted pill bg for the icon — works in both light and dark
  const iconBgColor = accentColor + "20";

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
            {/* Accent bar at the top */}
            <View
              style={[styles.accentBar, { backgroundColor: accentColor }]}
            />

            <View style={styles.body}>
              {/* Icon + Title */}
              <View style={styles.headerRow}>
                {config.iconPath && (
                  <View
                    style={[
                      styles.iconCircle,
                      { backgroundColor: iconBgColor },
                    ]}
                  >
                    <Svg width="20" height="20" viewBox="0 0 24 24">
                      <Path d={config.iconPath} fill={accentColor} />
                    </Svg>
                  </View>
                )}
                <Text
                  style={[
                    styles.title,
                    { color: theme.colors.text.primary },
                    !config.iconPath && { paddingLeft: 0 },
                  ]}
                  numberOfLines={2}
                >
                  {config.title}
                </Text>
              </View>

              {/* Message — indented to align under title when icon present */}
              <Text
                style={[
                  styles.message,
                  { color: theme.colors.text.secondary },
                  config.iconPath && styles.messageIndented,
                ]}
              >
                {config.message}
              </Text>

              {/* Pill buttons */}
              <View style={styles.buttonRow}>
                {config.showCancel && (
                  <TouchableOpacity
                    style={[
                      styles.cancelButton,
                      { borderColor: theme.colors.border },
                    ]}
                    onPress={async () => {
                      const callback = config.onCancel;
                      hideAlert();
                      await callback?.();
                    }}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.cancelLabel,
                        { color: theme.colors.text.secondary },
                      ]}
                    >
                      {config.cancelText || "Cancel"}
                    </Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[
                    styles.confirmButton,
                    { backgroundColor: accentColor },
                    !config.showCancel && styles.confirmButtonFull,
                  ]}
                  onPress={async () => {
                    const callback = config.onConfirm;
                    hideAlert();
                    await callback?.();
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.confirmLabel}>
                    {config.confirmText || "OK"}
                  </Text>
                </TouchableOpacity>
              </View>
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
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },

  alertBox: {
    width: "90%",
    maxWidth: 400,
    borderRadius: 20,
    overflow: "hidden",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
  },

  accentBar: {
    height: 4,
    width: "100%",
  },

  body: {
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 18,
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 10,
  },

  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },

  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: -0.2,
  },

  message: {
    fontSize: 13.5,
    lineHeight: 20,
    marginBottom: 18,
  },

  messageIndented: {
    paddingLeft: 54,
  },

  buttonRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },

  cancelButton: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 50,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: "center",
    alignItems: "center",
  },

  cancelLabel: {
    fontSize: 13,
    fontWeight: "500",
    letterSpacing: 0.1,
  },

  confirmButton: {
    paddingHorizontal: 22,
    paddingVertical: 9,
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
  },

  confirmButtonFull: {
    flex: 1,
  },

  confirmLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#ffffff",
    letterSpacing: 0.2,
  },
});
