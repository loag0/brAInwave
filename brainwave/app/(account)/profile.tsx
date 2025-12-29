import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";

export default function ProfileScreen() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const router = useRouter();

  // In a real app, this would come from your user object/Firestore
  const is2faEnabled = false;

  const handleChangePassword = () => {
    Alert.alert(
      "Reset Password",
      "A password reset link has been sent to your email."
    );
  };

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <View style={styles.header}>
        <View
          style={[styles.avatar, { backgroundColor: theme.colors.primary }]}
        >
          <Text style={styles.avatarText}>
            {user?.name?.charAt(0).toUpperCase() || "A"}
          </Text>
        </View>
        <Text style={[styles.email, { color: theme.colors.text.secondary }]}>
          {user?.email || "user@example.com"}
        </Text>
      </View>

      <View style={styles.section}>
        <Text
          style={[styles.sectionTitle, { color: theme.colors.text.secondary }]}
        >
          SECURITY
        </Text>

        {/* Change Password */}
        <TouchableOpacity
          style={[
            styles.row,
            { borderBottomColor: theme.colors.border, borderBottomWidth: 1 },
          ]}
          onPress={handleChangePassword}
        >
          <View style={styles.rowLeft}>
            <Ionicons
              name="key-outline"
              size={22}
              color={theme.colors.text.primary}
            />
            <Text
              style={[styles.rowText, { color: theme.colors.text.primary }]}
            >
              Change Password
            </Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={20}
            color={theme.colors.text.secondary}
          />
        </TouchableOpacity>

        {/* 2FA Menu Item (No Toggle) */}
        <TouchableOpacity
          style={styles.row}
          onPress={() => router.push("/mfa-setup")}
        >
          <View style={styles.rowLeft}>
            <Ionicons
              name="shield-checkmark-outline"
              size={22}
              color={theme.colors.text.primary}
            />
            <Text
              style={[styles.rowText, { color: theme.colors.text.primary }]}
            >
              Two-Factor Authentication
            </Text>
          </View>
          <View style={styles.rowRight}>
            <Text
              style={[
                styles.statusLabel,
                {
                  color: is2faEnabled ? "#4CAF50" : theme.colors.text.secondary,
                },
              ]}
            >
              {is2faEnabled ? "Enabled" : "Off"}
            </Text>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={theme.colors.text.secondary}
            />
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { alignItems: "center", paddingVertical: 40 },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  avatarText: { color: "#fff", fontSize: 40, fontWeight: "bold" },
  email: { fontSize: 16, fontWeight: "500" },
  section: { marginTop: 20, paddingHorizontal: 20 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 8,
    marginLeft: 4,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 18,
    paddingHorizontal: 4,
  },
  rowLeft: { flexDirection: "row", alignItems: "center" },
  rowRight: { flexDirection: "row", alignItems: "center" },
  rowText: { fontSize: 16, marginLeft: 12, fontWeight: "500" },
  statusLabel: { fontSize: 14, marginRight: 8, fontWeight: "600" },
});
