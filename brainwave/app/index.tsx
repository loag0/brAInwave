import React from "react";
import { View, ActivityIndicator } from "react-native";
import { Redirect } from "expo-router";
import { useAuth } from "./contexts/AuthContexts";
import { useTheme } from "./contexts/ThemeContexts";
import AuthScreen from "../components/AuthScreen";

export default function Index() {
  const { user, isLoading } = useAuth();
  const { theme } = useTheme();

  // Show loading spinner while checking auth
  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: theme.colors.background,
        }}
      >
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  // If user is logged in, redirect to main app
  if (user) {
    return <Redirect href="/(tabs)" />;
  }

  // Show auth screen if not logged in
  return <AuthScreen />;
}
