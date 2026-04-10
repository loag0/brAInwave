import { useEffect, useRef } from "react";
import { View, ActivityIndicator, StyleSheet, Text } from "react-native";
import { useTheme } from "../contexts/ThemeContext";
import { useAuth } from "../contexts/AuthContext";
import { useRouter } from "expo-router";

export default function GoogleOAuthRedirect() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const hasRedirected = useRef(false);

  // Navigates as soon as Firebase confirms the user
  useEffect(() => {
    if (!user || hasRedirected.current) return;
    hasRedirected.current = true;
    router.replace(user.hasFinishedSetup ? "/(tabs)" : "/(onboarding)");
  }, [user, router]);

  // Fallback: if Firebase hasn't responded after 15s, go to login
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!hasRedirected.current) {
        hasRedirected.current = true;
        router.replace("/(auth)/login");
      }
    }, 15000);
    return () => clearTimeout(timer);
  }, [router]);

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
