import React from "react";
import { View, ActivityIndicator } from "react-native";
import { Redirect } from "expo-router";
import { useAuth } from "./contexts/AuthContexts";
import { useTheme } from "./contexts/ThemeContexts";

export default function Index() {
  const { user, isLoading } = useAuth();
  const { theme } = useTheme();

  //Loading State
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
          size="small"
          color={theme?.colors?.primary || "#0000ff"}
        />
      </View>
    );
  }

  //Authenticated Flow
  if (user) {
    // Check if user has picked subjects (Onboarding completion check)
    const hasCompletedOnboarding = user.studyPreferences.subjects.length > 0;

    if (!hasCompletedOnboarding) {
      return <Redirect href="/(onboarding)/goals" />;
    }

    return <Redirect href="./(tabs)/dashboard" />;
  }

  //Unauthenticated Flow
  return <Redirect href="/(auth)/welcome" />;
}
