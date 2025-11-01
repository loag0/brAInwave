import React from "react";
import { View, TouchableOpacity, StyleSheet, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../app/contexts/AuthContexts";
import { useTheme } from "../app/contexts/ThemeContexts";
import AppText from "./AppText";

export default function AuthScreen() {
  const { login } = useAuth();
  const { theme } = useTheme();

  const handleGoogleSignIn = async () => {

    try {
      await login("google-user@example.com", "");
    } catch (err) {
      console.error("Google sign-in placeholder failed:", err);
    }
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <View style={styles.content}>
        <Image
          source={require("../assets/images/react-logo.png")}
          style={styles.logo}
          resizeMode="contain"
        />
        <AppText style={[styles.title, { color: theme.colors.text.primary }]}>
          Welcome
        </AppText>
        <AppText style={[styles.subtitle, { color: theme.colors.text.secondary }]}>
          Sign in to continue
        </AppText>

        <TouchableOpacity
          style={[styles.googleButton, { borderColor: theme.colors.primary }]}
          onPress={handleGoogleSignIn}
        >
          <AppText
            style={[styles.googleButtonText, { color: theme.colors.primary }]}
          >
            Sign in with Google
          </AppText>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 24,
  },
  googleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: "transparent",
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
