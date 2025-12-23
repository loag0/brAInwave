//import { useEffect } from "react";
import { View, ActivityIndicator, StyleSheet, Text } from "react-native";
//import { useAuth } from "../contexts/AuthContexts"; // Corrected path
import { useTheme } from "../contexts/ThemeContexts";

export default function GoogleOAuthRedirect() {
  const { theme } = useTheme();

  // We don't actually need to call router.replace here because
  // the RootLayout NavigationHandler is watching segments[0] === "oauth2redirect"
  // and it will auto-redirect based on the user object.

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <ActivityIndicator size="large" color={theme.colors.primary} />
      <Text style={[styles.text, { color: theme.colors.text.primary }]}>
        Completing sign in...
      </Text>
      <Text style={[styles.subtext, { color: theme.colors.text.secondary }]}>
        Syncing with your profile
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center" },
  text: { marginTop: 16, fontSize: 18, fontWeight: "600" },
  subtext: { marginTop: 8, fontSize: 14 },
});
