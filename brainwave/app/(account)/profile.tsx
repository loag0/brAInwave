import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import Svg, { Path } from "react-native-svg";

export default function ProfileScreen() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const router = useRouter();

  // In a real app, this would come from your user object/Firestore
  const is2faEnabled = false;

  interface IconProps {
    color: string;
    size: number;
  }

  const KeyIcon: React.FC<IconProps> = ({ color, size }) => (
    <Svg width={size} height={size} viewBox="0 -960 960 960" fill="none">
      <Path
        d="M280-400q-33 0-56.5-23.5T200-480q0-33 23.5-56.5T280-560q33 0 56.5 23.5T360-480q0 33-23.5 56.5T280-400Zm0 160q-100 0-170-70T40-480q0-100 70-170t170-70q67 0 121.5 33t86.5 87h352l120 120-180 180-80-60-80 60-85-60h-47q-32 54-86.5 87T280-240Zm0-80q56 0 98.5-34t56.5-86h125l58 41 82-61 71 55 75-75-40-40H435q-14-52-56.5-86T280-640q-66 0-113 47t-47 113q0 66 47 113t113 47Z"
        fill={color} />
    </Svg>
  );

  const ShieldIcon: React.FC<IconProps> = ({ color, size }) => (
    <Svg width={size} height={size} viewBox="0 -960 960 960" fill="none">
      <Path
        d="M480-80q-139-35-229.5-159.5T160-516v-244l320-120 320 120v244q0 152-90.5 276.5T480-80Zm0-84q104-33 172-132t68-220v-189l-240-90-240 90v189q0 121 68 220t172 132Zm0-316Zm-80 160h160q17 0 28.5-11.5T600-360v-120q0-17-11.5-28.5T560-520v-40q0-33-23.5-56.5T480-640q-33 0-56.5 23.5T400-560v40q-17 0-28.5 11.5T360-480v120q0 17 11.5 28.5T400-320Zm40-200v-40q0-17 11.5-28.5T480-600q17 0 28.5 11.5T520-560v40h-80Z"
        fill={color} />
    </Svg>
  );  

  const ChevronRight: React.FC<IconProps> = ({ color, size }) => (
    <Svg width={size} height={size} viewBox="0 -960 960 960" fill="none">
      <Path
        d="M504-480 320-664l56-56 240 240-240 240-56-56 184-184Z" fill={color}
      />
    </Svg>
  );

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
            <KeyIcon color={theme.colors.text.secondary} size={24} />
            <Text
              style={[styles.rowText, { color: theme.colors.text.primary }]}
            >
              Change Password
            </Text>
          </View>
          <ChevronRight color={theme.colors.text.secondary} size={28} />
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
            <ChevronRight color={theme.colors.text.secondary} size={28} />
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
