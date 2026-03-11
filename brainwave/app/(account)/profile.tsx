import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { useAlert } from "../contexts/AlertContext";
import {
  KeyIcon,
  ShieldIcon,
  ChevronRightIcon,
  ICONS,
} from "@/components/Icons";
import { LocalDB } from "../database/localDb";

export default function ProfileScreen() {
  const { user, getAuth, deleteAccount } = useAuth();
  const { theme } = useTheme();
  const { showAlert } = useAlert();
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  const is2faEnabled = false;

  const handleChangePassword = () => {
    showAlert({
      title: "Reset Password!",
      message: "A password reset link has been sent to your email",
      confirmText: "Ok",
    });
  };

  const handleDeleteAccount = () => {
    showAlert({
      title: "Delete Account?",
      message:
        "This action cannot be undone. All your data will be permanently deleted.",
      confirmText: "Delete",
      showCancel: true,
      cancelText: "Cancel",
      iconPath: ICONS.ERROR,
      iconColor: theme.colors.error,
      onConfirm: async () => {
        setIsDeleting(true);
        try {
          const auth = getAuth();
          const currentUser = auth.currentUser;

          if (currentUser) {
            if (user?.id) {
              LocalDB.clearUser(user.id);
            }
            await deleteAccount();
          }

          router.replace("/login");
        } catch (error) {
          console.error("Delete failed:", error);
          setIsDeleting(false);
          showAlert({
            title: "Error",
            message:
              "You may need to log in again before deleting your account.",
            confirmText: "OK",
          });
        }
      },
    });
  };

  if (isDeleting) {
    return (
      <View
        style={[styles.centered, { backgroundColor: theme.colors.background }]}
      >
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text
          style={[styles.deletingText, { color: theme.colors.text.secondary }]}
        >
          Deleting your account...
        </Text>
      </View>
    );
  }

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

      {/* Danger Zone */}
      <View style={styles.dangerSection}>
        <Text style={[styles.sectionTitle, { color: "#ff3b30" }]}>
          DANGER ZONE
        </Text>

        <TouchableOpacity
          style={[styles.deleteButton, { borderColor: "#ff3b30" }]}
          onPress={handleDeleteAccount}
        >
          <Text style={styles.deleteText}>Delete Account</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },

  deletingText: {
    fontSize: 16,
    fontWeight: "500",
  },

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

  dangerSection: {
    marginTop: 60,
    paddingHorizontal: 20,
  },

  deleteButton: {
    borderWidth: 1.5,
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: "center",
  },

  deleteText: {
    color: "#ff3b30",
    fontSize: 16,
    fontWeight: "600",
  },
});
