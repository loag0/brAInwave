import { Stack } from "expo-router";
import { useTheme } from "../contexts/ThemeContexts";

export default function OnboardingLayout() {
  const { theme } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
        gestureEnabled: false, // Prevents swiping back to login
        animation: "fade_from_bottom", // Visual cue that this is a "modal" setup
      }}
    >
      <Stack.Screen name="goals" />
      <Stack.Screen name="schedule" />
    </Stack>
  );
}
