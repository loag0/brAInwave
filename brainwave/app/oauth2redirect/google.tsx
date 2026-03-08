import { useEffect, useRef } from "react";
import { View, ActivityIndicator, StyleSheet, Text } from "react-native";
import { useTheme } from "../contexts/ThemeContext";
import { useAuth } from "../contexts/AuthContext";
import { useRouter } from "expo-router";

export default function GoogleOAuthRedirect() {
  const { theme } = useTheme();
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const hasRedirected = useRef(false);

  useEffect(() => {
    if (isLoading) return;
    if(hasRedirected.current) return; // Prevent multiple redirects

    hasRedirected.current = true;

    if (user) {
        // If user exists, redirect to the main app
        if(!user.hasFinishedSetup){
          router.replace("/(onboarding)");
        } else{
          router.replace("/(tabs)");
        }
      } else{
        // If no user, redirect to login
        router.replace("/(auth)/login");
      }
  }, [user, isLoading, router]);

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
