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
import Toast from "react-native-toast-message";

export default function ProfileScreen() {
  const { user, getAuth, deleteAccount } = useAuth();
  const { theme, isDark } = useTheme();
  const { showAlert } = useAlert();
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  const is2faEnabled = false;

  const styles = createStyles(theme, isDark);

  const handleChangePassword = () => {
    Toast.show({
      type: "info",
      text1: "Password Reset",
      text2: "A password reset link has been sent to your email",
      position: "bottom",
      visibilityTime: 6000,
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
            message: "You may need to log in again before deleting your account.",
            confirmText: "OK",
            iconColor: theme.colors.error,
            iconPath: ICONS.ERROR
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
        <Text style={styles.dangerTitle}>DANGER ZONE</Text>

        <View
          style={[styles.dangerCard, { backgroundColor: theme.colors.surface }]}
        >
          {/* Warning header strip */}
          <View
            style={[
              styles.dangerHeader,
              { backgroundColor: isDark ? "#2a1515" : "#FCEBEB" },
            ]}
          >
            <View style={styles.dangerPulse} />
            <Text style={styles.dangerHeaderText}>
              Irreversible actions ahead
            </Text>
          </View>

          {/* Delete row */}
          <View style={styles.dangerRow}>
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.dangerRowTitle,
                  { color: theme.colors.text.primary },
                ]}
              >
                Delete account
              </Text>
              <Text
                style={[
                  styles.dangerRowSub,
                  { color: theme.colors.text.secondary },
                ]}
              >
                Permanently removes all your data
              </Text>
            </View>
            <TouchableOpacity
              style={[
                styles.deleteButton,
                { backgroundColor: isDark ? "#2a1515" : "#FCEBEB" },
              ]}
              onPress={handleDeleteAccount}
              activeOpacity={0.75}
            >
              <Text style={styles.deleteText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

const createStyles = (theme: any, isDark: boolean) =>
  StyleSheet.create({
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
      marginTop: 48,
      paddingHorizontal: 20,
      marginBottom: 40,
    },

    dangerTitle: {
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 1.5,
      color: "#E24B4A",
      marginBottom: 12,
      textTransform: "uppercase",
    },

    dangerCard: {
      borderRadius: 14,
      borderWidth: 0.5,
      borderColor: "rgba(226,75,74,0.25)",
      overflow: "hidden",
    },

    dangerHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 18,
      paddingVertical: 12,
      borderBottomWidth: 0.5,
      borderBottomColor: "rgba(226,75,74,0.2)",
    },

    dangerPulse: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: "#E24B4A",
    },

    dangerHeaderText: {
      fontSize: 13,
      fontWeight: "500",
      color: isDark ? "#E24B4A" : "#791F1F",
    },

    dangerRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 18,
      paddingVertical: 16,
      gap: 12,
    },

    dangerRowTitle: {
      fontSize: 14,
      fontWeight: "600",
      marginBottom: 2,
    },

    dangerRowSub: {
      fontSize: 12,
    },

    deleteButton: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 0.5,
      borderColor: isDark ? "#791F1F" : "#E24B4A",
    },

    deleteText: {
      color: isDark ? "#E24B4A" : "#791F1F",
      fontSize: 13,
      fontWeight: "500",
    },
  });
