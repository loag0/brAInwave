import React, { createContext, useContext, useState, useCallback } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTheme } from "./ThemeContext";
import BrainwaveLoader from "@/components/BrainwaveLoader";

interface UploadOverlayContextType {
  showUploadOverlay: (message?: string) => void;
  hideUploadOverlay: () => void;
  isUploadOverlayVisible: boolean;
}

const UploadOverlayContext = createContext<UploadOverlayContextType>({
  showUploadOverlay: () => {},
  hideUploadOverlay: () => {},
  isUploadOverlayVisible: false,
});

export const UploadOverlayProvider = ({ children }: { children: React.ReactNode }) => {
  const { theme } = useTheme();
  const [message, setMessage] = useState<string | null>(null);

  const showUploadOverlay = useCallback((msg = "Uploading...") => {
    setMessage(msg);
  }, []);

  const hideUploadOverlay = useCallback(() => {
    setMessage(null);
  }, []);

  return (
    <UploadOverlayContext.Provider
      value={{ showUploadOverlay, hideUploadOverlay, isUploadOverlayVisible: message !== null }}
    >
      {children}
      {message !== null && (
        <View style={styles.overlay}>
          <BrainwaveLoader theme={theme} />
          <Text style={styles.text}>{message}</Text>
        </View>
      )}
    </UploadOverlayContext.Provider>
  );
};

export const useUploadOverlay = () => useContext(UploadOverlayContext);

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
    elevation: 9999,
  },
  text: {
    color: "#fff",
    marginTop: 16,
    fontWeight: "600",
    fontSize: 15,
  },
});
