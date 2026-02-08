import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { useAlert } from "../contexts/AlertContext";
import { KeyIcon, ShieldIcon, ChevronRightIcon } from "@/components/Icons"

export default function ProfileScreen() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const { showAlert } = useAlert();
  const router = useRouter();

  // In a real app, this would come from your user object/Firestore
  const is2faEnabled = false;

  const handleChangePassword = () => {
    showAlert({
      title: "Reset Password!",
      message: " A password reset link has been sent to your email",
      confirmText: "Ok"
    })
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
            <KeyIcon color={theme.colors.text.secondary} size={24} />
            <Text
              style={[styles.rowText, { color: theme.colors.text.primary }]}
            >
              Change Password
            </Text>
          </View>
          <ChevronRightIcon color={theme.colors.text.secondary} size={28} />
        </TouchableOpacity>

        {/* 2FA Menu Item (No Toggle) */}
        <TouchableOpacity
          style={styles.row}
          onPress={() => router.push("/mfa-setup")}
        >
          <View style={styles.rowLeft}>
            <ShieldIcon color={theme.colors.text.secondary} size={24} />
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
            <ChevronRightIcon color={theme.colors.text.secondary} size={28} />
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
  rowLeft: { flexDirection: "row", alignItems: "center"},
  rowRight: { flexDirection: "row", alignItems: "center" },
  rowText: { fontSize: 16, marginLeft: 12, fontWeight: "500" },
  statusLabel: { fontSize: 14, marginRight: 8, fontWeight: "600" },
});
