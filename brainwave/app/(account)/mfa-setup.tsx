import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { useTheme } from "../contexts/ThemeContext";
import { useAlert } from "../contexts/AlertContext";
import Svg, { Path } from "react-native-svg";

export default function MFASetup() {
  const { theme } = useTheme();
  const [code, setCode] = useState("");
  const { showAlert } = useAlert();

  interface IconProps {
    size: number;
    color: string;
  }
  const ShieldIcon:React.FC<IconProps> = ({ size, color }) => (
    <Svg width={size} height={size} viewBox="0 -960 960 960" fill="none">
      <Path
        d="M480-80q-139-35-229.5-159.5T160-516v-244l320-120 320 120v244q0 152-90.5 276.5T480-80Zm0-84q104-33 172-132t68-220v-189l-240-90-240 90v189q0 121 68 220t172 132Zm0-316Zm-80 160h160q17 0 28.5-11.5T600-360v-120q0-17-11.5-28.5T560-520v-40q0-33-23.5-56.5T480-640q-33 0-56.5 23.5T400-560v40q-17 0-28.5 11.5T360-480v120q0 17 11.5 28.5T400-320Zm40-200v-40q0-17 11.5-28.5T480-600q17 0 28.5 11.5T520-560v40h-80Z"
        fill={color} />
    </Svg>
  );

  const CopyIcon:React.FC<IconProps> = ({ size, color }) => (
    <Svg width={size} height={size} viewBox="0 -960 960 960" fill="none">
      <Path
        d="M360-240q-33 0-56.5-23.5T280-320v-480q0-33 23.5-56.5T360-880h360q33 0 56.5 23.5T800-800v480q0 33-23.5 56.5T720-240H360Zm0-80h360v-480H360v480ZM200-80q-33 0-56.5-23.5T120-160v-560h80v560h440v80H200Zm160-240v-480 480Z"
        fill={color} />
    </Svg>
  );

  // Fake secret key for demonstration purposes
  const secretKey = "JBSW Y3DP EHPK 3PXP";

  const copyToClipboard = async () => {
    // Heavy impact for the "Copy" action
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    await Clipboard.setStringAsync(secretKey);
  };

  const handleVerify = () => {
    if (code.length !== 6) {
      // Error haptic
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showAlert({
        title: "Invalid code",
        message: "Please enter a valid 6-digit code.",
      });
      return;
    }

    // Success haptic
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("Success", "2FA is now active on your account.");
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <View
            style={[
              styles.iconCircle,
              { backgroundColor: theme.colors.primary + "15" },
            ]}
          >
            <ShieldIcon size={50} color={theme.colors.primary} />
          </View>

          <Text style={[styles.title, { color: theme.colors.text.primary }]}>
            Protect Your Account
          </Text>
          <Text
            style={[styles.description, { color: theme.colors.text.secondary }]}
          >
            Authenticator apps generate secure codes that change every 30
            seconds.
          </Text>

          {/* Instructions */}
          <View style={styles.instructionRow}>
            <View
              style={[
                styles.stepNumber,
                { backgroundColor: theme.colors.primary },
              ]}
            >
              <Text style={styles.stepText}>1</Text>
            </View>
            <Text
              style={[styles.stepLabel, { color: theme.colors.text.primary }]}
            >
              Copy the secret key below
            </Text>
          </View>

          {/* Secret Key Box */}
          <TouchableOpacity
            style={[styles.secretBox, { borderColor: theme.colors.border }]}
            onPress={copyToClipboard}
            activeOpacity={0.8}
          >
            <View style={styles.secretRow}>
              <Text
                style={[
                  styles.secretValue,
                  { color: theme.colors.text.primary },
                ]}
              >
                {secretKey}
              </Text>
              <CopyIcon size={20} color={theme.colors.primary} />
            </View>
            <Text style={[styles.tapToCopy, { color: theme.colors.primary }]}>
              TAP TO COPY
            </Text>
          </TouchableOpacity>

          <View style={styles.instructionRow}>
            <View
              style={[
                styles.stepNumber,
                { backgroundColor: theme.colors.primary },
              ]}
            >
              <Text style={styles.stepText}>2</Text>
            </View>
            <Text
              style={[styles.stepLabel, { color: theme.colors.text.primary }]}
            >
              Paste it into Google Authenticator
            </Text>
          </View>

          <View style={styles.divider} />

          {/* Input Section */}
          <Text
            style={[styles.inputLabel, { color: theme.colors.text.secondary }]}
          >
            ENTER 6-DIGIT VERIFICATION CODE
          </Text>

          <TextInput
            style={[
              styles.input,
              {
                borderColor: theme.colors.border,
                color: theme.colors.text.primary,
                backgroundColor: theme.colors.border + "10",
              },
            ]}
            value={code}
            onChangeText={(text) => {
              setCode(text);
              if (text.length === 6) Haptics.selectionAsync();
            }}
            placeholder="000 000"
            placeholderTextColor={theme.colors.text.secondary}
            keyboardType="number-pad"
            maxLength={6}
          />

          <TouchableOpacity
            style={[styles.button, { backgroundColor: theme.colors.primary }]}
            onPress={handleVerify}
          >
            <Text style={styles.buttonText}>Enable 2FA</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  content: { alignItems: "center", padding: 24 },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    marginBottom: 10,
    textAlign: "center",
  },
  description: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 30,
    paddingHorizontal: 10,
  },
  instructionRow: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    marginBottom: 15,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  stepText: { color: "#fff", fontSize: 12, fontWeight: "bold" },
  stepLabel: { fontSize: 16, fontWeight: "600" },
  secretBox: {
    width: "100%",
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderRadius: 16,
    padding: 20,
    marginBottom: 25,
    alignItems: "center",
  },
  secretRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  secretValue: { fontSize: 20, fontWeight: "bold", letterSpacing: 1 },
  tapToCopy: {
    fontSize: 11,
    fontWeight: "800",
    marginTop: 10,
    letterSpacing: 1,
  },
  divider: {
    width: "100%",
    height: 1,
    backgroundColor: "#eee",
    marginVertical: 25,
    marginTop: 5,
  },
  inputLabel: {
    alignSelf: "center",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 15,
    letterSpacing: 1,
  },
  input: {
    width: "100%",
    borderWidth: 1,
    borderRadius: 16,
    padding: 18,
    fontSize: 28,
    textAlign: "center",
    fontWeight: "bold",
    marginBottom: 25,
  },
  button: {
    width: "100%",
    padding: 20,
    borderRadius: 16,
    alignItems: "center",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  buttonText: { color: "#fff", fontWeight: "bold", fontSize: 18 },
});
