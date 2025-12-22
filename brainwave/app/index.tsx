import React from "react";
import { View, ActivityIndicator } from "react-native";
import { Redirect, Stack } from "expo-router";
import { useAuth } from "./contexts/AuthContexts";
import { useTheme } from "./contexts/ThemeContexts";
import AuthScreen from "../components/AuthScreen";

export default function Index() {
  const { user, isLoading } = useAuth();
  const { theme } = useTheme();

  // 1. Loading State: Wait for both Auth and Theme to be ready
  if (isLoading || !theme) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: theme?.colors?.background || "#FFFFFF",
        }}
      >
        <ActivityIndicator
          size="large"
          color={theme?.colors?.primary || "#0000ff"}
        />
      </View>
    );
  }

  // 2. Authenticated: If Firebase finds a valid JWT, send to Dashboard
  if (user) {
    return <Redirect href="/(tabs)" />;
  }

  // 3. Unauthenticated: Show Login/Signup
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <AuthScreen />
    </>
  );
}
